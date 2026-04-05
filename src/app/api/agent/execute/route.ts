import { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0";
import { runOrchestratedAgents } from "@/lib/agent/graph";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — required for multi-agent LLM chains on Vercel Pro
import type { AgentEvent } from "@/lib/agent/state";
import { getTrustZoneForTool } from "@/lib/trust-policy";
import { logAuditEvent } from "@/lib/db";
import { GraphInterrupt } from "@langchain/langgraph";

function sseFrame(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { prompt: string; threadId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim() === "") {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user?.sub as string;
  // Auth0 v4: refresh token is nested at session.tokenSet.refreshToken
  const s = session as { tokenSet?: { refreshToken?: string } } & Record<string, unknown>;
  const refreshToken = s.tokenSet?.refreshToken;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(event)));
        } catch {
          // Controller may already be closed if client disconnected
        }
      };

      const config = {
        configurable: {
          thread_id: body.threadId ?? crypto.randomUUID(),
          user_id: userId,
          refresh_token: refreshToken ?? "",
        },
      };

      try {
        send({
          type: "step_start",
          data: { step: "orchestrating", prompt: body.prompt },
          timestamp: new Date().toISOString(),
        });

        const { results, summary } = await runOrchestratedAgents({
          prompt: body.prompt,
          config,
          onEvent: send,
        });

        // Log audit entries for all completed actions across all sub-agents
        await Promise.all(
          results.flatMap((result) =>
            result.completedActions.map((action) => {
              const policy = getTrustZoneForTool(action.toolName);
              return logAuditEvent({
                userId,
                action: action.toolName,
                provider: policy?.provider ?? result.agentId,
                trustZone: action.zone,
                status: result.error ? "error" : "success",
                details: action.result.slice(0, 500),
                agentId: result.agentId,
              });
            })
          )
        );

        send({
          type: "step_complete",
          data: { step: "response", content: summary },
          timestamp: new Date().toISOString(),
        });

        send({
          type: "done",
          data: { message: "Orchestration completed" },
          timestamp: new Date().toISOString(),
        });
      } catch (error: unknown) {
        // @auth0/ai-langchain wraps Auth0 interrupts as GraphInterrupt at the top level
        const isGraphInterrupt = error instanceof GraphInterrupt;
        if (isGraphInterrupt) {
          const auth0Interrupt = (error as GraphInterrupt).interrupts?.[0]?.value as Record<string, unknown>;
          send({
            type: "interrupt",
            data: {
              interruptType: (auth0Interrupt?.code as string) ?? "AUTH0_INTERRUPT",
              message: (auth0Interrupt?.message as string) ?? "Authorization required",
              connection: auth0Interrupt?.connection,
              scopes: auth0Interrupt?.scopes,
            },
            timestamp: new Date().toISOString(),
          });
        } else {
          const err = error as Record<string, unknown>;
          send({
            type: "error",
            data: {
              message: (err?.message as string) ?? "An unexpected error occurred",
            },
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

