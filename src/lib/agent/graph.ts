import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { runSubAgent, allTools, type SubAgentId, type SubAgentResult, type SubAgentEventCallback } from "./sub-agents";
import type { AgentEvent } from "./state";

// Strip CRLF injected by Windows Vercel CLI piping — affects ALL env vars.
const cleanEnv = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

// ---------------------------------------------------------------------------
// Orchestrator — the top-level planner that decides WHICH agents to delegate to
// and in what order, then synthesizes their results.
//
// Architecture (real multi-agent delegation):
//
//   User Prompt
//       ↓
//   [Orchestrator] — Llama 3.3 70b (Groq) — parses intent, builds task plan
//       ↓
//   [Task Plan] — JSON list of { agentId, instruction } items
//       ↓  (parallel or sequential per plan)
//   [GitHub Agent] [Slack Agent] [Google Agent]
//       ↓               ↓              ↓
//     GitHub tools   Slack tools   Calendar+Gmail tools
//       ↓               ↓              ↓
//   [Orchestrator Synthesizer] — merges results, writes final response
//
// Each sub-agent:
//   - Has its OWN isolated tool set (least privilege)
//   - Has its OWN Auth0 Token Vault scope
//   - Runs a full self-contained ReAct loop
//   - Auth0 CIBA step-up interrupts bubble up through runSubAgent
// ---------------------------------------------------------------------------

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the AgentNet Orchestrator — a master planner that decomposes user requests and delegates to specialized agents.

Available agents and their capabilities:
- "github": GitHub operations — list/create issues, list/detail PRs, comment on PRs, merge PRs
- "slack": Slack operations — list channels, post messages, create channels, archive channels

Your ONLY job is to call the delegate_tasks tool with a precise plan.
Do NOT try to perform any operations directly. Always use delegate_tasks.

Rules:
1. Break each user request into specific, actionable instructions per agent
2. Only include agents that are actually needed for the request
3. Instructions must be self-contained — include all context the sub-agent needs
4. If the user asks about a specific repo, include "owner/repo" in the GitHub instruction
5. Be precise: "post a message to #engineering saying Sprint 12 completed" not "post something to Slack"`;

const delegateTasksTool = tool(
  async (_args: { tasks: Array<{ agentId: SubAgentId; instruction: string }> }) => {
    // The orchestrator LLM fills this in — actual execution happens in runOrchestratedAgents
    return "tasks_delegated";
  },
  {
    name: "delegate_tasks",
    description: "Delegate sub-tasks to specialized agents. Call this once with the full task plan.",
    schema: z.object({
      tasks: z.array(
        z.object({
          agentId: z.enum(["github", "slack"]).describe("Which specialized agent to use"),
          instruction: z.string().describe("Precise, self-contained instruction for the agent"),
        })
      ).min(1).describe("List of tasks for specialized agents"),
    }),
  }
);

const SYNTHESIZER_PROMPT = `You are the AgentNet Synthesizer. 
Your job is to write a clear, concise summary of what the agents accomplished.
Be factual. List what succeeded, what was created/modified, and any errors.
Do not use emojis. Use plain prose.`;

// ---------------------------------------------------------------------------
// Main orchestrated execution — called by the execute API route
// ---------------------------------------------------------------------------

export async function runOrchestratedAgents({
  prompt,
  config,
  onEvent,
}: {
  prompt: string;
  config: RunnableConfig;
  onEvent: (event: AgentEvent) => void;
}): Promise<{ results: SubAgentResult[]; summary: string }> {

  // ---- Step 1: Orchestrator plans the task --------------------------------
  onEvent({
    type: "orchestrating",
    data: { message: "Analyzing request and building task plan..." },
    timestamp: new Date().toISOString(),
  });

  const plannerModel = new ChatGroq({
    model: cleanEnv(process.env.GROQ_MODEL) || "llama-3.3-70b-versatile",
    apiKey: cleanEnv(process.env.GROQ_API_KEY),
    temperature: 0,
  });

  const plannerWithTools = plannerModel.bindTools([delegateTasksTool], {
    tool_choice: { type: "function", function: { name: "delegate_tasks" } },
  });

  const planResponse = await plannerWithTools.invoke(
    [new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT), new HumanMessage(prompt)],
    config
  );

  let taskCall = (planResponse as AIMessage).tool_calls?.[0];
  if (!taskCall || taskCall.name !== "delegate_tasks") {
    // LLM occasionally ignores tool_choice on the first call — retry once
    // with an explicit instruction before giving up.
    const retryResponse = await plannerWithTools.invoke(
      [
        new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT),
        new HumanMessage(
          `You MUST call the delegate_tasks tool now to handle this request: ${prompt}`
        ),
      ],
      config
    );
    taskCall = (retryResponse as AIMessage).tool_calls?.[0];
    if (!taskCall || taskCall.name !== "delegate_tasks") {
      throw new Error(
        "Orchestrator failed to produce a task plan after retry. Please rephrase your request."
      );
    }
  }

  const tasks = (taskCall.args as { tasks: Array<{ agentId: SubAgentId; instruction: string }> }).tasks;

  onEvent({
    type: "task_plan",
    data: {
      tasks: tasks.map((t) => ({ agentId: t.agentId, instruction: t.instruction })),
    },
    timestamp: new Date().toISOString(),
  });

  // ---- Step 2: Execute sub-agents in parallel ---------------------------
  const results: SubAgentResult[] = [];

  const agentPromises = tasks.map((task) => {
    onEvent({
      type: "agent_delegation",
      data: { agentId: task.agentId, instruction: task.instruction },
      timestamp: new Date().toISOString(),
    });

    const eventCallback: SubAgentEventCallback = (subEvent) => {
      onEvent({
        type: subEvent.type,
        data: subEvent.data,
        timestamp: subEvent.timestamp,
      });
    };

    return runSubAgent({
      agentId: task.agentId,
      instruction: task.instruction,
      config,
      onEvent: eventCallback,
    });
  });

  const settled = await Promise.allSettled(agentPromises);

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      results.push({
        agentId: "github", // placeholder — error path
        instruction: "",
        output: "",
        trustEvents: [],
        completedActions: [],
        error: String(outcome.reason),
      });
      continue;
    }
    const result = outcome.value;
    results.push(result);

    // Surface any Auth0 interrupts immediately
    if (result.interrupted) {
      onEvent({
        type: "interrupt",
        data: {
          interruptType: result.interrupted.type,
          message: result.interrupted.message,
          connection: result.interrupted.connection,
          scopes: result.interrupted.scopes,
          agentId: result.agentId,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ---- Step 3: Synthesize results -----------------------------------------

  // If ALL sub-agents were interrupted (token vault not authorized), skip LLM
  // synthesis — produce a direct actionable error instead of a confusing summary.
  const interruptedResults = results.filter((r) => r.interrupted);
  const errorResults = results.filter((r) => r.error && !r.interrupted);
  const successResults = results.filter((r) => !r.interrupted && !r.error);

  if (interruptedResults.length === results.length) {
    const connections = [...new Set(interruptedResults.map((r) =>
      (r.interrupted?.connection as string) ?? r.agentId
    ))];
    return {
      results,
      summary: `Authorization required. The agent needs access to: ${connections.join(", ")}. Go to the Connections page and connect the required accounts, then try again.`,
    };
  }

  // If ALL agents errored (no successes, no interrupts) — likely a config/network error.
  if (errorResults.length === results.length) {
    const firstError = errorResults[0]?.error ?? "Unknown error";
    return {
      results,
      summary: `All agents failed. Error: ${firstError}. Please check your configuration and try again.`,
    };
  }

  // If some agents succeeded and some were interrupted, note it.
  const partialNote = interruptedResults.length > 0
    ? `\n\nNote: ${interruptedResults.map((r) => r.agentId).join(", ")} agent(s) could not complete — authorization was not available.`
    : "";

  onEvent({
    type: "synthesizing",
    data: { message: "Synthesizing agent results..." },
    timestamp: new Date().toISOString(),
  });

  const summaryContext = successResults
    .map((r) => {
      if (r.error) return `${r.agentId} Agent: ERROR — ${r.error}`;
      return `${r.agentId} Agent: ${r.output}`;
    })
    .join("\n\n");

  const synthesizerModel = new ChatGroq({
    model: cleanEnv(process.env.GROQ_MODEL) || "llama-3.3-70b-versatile",
    apiKey: cleanEnv(process.env.GROQ_API_KEY),
    temperature: 0.1,
  });

  const synthResponse = await synthesizerModel.invoke(
    [
      new SystemMessage(SYNTHESIZER_PROMPT),
      new HumanMessage(
        `User asked: "${prompt}"\n\nAgent results:\n${summaryContext}\n\nWrite the final summary:`
      ),
    ],
    config
  );

  const summary =
    (typeof synthResponse.content === "string"
      ? synthResponse.content
      : JSON.stringify(synthResponse.content)) + partialNote;

  return { results, summary };
}

// Export all tools for reference (used by trust policy display, etc.)
export { allTools };

