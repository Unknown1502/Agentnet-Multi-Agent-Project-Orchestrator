import type { TrustZone } from "../trust-policy";
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const AgentAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userRequest: Annotation<string>,
  currentStep: Annotation<string>,
  trustEvents: Annotation<TrustEvent[]>({
    reducer: (prev, next) => [...(prev || []), ...next],
    default: () => [],
  }),
  completedActions: Annotation<CompletedAction[]>({
    reducer: (prev, next) => [...(prev || []), ...next],
    default: () => [],
  }),
  error: Annotation<string | null>,
});

export type AgentState = typeof AgentAnnotation.State;

export interface TrustEvent {
  toolName: string;
  zone: TrustZone;
  status: "approved" | "pending" | "denied" | "auto";
  timestamp: string;
  provider: string;
}

export interface CompletedAction {
  toolName: string;
  result: string;
  zone: TrustZone;
  timestamp: string;
}

export type AgentEventType =
  | "step_start"
  | "step_complete"
  | "tool_call"
  | "tool_result"
  | "trust_event"
  | "interrupt"
  | "error"
  | "done"
  // Multi-agent orchestration events
  | "orchestrating"
  | "task_plan"
  | "agent_delegation"
  | "sub_agent_thinking"
  | "sub_agent_tool_call"
  | "sub_agent_tool_result"
  | "sub_agent_trust_event"
  | "synthesizing";

export interface AgentEvent {
  type: AgentEventType;
  data: Record<string, unknown>;
  timestamp: string;
}
