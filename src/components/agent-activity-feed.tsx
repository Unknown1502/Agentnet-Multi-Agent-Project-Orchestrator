"use client";

import { useEffect, useRef } from "react";
import {
  GitBranch,
  MessageSquare,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Bot,
  Network,
  ListTodo,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { TrustZoneBadge } from "@/components/trust-zone-badge";
import type { AgentEvent } from "@/lib/agent/state";
import type { TrustZone } from "@/lib/trust-policy";

interface AgentActivityFeedProps {
  events: AgentEvent[];
}

const AGENT_ICONS: Record<string, React.ReactNode> = {
  github: <GitBranch className="h-4 w-4" />,
  slack: <MessageSquare className="h-4 w-4" />,
};

const AGENT_COLORS: Record<string, string> = {
  github: "text-purple-400 border-purple-800 bg-purple-950/40",
  slack: "text-green-400 border-green-800 bg-green-950/40",
};

const AGENT_LABELS: Record<string, string> = {
  github: "GitHub Agent",
  slack: "Slack Agent",
};

// Sub-agent events are indented under their agent header
const SUB_AGENT_TYPES = new Set([
  "sub_agent_thinking",
  "sub_agent_tool_call",
  "sub_agent_tool_result",
  "sub_agent_trust_event",
]);

function OrchestratingCard({ event }: { event: AgentEvent }) {
  return (
    <div className="flex gap-3 rounded-lg border border-cyan-800/40 bg-cyan-950/20 p-3">
      <Network className="h-4 w-4 mt-0.5 shrink-0 text-cyan-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-cyan-300">AgentNet Orchestrator</span>
          <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
          <span className="ml-auto text-xs text-white/30">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-cyan-400/80">
          {(event.data.message as string) ?? "Analyzing request..."}
        </p>
      </div>
    </div>
  );
}

function TaskPlanCard({ event }: { event: AgentEvent }) {
  const tasks = event.data.tasks as Array<{ agentId: string; instruction: string }>;
  return (
    <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-medium text-cyan-300">Task Plan</span>
        <span className="ml-auto text-xs text-white/30">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="space-y-1.5">
        {tasks?.map((task, i) => {
          const colors = AGENT_COLORS[task.agentId] ?? "text-gray-300 border-gray-700 bg-gray-900/40";
          return (
            <div
              key={i}
              className={`flex items-start gap-2 rounded px-2 py-1.5 border text-xs ${colors}`}
            >
              {AGENT_ICONS[task.agentId] ?? <Bot className="h-3 w-3" />}
              <div className="min-w-0">
                <span className="font-semibold">{AGENT_LABELS[task.agentId] ?? task.agentId}</span>
                <span className="mx-1 opacity-40">—</span>
                <span className="opacity-80">{task.instruction}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgentDelegationCard({ event }: { event: AgentEvent }) {
  const agentId = event.data.agentId as string;
  const colors = AGENT_COLORS[agentId] ?? "text-gray-300 border-gray-700 bg-gray-900/40";
  return (
    <div className={`flex gap-3 rounded-lg border p-3 ${colors}`}>
      <div className="mt-0.5 shrink-0">
        {AGENT_ICONS[agentId] ?? <Bot className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-3 w-3 opacity-60" />
          <span className="text-sm font-semibold">
            {AGENT_LABELS[agentId] ?? agentId}
          </span>
          <Loader2 className="h-3 w-3 animate-spin opacity-70" />
          <span className="ml-auto text-xs opacity-50">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="mt-0.5 text-xs opacity-70 truncate">
          {event.data.instruction as string}
        </p>
      </div>
    </div>
  );
}

function SubAgentEventCard({ event }: { event: AgentEvent }) {
  const agentId = event.data.agentId as string | undefined;
  const colors = agentId ? (AGENT_COLORS[agentId] ?? "") : "";
  const zone = event.data.zone as TrustZone | undefined;
  const time = new Date(event.timestamp).toLocaleTimeString();

  let icon: React.ReactNode;
  let title: string;
  let detail: string | null = null;

  switch (event.type) {
    case "sub_agent_thinking":
      icon = <Loader2 className="h-3 w-3 animate-spin opacity-60" />;
      title = "Reasoning...";
      break;
    case "sub_agent_tool_call":
      icon = AGENT_ICONS[event.data.provider as string] ?? <Bot className="h-3 w-3" />;
      title = `Calling ${event.data.tool as string}`;
      detail = JSON.stringify(event.data.args, null, 2);
      break;
    case "sub_agent_tool_result":
      icon = <CheckCircle className="h-3 w-3 text-green-400" />;
      title = `${event.data.tool as string} returned`;
      detail = event.data.result as string;
      break;
    case "sub_agent_trust_event":
      icon = <Shield className="h-3 w-3 text-yellow-400" />;
      title = `Trust check: ${event.data.toolName as string}`;
      break;
    default:
      icon = <Bot className="h-3 w-3" />;
      title = event.type;
  }

  return (
    <div className={`ml-6 flex gap-2 rounded-lg border border-white/5 bg-white/1.5 px-2.5 py-2 ${colors}`}>
      <div className="mt-0.5 shrink-0 opacity-70">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium opacity-90">{title}</span>
          {zone && <TrustZoneBadge zone={zone} />}
          <span className="ml-auto text-xs opacity-40">{time}</span>
        </div>
        {detail && (
          <pre className="mt-0.5 text-xs opacity-60 whitespace-pre-wrap wrap-break-word max-h-24 overflow-y-auto">
            {detail}
          </pre>
        )}
      </div>
    </div>
  );
}

function SynthesizingCard({ event }: { event: AgentEvent }) {
  return (
    <div className="flex gap-3 rounded-lg border border-emerald-800 bg-emerald-950/20 p-3">
      <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-emerald-300">Synthesizing Results</span>
          <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
          <span className="ml-auto text-xs text-white/30">
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-emerald-400/70">
          {(event.data.message as string) ?? "Merging agent outputs..."}
        </p>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: AgentEvent }) {
  // Route to specialized renderers
  if (event.type === "orchestrating") return <OrchestratingCard event={event} />;
  if (event.type === "task_plan") return <TaskPlanCard event={event} />;
  if (event.type === "agent_delegation") return <AgentDelegationCard event={event} />;
  if (SUB_AGENT_TYPES.has(event.type)) return <SubAgentEventCard event={event} />;
  if (event.type === "synthesizing") return <SynthesizingCard event={event} />;

  // Legacy / standard events
  const zone = event.data.zone as TrustZone | undefined;
  const time = new Date(event.timestamp).toLocaleTimeString();

  let icon: React.ReactNode;
  let title: string;
  let detail: string | null = null;

  switch (event.type) {
    case "step_start":
      icon = <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />;
      title = "Processing request";
      break;
    case "step_complete":
      icon = <CheckCircle className="h-4 w-4 text-green-400" />;
      title = "Response ready";
      detail = (event.data.content as string) || null;
      break;
    case "tool_call":
      icon = AGENT_ICONS[(event.data.provider as string)] ?? <Bot className="h-4 w-4" />;
      title = `Calling ${event.data.tool as string}`;
      detail = JSON.stringify(event.data.args, null, 2);
      break;
    case "tool_result":
      icon = <CheckCircle className="h-4 w-4 text-green-400" />;
      title = `${event.data.tool as string} completed`;
      detail = (event.data.result as string) || null;
      break;
    case "trust_event":
      icon = <Shield className="h-4 w-4 text-yellow-400" />;
      title = `Trust check: ${event.data.toolName as string}`;
      break;
    case "interrupt":
      icon = <AlertTriangle className="h-4 w-4 text-orange-400" />;
      title = "Authorization required";
      detail = (event.data.message as string) || null;
      break;
    case "error":
      icon = <XCircle className="h-4 w-4 text-red-400" />;
      title = "Error occurred";
      detail = (event.data.message as string) || null;
      break;
    case "done":
      icon = <CheckCircle className="h-4 w-4 text-green-400" />;
      title = "Execution completed";
      break;
    default:
      icon = <Bot className="h-4 w-4 text-white/40" />;
      title = event.type;
  }

  return (
    <div className="flex gap-3 rounded-lg border border-white/6 bg-white/2 p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">{title}</span>
          {zone && <TrustZoneBadge zone={zone} />}
          <span className="ml-auto text-xs text-white/30">{time}</span>
        </div>
        {detail && (
          <pre className="mt-1 text-xs text-white/35 whitespace-pre-wrap wrap-break-word max-h-32 overflow-y-auto">
            {detail}
          </pre>
        )}
      </div>
    </div>
  );
}

export function AgentActivityFeed({ events }: AgentActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-white/25">
        <Bot className="h-12 w-12 mb-3 text-white/15" />
        <p className="text-sm text-white/30">No activity yet. Send a command to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
      {events.map((event, i) => (
        <EventCard key={i} event={event} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
