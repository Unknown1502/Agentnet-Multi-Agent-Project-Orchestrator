"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, MessageSquare, Network, CheckCircle, XCircle,
  AlertTriangle, Loader2, Zap, ArrowRight,
} from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";
import type { TrustZone } from "@/lib/trust-policy";

// ─── Design tokens ────────────────────────────────────────────────────────────
const AGENT = {
  github: "#4F8EFF",
  slack:  "#E01E8C",
};
const TRUST: Record<string, string> = {
  GREEN:  "#00E57A",
  YELLOW: "#F5C510",
  RED:    "#FF3D5A",
};
const ORCH_COLOR = "#00D9FF";

// ─── Renderable event types ───────────────────────────────────────────────────
const RENDERABLE = new Set([
  "orchestrating", "task_plan", "agent_delegation",
  "sub_agent_thinking", "sub_agent_tool_call", "sub_agent_tool_result",
  "sub_agent_trust_event", "synthesizing", "done", "error",
]);

// ─── Single row ───────────────────────────────────────────────────────────────
function EventRow({ event }: { event: AgentEvent }) {
  const agentId    = (event.data.agentId as string) ?? "";
  const agentColor = AGENT[agentId as keyof typeof AGENT];

  let icon:  React.ReactNode;
  let text:  string;
  let color: string;

  switch (event.type) {
    case "orchestrating":
      icon  = <Network className="h-3 w-3" style={{ color: ORCH_COLOR }} />;
      text  = (event.data.message as string) || "Orchestrating…";
      color = ORCH_COLOR;
      break;
    case "task_plan": {
      const tasks = (event.data.tasks as Array<{ agentId: string }>) || [];
      icon  = <ArrowRight className="h-3 w-3" style={{ color: ORCH_COLOR }} />;
      text  = `Delegating → ${tasks.map((t) => t.agentId).join(", ")}`;
      color = ORCH_COLOR;
      break;
    }
    case "agent_delegation":
      icon  = agentId === "github"
                ? <GitBranch className="h-3 w-3" style={{ color: agentColor }} />
                : <MessageSquare className="h-3 w-3" style={{ color: agentColor }} />;
      text  = `${agentId}: ${String(event.data.instruction ?? "Starting…").slice(0, 60)}`;
      color = agentColor || "rgba(255,255,255,0.4)";
      break;
    case "sub_agent_thinking":
      icon  = <Loader2 className="h-3 w-3 animate-spin" style={{ color: agentColor }} />;
      text  = `${agentId} thinking…`;
      color = agentColor || "rgba(255,255,255,0.4)";
      break;
    case "sub_agent_tool_call":
      icon  = <Zap className="h-3 w-3" style={{ color: agentColor }} />;
      text  = `${agentId} → ${String(event.data.tool ?? "").replace(/_/g, " ")}`;
      color = agentColor || "rgba(255,255,255,0.4)";
      break;
    case "sub_agent_tool_result":
      icon  = <CheckCircle className="h-3 w-3" style={{ color: agentColor }} />;
      text  = `${agentId}: ${String(event.data.result ?? "Done").slice(0, 60)}`;
      color = agentColor || "rgba(255,255,255,0.4)";
      break;
    case "sub_agent_trust_event": {
      const zone = ((event.data.zone as TrustZone) ?? "GREEN");
      const tc   = TRUST[zone] ?? TRUST.GREEN;
      icon  = <AlertTriangle className="h-3 w-3" style={{ color: tc }} />;
      text  = `Trust: ${String(event.data.tool ?? "").replace(/_/g, " ")} → ${zone}`;
      color = tc;
      break;
    }
    case "synthesizing":
      icon  = <Network className="h-3 w-3" style={{ color: ORCH_COLOR }} />;
      text  = "Synthesizing results…";
      color = ORCH_COLOR;
      break;
    case "done":
      icon  = <CheckCircle className="h-3 w-3" style={{ color: "#00E57A" }} />;
      text  = String(event.data.summary ?? "Completed").slice(0, 80);
      color = "#00E57A";
      break;
    case "error":
      icon  = <XCircle className="h-3 w-3" style={{ color: "#FF3D5A" }} />;
      text  = String(event.data.message ?? "Error").slice(0, 80);
      color = "#FF3D5A";
      break;
    default:
      return null;
  }

  const time = new Date(event.timestamp).toLocaleTimeString("en", {
    hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className="flex items-start gap-2.5 px-5 py-1.75 hover:bg-white/1.2 transition-colors"
    >
      <div className="mt-px shrink-0 opacity-80" style={{ color }}>
        {icon}
      </div>
      <span className="flex-1 truncate text-[12px] leading-normal" style={{ color: "rgba(255,255,255,0.48)" }}>
        {text}
      </span>
      <span className="shrink-0 font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.14)" }}>
        {time}
      </span>
    </motion.div>
  );
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
export function AgentActivityFeed({ events }: { events: AgentEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const filtered = events.filter((e) => RENDERABLE.has(e.type));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center border-b border-white/4 px-5 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.18)" }}>
          Activity
        </span>
        <span className="ml-auto font-mono text-[10px]" style={{ color: "rgba(255,255,255,0.13)" }}>
          {filtered.length}
        </span>
      </div>

      {/* Events */}
      <div>
        <AnimatePresence initial={false}>
          {filtered.map((e, i) => (
            <EventRow key={i} event={e} />
          ))}
        </AnimatePresence>
      </div>

      <div ref={bottomRef} />
    </div>
  );
}