"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, MessageSquare, Network, CheckCircle, XCircle, Loader2, Shield, AlertTriangle, Zap } from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

interface ExecutionGraphProps {
  events: AgentEvent[];
  isLoading: boolean;
}

type NodeStatus = "idle" | "active" | "success" | "error" | "interrupted";

interface AgentNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: NodeStatus;
  tools: string[];
  lastTool?: string;
}

const AGENT_DEFS = {
  github: {
    label: "GitHub",
    icon: <GitBranch className="h-6 w-6" />,
    activeColor: "border-violet-400/70 bg-violet-500/15 shadow-violet-500/40",
    successColor: "border-emerald-400/60 bg-emerald-500/10 shadow-emerald-500/30",
    errorColor: "border-red-400/50 bg-red-500/8",
    idleColor: "border-white/10 bg-white/3",
    labelActive: "text-violet-300",
    labelSuccess: "text-emerald-300",
    labelError: "text-red-300",
    dotColor: "bg-violet-400",
    toolBg: "border-violet-500/20 bg-violet-500/8 text-violet-300/70",
  },
  slack: {
    label: "Slack",
    icon: <MessageSquare className="h-6 w-6" />,
    activeColor: "border-emerald-400/70 bg-emerald-500/15 shadow-emerald-500/40",
    successColor: "border-emerald-400/60 bg-emerald-500/10 shadow-emerald-500/30",
    errorColor: "border-red-400/50 bg-red-500/8",
    idleColor: "border-white/10 bg-white/3",
    labelActive: "text-emerald-300",
    labelSuccess: "text-emerald-300",
    labelError: "text-red-300",
    dotColor: "bg-emerald-400",
    toolBg: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300/70",
  },
};

const TRUST_COLORS: Record<string, string> = {
  GREEN: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  YELLOW: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  RED: "text-red-400 border-red-500/40 bg-red-500/10",
};

function OrchestratorNode({ status }: { status: NodeStatus }) {
  const isActive = status === "active";
  const isSuccess = status === "success";

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        className={`relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 shadow-lg transition-all duration-500 ${
          isActive
            ? "border-cyan-400/80 bg-cyan-500/15 shadow-cyan-500/50"
            : isSuccess
            ? "border-cyan-400/40 bg-cyan-500/8 shadow-cyan-500/20"
            : "border-white/12 bg-white/3"
        }`}
        animate={isActive ? { scale: [1, 1.03, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        {/* Outer pulse ring */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-2xl border-2 border-cyan-400/30"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
          />
        )}
        {/* Inner glow */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-cyan-500/20"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
        <Network className={`h-8 w-8 relative ${isActive ? "text-cyan-300" : isSuccess ? "text-cyan-400/60" : "text-white/25"}`} />
        {/* Active dot */}
        {isActive && (
          <motion.div
            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-[#04050d] bg-cyan-400"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
          />
        )}
        {isSuccess && (
          <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-[#04050d] bg-emerald-400" />
        )}
      </motion.div>
      <span className={`text-[11px] font-bold tracking-widest uppercase ${isActive ? "text-cyan-300" : "text-white/30"}`}>
        Orchestrator
      </span>
    </div>
  );
}

function AgentNode({ node, def }: { node: AgentNode; def: typeof AGENT_DEFS.github }) {
  const isActive = node.status === "active";
  const isSuccess = node.status === "success";
  const isError = node.status === "error" || node.status === "interrupted";

  const borderBg = isActive
    ? def.activeColor
    : isSuccess
    ? def.successColor
    : isError
    ? def.errorColor
    : def.idleColor;

  const labelColor = isActive
    ? def.labelActive
    : isSuccess
    ? def.labelSuccess
    : isError
    ? def.labelError
    : "text-white/30";

  const iconColor = isActive
    ? def.labelActive
    : isSuccess
    ? "text-emerald-400"
    : isError
    ? "text-red-400"
    : "text-white/25";

  return (
    <motion.div
      className="flex flex-col items-center gap-2.5"
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
    >
      <motion.div
        className={`relative flex h-16 w-16 items-center justify-center rounded-xl border-2 shadow-lg transition-all duration-500 ${borderBg}`}
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      >
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-xl opacity-50"
            style={{ background: "inherit" }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        )}
        <div className={`relative ${iconColor}`}>{node.icon}</div>

        {/* Status indicator */}
        <div className="absolute -top-1.5 -right-1.5">
          {isActive && (
            <motion.div
              className={`h-3.5 w-3.5 rounded-full border-2 border-[#04050d] ${def.dotColor}`}
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
            />
          )}
          {isSuccess && <CheckCircle className="h-4.5 w-4.5 text-emerald-400 drop-shadow" />}
          {(node.status === "error") && <XCircle className="h-4.5 w-4.5 text-red-400 drop-shadow" />}
          {node.status === "interrupted" && <Shield className="h-4.5 w-4.5 text-orange-400 drop-shadow" />}
        </div>
      </motion.div>

      <span className={`text-xs font-semibold ${labelColor}`}>{node.label}</span>

      {/* Tool pill */}
      <AnimatePresence mode="wait">
        {node.lastTool && isActive && (
          <motion.div
            key={node.lastTool}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium max-w-25 truncate ${def.toolBg}`}
          >
            {node.lastTool.replace(/_/g, " ")}
          </motion.div>
        )}
        {isSuccess && node.tools.length > 0 && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-1 text-[10px] text-emerald-400/70">
            <Zap className="h-2.5 w-2.5" />
            {node.tools.length} action{node.tools.length !== 1 ? "s" : ""}
          </motion.div>
        )}
        {isError && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-[10px] text-red-400/70">
            {node.status === "interrupted" ? "Auth needed" : "Failed"}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ConnectionLine({ active, success, error }: { active: boolean; success: boolean; error: boolean }) {
  return (
    <div className="relative flex items-center w-14">
      <div className={`h-px w-full transition-all duration-700 ${
        active ? "bg-linear-to-r from-cyan-500/70 via-cyan-400/40 to-transparent" :
        success ? "bg-linear-to-r from-emerald-500/50 via-emerald-400/25 to-transparent" :
        error ? "bg-linear-to-r from-red-500/40 via-red-400/20 to-transparent" :
        "bg-white/8"
      }`} />
      {active && (
        <motion.div
          className="absolute h-2 w-2 rounded-full bg-cyan-400 shadow-md shadow-cyan-400"
          animate={{ x: [0, 52, 0] }}
          transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
        />
      )}
    </div>
  );
}

function TrustBand({ events }: { events: AgentEvent[] }) {
  const trustEvents = events.filter((e) => e.type === "sub_agent_trust_event");
  if (trustEvents.length === 0) return null;

  const counts = { GREEN: 0, YELLOW: 0, RED: 0 };
  trustEvents.forEach((e) => {
    const z = (e.data.zone as string) ?? "GREEN";
    if (z in counts) counts[z as keyof typeof counts]++;
  });

  return (
    <motion.div
      className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-4 py-2.5 mt-4"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Shield className="h-3.5 w-3.5 text-white/25 shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 mr-1">Trust</span>
      {Object.entries(counts).map(([zone, count]) =>
        count > 0 ? (
          <span key={zone} className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${TRUST_COLORS[zone]}`}>
            {zone === "RED" && <AlertTriangle className="h-2.5 w-2.5" />}
            {count}× {zone}
          </span>
        ) : null
      )}
    </motion.div>
  );
}

export function ExecutionGraph({ events, isLoading }: ExecutionGraphProps) {
  const { orchestratorStatus, agents } = useMemo(() => {
    const agentMap: Record<string, AgentNode> = {
      github: { id: "github", label: "GitHub", icon: <GitBranch className="h-6 w-6" />, status: "idle", tools: [] },
      slack:  { id: "slack",  label: "Slack",  icon: <MessageSquare className="h-6 w-6" />, status: "idle", tools: [] },
    };

    let orchStatus: NodeStatus = "idle";
    const activeAgents = new Set<string>();

    for (const e of events) {
      switch (e.type) {
        case "orchestrating":
        case "task_plan":
          orchStatus = "active";
          break;
        case "agent_delegation": {
          const aid = e.data.agentId as string;
          if (agentMap[aid]) { agentMap[aid].status = "active"; activeAgents.add(aid); }
          break;
        }
        case "sub_agent_tool_call": {
          const aid = e.data.agentId as string;
          if (agentMap[aid]) {
            agentMap[aid].lastTool = e.data.tool as string;
            agentMap[aid].tools.push(e.data.tool as string);
          }
          break;
        }
        case "interrupt": {
          const aid = e.data.agentId as string;
          if (agentMap[aid]) { agentMap[aid].status = "interrupted"; activeAgents.delete(aid); }
          break;
        }
        case "synthesizing":
          orchStatus = "active";
          activeAgents.forEach((aid) => {
            if (agentMap[aid]?.status === "active") agentMap[aid].status = "success";
          });
          activeAgents.clear();
          break;
        case "done":
        case "step_complete":
          orchStatus = "success";
          activeAgents.forEach((aid) => {
            if (agentMap[aid]?.status === "active") agentMap[aid].status = "success";
          });
          activeAgents.clear();
          break;
        case "error":
          orchStatus = "error";
          activeAgents.forEach((aid) => {
            if (agentMap[aid]?.status === "active") agentMap[aid].status = "error";
          });
          activeAgents.clear();
          break;
      }
    }

    if (isLoading && orchStatus === "idle") orchStatus = "active";
    return { orchestratorStatus: orchStatus, agents: agentMap };
  }, [events, isLoading]);

  const hasTrust = events.some((e) => e.type === "sub_agent_trust_event");

  return (
    <div className="rounded-2xl border border-white/6 bg-[#06080f]/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/5 px-5 py-3.5">
        <motion.div
          className="h-2 w-2 rounded-full bg-cyan-400"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/30">
          Execution Graph
        </span>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 ml-auto" />}
      </div>

      {/* Graph */}
      <div className="flex items-center justify-center gap-0 py-8 px-6">
        {/* Orchestrator */}
        <OrchestratorNode status={orchestratorStatus} />

        {/* Connections + Agents column */}
        <div className="flex flex-col gap-6">
          {(["github", "slack"] as const).map((id) => {
            const node = agents[id];
            const def = AGENT_DEFS[id];
            const isActive = node.status === "active";
            const isSuccess = node.status === "success";
            const isError = node.status === "error" || node.status === "interrupted";
            return (
              <div key={id} className="flex items-center">
                <ConnectionLine active={isActive} success={isSuccess} error={isError} />
                <AgentNode node={node} def={def} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust band */}
      {hasTrust && (
        <div className="border-t border-white/5 px-5 pb-4">
          <TrustBand events={events} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <div className="border-t border-white/5 px-5 pb-5 pt-1 text-center">
          <p className="text-xs text-white/18">Graph activates when you send a command</p>
        </div>
      )}
    </div>
  );
}
