"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, MessageSquare, BookOpen, Network, CheckCircle, XCircle, Loader2, Shield, AlertTriangle } from "lucide-react";
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
  color: string;
  glowColor: string;
  status: NodeStatus;
  tools: string[];
  lastTool?: string;
  interrupted?: boolean;
}

const AGENT_DEFS = {
  github: {
    label: "GitHub",
    icon: <GitBranch className="h-5 w-5" />,
    color: "text-violet-300",
    glowColor: "shadow-violet-500/60",
    borderColor: "border-violet-500/50",
    bgColor: "bg-violet-500/10",
    dotColor: "bg-violet-400",
  },
  slack: {
    label: "Slack",
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-emerald-300",
    glowColor: "shadow-emerald-500/60",
    borderColor: "border-emerald-500/50",
    bgColor: "bg-emerald-500/10",
    dotColor: "bg-emerald-400",
  },
  notion: {
    label: "Notion",
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-amber-300",
    glowColor: "shadow-amber-500/60",
    borderColor: "border-amber-500/50",
    bgColor: "bg-amber-500/10",
    dotColor: "bg-amber-400",
  },
};

const TRUST_COLORS: Record<string, string> = {
  GREEN: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  YELLOW: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  RED: "text-red-400 border-red-500/40 bg-red-500/10",
};

function OrchestratorNode({ status }: { status: NodeStatus }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 ${
          status === "active"
            ? "border-cyan-400/70 bg-cyan-500/15 shadow-lg shadow-cyan-500/40"
            : status === "success"
            ? "border-cyan-400/50 bg-cyan-500/10"
            : "border-white/15 bg-white/4"
        } transition-all duration-500`}
        animate={status === "active" ? { scale: [1, 1.04, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.8 }}
      >
        {status === "active" && (
          <motion.div
            className="absolute inset-0 rounded-2xl bg-cyan-500/20"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
        <Network className={`h-7 w-7 ${status === "active" ? "text-cyan-300" : "text-white/40"}`} />
        {status === "active" && (
          <motion.div
            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#04050d] bg-cyan-400"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
        {status === "success" && (
          <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#04050d] bg-emerald-400" />
        )}
      </motion.div>
      <span className={`text-xs font-semibold tracking-wide ${status === "active" ? "text-cyan-300" : "text-white/40"}`}>
        ORCHESTRATOR
      </span>
    </div>
  );
}

function AgentNode({ node, def }: { node: AgentNode; def: typeof AGENT_DEFS.github }) {
  const isActive = node.status === "active";
  const isSuccess = node.status === "success";
  const isError = node.status === "error" || node.status === "interrupted";

  return (
    <motion.div
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={`relative flex h-14 w-14 items-center justify-center rounded-xl border-2 transition-all duration-500 ${
          isActive
            ? `${def.borderColor} ${def.bgColor} shadow-lg ${def.glowColor}`
            : isSuccess
            ? `border-emerald-500/40 bg-emerald-500/8`
            : isError
            ? "border-red-500/40 bg-red-500/8"
            : "border-white/10 bg-white/3"
        }`}
        animate={isActive ? { scale: [1, 1.05, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      >
        {isActive && (
          <motion.div
            className={`absolute inset-0 rounded-xl ${def.bgColor}`}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          />
        )}
        <div className={`relative ${isActive ? def.color : isSuccess ? "text-emerald-400" : isError ? "text-red-400" : "text-white/30"}`}>
          {node.icon}
        </div>
        {/* Status badge */}
        <div className="absolute -top-1 -right-1">
          {isActive && (
            <motion.div
              className={`h-3.5 w-3.5 rounded-full border-2 border-[#04050d] ${def.dotColor}`}
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ repeat: Infinity, duration: 0.7 }}
            />
          )}
          {isSuccess && <CheckCircle className="h-4 w-4 text-emerald-400 drop-shadow-sm" />}
          {isError && <XCircle className="h-4 w-4 text-red-400 drop-shadow-sm" />}
          {node.status === "interrupted" && <Shield className="h-4 w-4 text-orange-400 drop-shadow-sm" />}
        </div>
      </motion.div>

      <span className={`text-xs font-semibold ${isActive ? def.color : isSuccess ? "text-emerald-300" : isError ? "text-red-300" : "text-white/35"}`}>
        {node.label}
      </span>

      {/* Tool being called */}
      <AnimatePresence mode="wait">
        {node.lastTool && isActive && (
          <motion.div
            key={node.lastTool}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] text-white/50 max-w-27.5 truncate text-center"
          >
            {node.lastTool}
          </motion.div>
        )}
        {isSuccess && node.tools.length > 0 && (
          <motion.div
            key="count"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-emerald-400/70"
          >
            {node.tools.length} action{node.tools.length !== 1 ? "s" : ""}
          </motion.div>
        )}
        {isError && (
          <motion.div
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] text-red-400/70"
          >
            {node.status === "interrupted" ? "Auth required" : "Failed"}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
      className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/2 px-4 py-2.5 mt-3"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Shield className="h-3.5 w-3.5 text-white/30 shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mr-1">Trust</span>
      {Object.entries(counts).map(([zone, count]) =>
        count > 0 ? (
          <span key={zone} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${TRUST_COLORS[zone]}`}>
            {zone === "RED" && <AlertTriangle className="h-2.5 w-2.5" />}
            {count}× {zone}
          </span>
        ) : null
      )}
    </motion.div>
  );
}

// Animated connection line between orchestrator and agent node
function ConnectionLine({ active, success, error }: { active: boolean; success: boolean; error: boolean }) {
  return (
    <div className="relative flex items-center">
      <div className={`h-px w-12 transition-all duration-500 ${
        active ? "bg-linear-to-r from-cyan-500/60 to-cyan-500/20" :
        success ? "bg-linear-to-r from-emerald-500/40 to-emerald-500/10" :
        error ? "bg-linear-to-r from-red-500/30 to-red-500/10" :
        "bg-white/8"
      }`} />
      {active && (
        <motion.div
          className="absolute h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/80"
          animate={{ x: [0, 44, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
        />
      )}
    </div>
  );
}

export function ExecutionGraph({ events, isLoading }: ExecutionGraphProps) {
  const { orchestratorStatus, agents } = useMemo(() => {
    const agentMap: Record<string, AgentNode> = {
      github: { id: "github", label: "GitHub", icon: <GitBranch className="h-5 w-5" />, color: AGENT_DEFS.github.color, glowColor: AGENT_DEFS.github.glowColor, status: "idle", tools: [] },
      slack: { id: "slack", label: "Slack", icon: <MessageSquare className="h-5 w-5" />, color: AGENT_DEFS.slack.color, glowColor: AGENT_DEFS.slack.glowColor, status: "idle", tools: [] },
      notion: { id: "notion", label: "Notion", icon: <BookOpen className="h-5 w-5" />, color: AGENT_DEFS.notion.color, glowColor: AGENT_DEFS.notion.glowColor, status: "idle", tools: [] },
    };

    let orchStatus: NodeStatus = "idle";
    const activeAgents = new Set<string>();
    const completedAgents = new Set<string>();
    const errorAgents = new Set<string>();

    for (const e of events) {
      switch (e.type) {
        case "orchestrating":
        case "task_plan":
          orchStatus = "active";
          break;
        case "agent_delegation": {
          const aid = e.data.agentId as string;
          if (agentMap[aid]) {
            agentMap[aid].status = "active";
            activeAgents.add(aid);
          }
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
          if (agentMap[aid]) {
            agentMap[aid].status = "interrupted";
            errorAgents.add(aid);
            activeAgents.delete(aid);
          }
          break;
        }
        case "synthesizing":
          orchStatus = "active";
          activeAgents.forEach((aid) => {
            if (agentMap[aid]?.status === "active") {
              agentMap[aid].status = "success";
              completedAgents.add(aid);
            }
          });
          activeAgents.clear();
          break;
        case "done":
        case "step_complete":
          orchStatus = "success";
          activeAgents.forEach((aid) => {
            if (agentMap[aid]?.status === "active") {
              agentMap[aid].status = "success";
            }
          });
          activeAgents.clear();
          break;
        case "error":
          orchStatus = "error";
          activeAgents.forEach((aid) => {
            if (agentMap[aid]?.status === "active") {
              agentMap[aid].status = "error";
              errorAgents.add(aid);
            }
          });
          activeAgents.clear();
          break;
      }
    }

    if (isLoading && orchStatus === "idle") orchStatus = "active";

    return { orchestratorStatus: orchStatus, agents: agentMap };
  }, [events, isLoading]);

  const anyAgentActive = Object.values(agents).some((a) => a.status !== "idle");

  return (
    <div className="rounded-2xl border border-white/6 bg-white/2 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-widest text-white/30">
          Execution Graph
        </span>
        {isLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 ml-auto" />
        )}
      </div>

      {/* Graph layout */}
      <div className="flex items-center justify-center gap-0">
        <OrchestratorNode status={orchestratorStatus} />

        {/* Lines + Agents */}
        <div className="flex items-center gap-0">
          {/* Fan out lines */}
          <div className="flex flex-col gap-8 relative">
            {Object.entries(agents).map(([id, node]) => {
              const def = AGENT_DEFS[id as keyof typeof AGENT_DEFS];
              if (!def) return null;
              return (
                <div key={id} className="flex items-center gap-0">
                  <ConnectionLine
                    active={node.status === "active"}
                    success={node.status === "success"}
                    error={node.status === "error" || node.status === "interrupted"}
                  />
                  <AgentNode node={node} def={def} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trust band */}
      {anyAgentActive || events.some(e => e.type === "sub_agent_trust_event") ? (
        <TrustBand events={events} />
      ) : null}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <div className="text-center mt-2 pt-2 border-t border-white/5">
          <p className="text-xs text-white/20">Agent graph activates when you send a command</p>
        </div>
      )}
    </div>
  );
}
