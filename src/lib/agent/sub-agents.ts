import { ChatGroq } from "@langchain/groq";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { GraphInterrupt } from "@langchain/langgraph";
import { githubTools } from "../tools/github-tools";
import { slackTools } from "../tools/slack-tools";
import { getTrustZoneForTool } from "../trust-policy";
import { getUserTrustPolicies } from "../db";
import type { TrustEvent, CompletedAction } from "./state";

// Strip CRLF injected by Windows Vercel CLI piping—affects ALL env vars.
const cleanEnv = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

export type SubAgentId = "github" | "slack";

export interface SubAgentResult {
  agentId: SubAgentId;
  instruction: string;
  output: string;
  trustEvents: TrustEvent[];
  completedActions: CompletedAction[];
  error?: string;
  interrupted?: {
    type: string;
    message: string;
    connection?: unknown;
    scopes?: unknown;
  };
}

export interface SubAgentEvent {
  agentId: SubAgentId;
  type:
    | "sub_agent_thinking"
    | "sub_agent_tool_call"
    | "sub_agent_tool_result"
    | "sub_agent_trust_event";
  data: Record<string, unknown>;
  timestamp: string;
}

export type SubAgentEventCallback = (event: SubAgentEvent) => void;

// ---------------------------------------------------------------------------
// Agent configurations — each agent has an isolated tool set and system prompt
// This enforces the principle of least privilege across agents
// ---------------------------------------------------------------------------

const GITHUB_SYSTEM_PROMPT = `You are the GitHub Agent — a specialized AI delegate with access ONLY to GitHub operations.

Your delegated scope: repository management, issue tracking, pull request operations.
You cannot access Slack, Google Calendar, or Gmail. You operate with least-privilege.

Execution rules:
1. CRITICAL: If the user did NOT specify an exact "owner/repo", you MUST call list_user_repos FIRST to discover the correct repository before calling any other tool. Never guess or invent an owner or repo name.
2. The list_user_repos response includes a "github_login" field (the authenticated user's GitHub username) and a "repositories" array. Use the "owner" field from the repo list — it may differ from github_login for org repos. If "repositories" is absent or empty, ask the user to specify the exact owner/repo.
3. After calling list_user_repos, pick the most relevant repo from the results (most recently pushed, or matching a keyword from the instruction), then proceed.
4. Use available tools precisely and only for the assigned task.
5. For merge operations: step-up authorization will be requested from the user.
6. Return a concise factual summary of what was accomplished.`;

const SLACK_SYSTEM_PROMPT = `You are the Slack Agent — a specialized AI delegate with access ONLY to Slack operations.

Your delegated scope: channel management, message delivery.
You cannot access GitHub or Google services. You operate with least-privilege.

Execution rules:
1. List channels first if you need to identify the correct channel
2. Compose messages with appropriate context for the channel audience
3. Confirm channel IDs before posting in channels you are not certain about
4. Return a concise factual summary of what was accomplished`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTool = any;

interface AgentConfig {
  tools: AnyTool[];
  systemPrompt: string;
  name: string;
}

const AGENT_CONFIGS: Record<SubAgentId, AgentConfig> = {
  github: {
    tools: githubTools,
    systemPrompt: GITHUB_SYSTEM_PROMPT,
    name: "GitHub Agent",
  },
  slack: {
    tools: slackTools,
    systemPrompt: SLACK_SYSTEM_PROMPT,
    name: "Slack Agent",
  },
};

// Export combined tool list for reference
export const allTools = [
  ...githubTools,
  ...slackTools,
];

const MAX_STEPS = 4;

// ---------------------------------------------------------------------------
// Sub-agent runner
// Executes a self-contained ReAct loop for one specialized agent.
// Each agent only has access to its own provider's Token Vault credentials.
// ---------------------------------------------------------------------------

export async function runSubAgent({
  agentId,
  instruction,
  config,
  onEvent,
}: {
  agentId: SubAgentId;
  instruction: string;
  config: RunnableConfig;
  onEvent?: SubAgentEventCallback;
}): Promise<SubAgentResult> {
  const agentConfig = AGENT_CONFIGS[agentId];
  const trustEvents: TrustEvent[] = [];
  const completedActions: CompletedAction[] = [];

  // Load user's stored trust policy overrides once for this sub-agent run.
  // Tools with requires_approval=1 are blocked and returned as errors instead of executing.
  const userId = (config?.configurable as Record<string, unknown>)?.user_id as string | undefined;
  const storedPolicies = userId ? await getUserTrustPolicies(userId) : [];
  const requiresApprovalMap = new Map(
    storedPolicies.map((p) => [p.tool_name, p.requires_approval === 1])
  );

  const model = new ChatGroq({
    model: cleanEnv(process.env.GROQ_MODEL) || "llama-3.3-70b-versatile",
    apiKey: cleanEnv(process.env.GROQ_API_KEY),
    temperature: 0.1,
  });

  const boundModel = model.bindTools(agentConfig.tools);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolMap = new Map<string, AnyTool>(
    agentConfig.tools.map((t: AnyTool) => [t.name as string, t])
  );

  type Message = HumanMessage | SystemMessage | AIMessage | ToolMessage;
  const messages: Message[] = [
    new SystemMessage(agentConfig.systemPrompt),
    new HumanMessage(instruction),
  ];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      onEvent?.({
        agentId,
        type: "sub_agent_thinking",
        data: { step, agentName: agentConfig.name },
        timestamp: new Date().toISOString(),
      });

      const response = await boundModel.invoke(messages, config);
      messages.push(response as AIMessage);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        const content =
          typeof response.content === "string"
            ? response.content
            : JSON.stringify(response.content);
        return { agentId, instruction, output: content, trustEvents, completedActions };
      }

      for (const toolCall of response.tool_calls) {
        const policy = getTrustZoneForTool(toolCall.name);

        onEvent?.({
          agentId,
          type: "sub_agent_tool_call",
          data: {
            tool: toolCall.name,
            args: toolCall.args,
            zone: policy?.zone ?? "GREEN",
            provider: policy?.provider ?? agentId,
            agentName: agentConfig.name,
          },
          timestamp: new Date().toISOString(),
        });

        if (policy) {
          const trustEvent: TrustEvent = {
            toolName: toolCall.name,
            zone: policy.zone,
            status: policy.requiresApproval ? "pending" : "auto",
            timestamp: new Date().toISOString(),
            provider: policy.provider,
          };
          trustEvents.push(trustEvent);
          onEvent?.({
            agentId,
            type: "sub_agent_trust_event",
            data: { ...trustEvent, agentName: agentConfig.name },
            timestamp: new Date().toISOString(),
          });
        }

        // Enforce: if the user has flagged this tool as requires_approval=1, block it.
        if (requiresApprovalMap.get(toolCall.name) === true) {
          const blockedResult = JSON.stringify({
            error: `Action blocked: "${toolCall.name}" requires explicit approval in Dashboard → Trust Policies.`,
          });
          messages.push(
            new ToolMessage({
              content: blockedResult,
              tool_call_id: toolCall.id ?? toolCall.name,
              name: toolCall.name,
            })
          );
          onEvent?.({
            agentId,
            type: "sub_agent_tool_result",
            data: {
              tool: toolCall.name,
              result: blockedResult,
              zone: policy?.zone ?? "GREEN",
              blocked: true,
              agentName: agentConfig.name,
            },
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const tool = toolMap.get(toolCall.name);
        let toolResult: string;

        if (!tool) {
          toolResult = JSON.stringify({
            error: `Tool "${toolCall.name}" is not available in ${agentConfig.name}. This agent can only use its own delegated tools.`,
          });
        } else {
          try {
            const raw = await tool.invoke(toolCall.args, config);
            toolResult = typeof raw === "string" ? raw : JSON.stringify(raw);
          } catch (toolError: unknown) {
            // @auth0/ai-langchain wraps Auth0 interrupts as GraphInterrupt.
            // The original Auth0Interrupt is at err.interrupts[0].value.
            if (toolError instanceof GraphInterrupt) {
              const auth0Interrupt = toolError.interrupts?.[0]?.value as Record<string, unknown>;
              return {
                agentId,
                instruction,
                output: `Authorization required for ${toolCall.name}`,
                trustEvents,
                completedActions,
                interrupted: {
                  type: (auth0Interrupt?.code as string) ?? "AUTH0_INTERRUPT",
                  message: (auth0Interrupt?.message as string) ?? "Authorization required",
                  connection: auth0Interrupt?.connection,
                  scopes: auth0Interrupt?.scopes,
                },
              };
            }
            const err = toolError as Record<string, unknown>;
            toolResult = JSON.stringify({
              error: (err?.message as string) ?? `Tool execution failed: ${toolCall.name}`,
            });
          }
        }

        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id ?? toolCall.name,
            name: toolCall.name,
          })
        );

        completedActions.push({
          toolName: toolCall.name,
          result: toolResult.slice(0, 200),
          zone: policy?.zone ?? "GREEN",
          timestamp: new Date().toISOString(),
        });

        onEvent?.({
          agentId,
          type: "sub_agent_tool_result",
          data: {
            tool: toolCall.name,
            result: toolResult.slice(0, 400),
            zone: policy?.zone ?? "GREEN",
            agentName: agentConfig.name,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Reached max steps — extract last AI response
    const lastAiMsg = [...messages].reverse().find((m) => m instanceof AIMessage);
    const output = lastAiMsg
      ? typeof lastAiMsg.content === "string"
        ? lastAiMsg.content
        : JSON.stringify(lastAiMsg.content)
      : "Task completed.";

    return { agentId, instruction, output, trustEvents, completedActions };
  } catch (error: unknown) {
    // @auth0/ai-langchain wraps Auth0 interrupts as GraphInterrupt.
    if (error instanceof GraphInterrupt) {
      const auth0Interrupt = error.interrupts?.[0]?.value as Record<string, unknown>;
      return {
        agentId,
        instruction,
        output: `Authorization required to access ${agentConfig.name}`,
        trustEvents,
        completedActions,
        interrupted: {
          type: (auth0Interrupt?.code as string) ?? "AUTH0_INTERRUPT",
          message: (auth0Interrupt?.message as string) ?? "Authorization required",
          connection: auth0Interrupt?.connection,
          scopes: auth0Interrupt?.scopes,
        },
      };
    }
    const err = error as Record<string, unknown>;
    return {
      agentId,
      instruction,
      output: "",
      trustEvents,
      completedActions,
      error: (err?.message as string) ?? "Unknown error in sub-agent",
    };
  }
}
