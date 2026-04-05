"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, MessageSquare, Network,
  CheckCircle, XCircle, Shield, Zap, Loader2, AlertTriangle,
} from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

// --- Design tokens ------------------------------------------------------------
const GH  = { color: "#4F8EFF", bg: "rgba(79,142,255,0.08)",  border: "rgba(79,142,255,0.28)"  };
const SL  = { color: "#E01E8C", bg: "rgba(224,30,140,0.08)",  border: "rgba(224,30,140,0.28)"  };
const ORC = { color: "#00D9FF", bg: "rgba(0,217,255,0.07)",   border: "rgba(0,217,255,0.28)"   };
const TRUST = { GREEN: "#00E57A", YELLOW: "#F5C510", RED: "#FF3D5A" };

type NodeStatus = "idle" | "active" | "success" | "error" | "interrupted";

interface AgentNode { id: string; status: NodeStatus; tools: string[]; lastTool?: string; }

// --- Connection line -----------------------------------------------------------
function SignalLine({
  active, success, error,
  color, reverse = false,
}: {
  active: boolean; success: boolean; error: boolean;
  color: string; reverse?: boolean;
}) {
  const lineColor = active ? color
    : success ? TRUST.GREEN
    : error   ? TRUST.RED
    : "rgba(255,255,255,0.055)";

  return (
    <div className="relative flex flex-1 items-center" style={{ height: 2 }}>
      {/* Track */}
      <div
        className="h-px w-full transition-colors duration-700"
        style={{ background: lineColor }}
      />
      {/* Traveling packet */}
      {active && (
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 7, height: 7,
            background: color,
            boxShadow: `0 0 8px ${color}, 0 0 18px ${color}55`,
          }}
          animate={{ left: reverse ? ["calc(100% + 4px)", "-4px"] : ["-4px", "calc(100% + 4px)"] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear", repeatDelay: 0.35 }}
        />
      )}
      {/* Glow pulse on the line when active */}
      {active && (
        <motion.div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to ${reverse ? "left" : "right"}, transparent, ${color}22, transparent)` }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      )}
    </div>
  );
}

// --- Agent node ----------------------------------------------------------------
function AgentNode({
  label, icon, status, lastTool,
  color, bg, border,
}: {
  label: string; icon: React.ReactNode; status: NodeStatus; lastTool?: string;
  color: string; bg: string; border: string;
}) {
  const isActive   = status === "active";
  const isSuccess  = status === "success";
  const isError    = status === "error" || status === "interrupted";

  const nodeBg     = isActive ? bg : isSuccess ? "rgba(0,229,122,0.06)" : isError ? "rgba(255,61,90,0.05)" : "rgba(255,255,255,0.02)";
  const nodeBorder = isActive ? border : isSuccess ? "rgba(0,229,122,0.28)" : isError ? "rgba(255,61,90,0.28)" : "rgba(255,255,255,0.07)";
  const nodeGlow   = isActive ? `0 0 28px ${color}28, 0 0 60px ${color}12` : "none";
  const iconColor  = isActive ? color : isSuccess ? TRUST.GREEN : isError ? TRUST.RED : "rgba(255,255,255,0.18)";
  const labelColor = isActive ? color : isSuccess ? TRUST.GREEN : "rgba(255,255,255,0.28)";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Node box */}
      <motion.div
        className="relative flex h-22 w-22 items-center justify-center rounded-[20px] border transition-all duration-500"
        style={{ background: nodeBg, borderColor: nodeBorder, boxShadow: nodeGlow }}
        animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 2.2, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
      >
        {/* Pulse ring */}
        {isActive && (
          <motion.div
            className="absolute -inset-px rounded-[20px] border"
            style={{ borderColor: border }}
            animate={{ scale: [1, 1.28], opacity: [0.55, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        {/* Icon */}
        <div style={{ color: iconColor }} className="transition-colors duration-300">
          {icon}
        </div>

        {/* Status dot/icon */}
        <div className="absolute -top-2 -right-2">
          {isActive && (
            <motion.div
              className="h-3.75 w-3.75 rounded-full border-2 border-[#020309]"
              style={{ background: color, boxShadow: `0 0 7px ${color}` }}
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 0.75, repeat: Infinity }}
            />
          )}
          {isSuccess     && <CheckCircle  className="h-3.75 w-3.75 text-[#00E57A] drop-shadow" />}
          {status === "error"       && <XCircle      className="h-3.75 w-3.75 text-[#FF3D5A] drop-shadow" />}
          {status === "interrupted" && <Shield       className="h-3.75 w-3.75 text-[#F5C510] drop-shadow" />}
        </div>
      </motion.div>

      {/* Label row */}
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.16em] transition-colors duration-300"
          style={{ color: labelColor }}
        >
          {label}
        </span>

        <AnimatePresence mode="wait">
          {lastTool && isActive && (
            <motion.div
              key={lastTool}
              initial={{ opacity: 0, y: -3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 3 }}
              className="max-w-28 truncate rounded-full border px-2.5 py-0.5 text-[10px] font-medium"
              style={{ borderColor: `${color}28`, background: `${color}0d`, color: `${color}bb` }}
            >
              {lastTool.replace(/_/g, " ")}
            </motion.div>
          )}
          {isSuccess && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-1 text-[10px]" style={{ color: `${TRUST.GREEN}88` }}>
              <Zap className="h-2.5 w-2.5" />
              Done
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Orchestrator node ---------------------------------------------------------
function OrchestratorNode({ status, isLoading }: { status: NodeStatus; isLoading: boolean }) {
  const isActive  = status === "active" || isLoading;
  const isSuccess = status === "success";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Node box � slightly larger */}
      <motion.div
        className="relative flex h-26 w-26 items-center justify-center rounded-[22px] border transition-all duration-500"
        style={{
          background:   isActive ? ORC.bg : isSuccess ? "rgba(0,229,122,0.06)" : "rgba(255,255,255,0.02)",
          borderColor:  isActive ? ORC.border : isSuccess ? "rgba(0,229,122,0.28)" : "rgba(255,255,255,0.08)",
          boxShadow:    isActive ? `0 0 40px ${ORC.color}22, 0 0 80px ${ORC.color}0c` : "none",
        }}
        animate={isActive ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={{ duration: 2.8, repeat: isActive ? Infinity : 0, ease: "easeInOut" }}
      >
        {/* Double pulse rings */}
        {isActive && (
          <>
            <motion.div
              className="absolute -inset-px rounded-[22px] border border-[#00D9FF]/25"
              animate={{ scale: [1, 1.22], opacity: [0.5, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              className="absolute -inset-px rounded-[22px] border border-[#00D9FF]/12"
              animate={{ scale: [1, 1.4], opacity: [0.35, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
            />
          </>
        )}

        <Network
          className="h-9 w-9 relative z-10 transition-colors duration-300"
          style={{ color: isActive ? ORC.color : isSuccess ? TRUST.GREEN : "rgba(255,255,255,0.18)" }}
        />

        {/* Status dot */}
        {isActive && (
          <motion.div
            className="absolute -top-2 -right-2 h-3.75 w-3.75 rounded-full border-2 border-[#020309] bg-[#00D9FF]"
            style={{ boxShadow: "0 0 8px #00D9FF" }}
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 0.85, repeat: Infinity }}
          />
        )}
        {isSuccess && (
          <div className="absolute -top-2 -right-2 h-3.75 w-3.75 rounded-full border-2 border-[#020309] bg-[#00E57A]" />
        )}

        {/* Spinner */}
        {isLoading && (
          <div className="absolute bottom-2 right-2">
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: `${ORC.color}80` }} />
          </div>
        )}
      </motion.div>

      {/* Label */}
      <div className="flex flex-col items-center gap-1.5">
        <span
          className="text-[11px] font-bold uppercase tracking-[0.16em] transition-colors duration-300"
          style={{ color: isActive ? ORC.color : isSuccess ? TRUST.GREEN : "rgba(255,255,255,0.28)" }}
        >
          Orchestrator
        </span>
        {isActive && (
          <motion.span
            className="text-[10px]"
            style={{ color: `${ORC.color}60` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            Processing
          </motion.span>
        )}
      </div>
    </div>
  );
}

// --- Trust band ----------------------------------------------------------------
function TrustBand({ events }: { events: AgentEvent[] }) {
  const trustEvts = events.filter((e) => e.type === "sub_agent_trust_event");
  if (trustEvts.length === 0) return null;

  const counts = { GREEN: 0, YELLOW: 0, RED: 0 };
  trustEvts.forEach((e) => {
    const z = (e.data.zone as string) ?? "GREEN";
    if (z in counts) counts[z as keyof typeof counts]++;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2.5 justify-center pt-1"
    >
      <Shield className="h-3 w-3 shrink-0" style={{ color: "rgba(255,255,255,0.18)" }} />
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.18)" }}>
        Trust
      </span>
      {(["GREEN", "YELLOW", "RED"] as const).map((zone) =>
        counts[zone] > 0 ? (
          <span
            key={zone}
            className="flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold"
            style={{
              color: TRUST[zone],
              borderColor: `${TRUST[zone]}28`,
              background: `${TRUST[zone]}0c`,
            }}
          >
            {zone === "RED" && <AlertTriangle className="h-2.5 w-2.5" />}
            {counts[zone]}� {zone}
          </span>
        ) : null
      )}
    </motion.div>
  );
}

// --- Main export ---------------------------------------------------------------
export function ExecutionGraph({ events, isLoading }: { events: AgentEvent[]; isLoading: boolean }) {
  const { orchStatus, agents } = useMemo(() => {
    const map: Record<string, AgentNode> = {
      github: { id: "github", status: "idle", tools: [] },
      slack:  { id: "slack",  status: "idle", tools: [] },
    };
    let orch: NodeStatus = "idle";
    const active = new Set<string>();

    for (const e of events) {
      switch (e.type) {
        case "orchestrating":
        case "task_plan":
          orch = "active"; break;
        case "agent_delegation": {
          const id = e.data.agentId as string;
          if (map[id]) { map[id].status = "active"; active.add(id); }
          break;
        }
        case "sub_agent_tool_call": {
          const id = e.data.agentId as string;
          if (map[id]) { map[id].lastTool = e.data.tool as string; map[id].tools.push(e.data.tool as string); }
          break;
        }
        case "interrupt": {
          const id = e.data.agentId as string;
          if (map[id]) { map[id].status = "interrupted"; active.delete(id); }
          break;
        }
        case "synthesizing":
          orch = "active";
          active.forEach((id) => { if (map[id]?.status === "active") map[id].status = "success"; });
          active.clear(); break;
        case "done":
        case "step_complete":
          orch = "success";
          active.forEach((id) => { if (map[id]?.status === "active") map[id].status = "success"; });
          active.clear(); break;
        case "error":
          orch = "error";
          active.forEach((id) => { if (map[id]?.status === "active") map[id].status = "error"; });
          active.clear(); break;
      }
    }

    if (isLoading && orch === "idle") orch = "active";
    return { orchStatus: orch, agents: map };
  }, [events, isLoading]);

  const gh = agents.github;
  const sl = agents.slack;
  const ghActive = gh.status === "active";
  const slActive = sl.status === "active";
  const orchActive = orchStatus === "active" || isLoading;

  const hasTrust = events.some((e) => e.type === "sub_agent_trust_event");

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      {/* Graph row */}
      <div className="relative flex items-center gap-0">
        {/* Background radial glow when live */}
        {orchActive && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-50"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,217,255,0.045) 0%, transparent 65%)" }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 3.5, repeat: Infinity }}
          />
        )}

        {/* GitHub */}
        <AgentNode
          label="GitHub"
          icon={<GitBranch className="h-6.5 w-6.5" />}
          status={gh.status}
          lastTool={gh.lastTool}
          color={GH.color} bg={GH.bg} border={GH.border}
        />

        {/* GitHub ? Orchestrator */}
        <SignalLine
          active={ghActive || orchActive}
          success={gh.status === "success"}
          error={gh.status === "error"}
          color={GH.color}
        />

        {/* Orchestrator */}
        <OrchestratorNode status={orchStatus} isLoading={isLoading} />

        {/* Orchestrator → Slack */}
        <SignalLine
          active={slActive || orchActive}
          success={sl.status === "success"}
          error={sl.status === "error"}
          color={SL.color}
        />

        {/* Slack */}
        <AgentNode
          label="Slack"
          icon={<MessageSquare className="h-6.5 w-6.5" />}
          status={sl.status}
          lastTool={sl.lastTool}
          color={SL.color} bg={SL.bg} border={SL.border}
        />
      </div>

      {/* Trust band */}
      {hasTrust && <TrustBand events={events} />}

      {/* Empty state */}
      {!isLoading && events.length === 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[12px]"
          style={{ color: "rgba(255,255,255,0.14)" }}
        >
          Issue a command to activate the agent network
        </motion.p>
      )}
    </div>
  );
}