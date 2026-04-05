"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CommandInput } from "@/components/command-input";
import { AgentActivityFeed } from "@/components/agent-activity-feed";
import { StepUpNotification } from "@/components/step-up-notification";
import { ExecutionGraph } from "@/components/execution-graph";
import { RotateCcw, Play } from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

const SUGGESTIONS = [
  "List open issues",
  "Post sprint update to #general",
  "Create issue: production bug",
  "Merge PR after approval",
];

export default function DashboardPage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interruptEvent, setInterruptEvent] = useState<AgentEvent | null>(null);
  const [completedEvents, setCompletedEvents] = useState<AgentEvent[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayEvents, setReplayEvents] = useState<AgentEvent[]>([]);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = useCallback(async (prompt: string) => {
    setIsLoading(true);
    setEvents([]);
    setReplayEvents([]);
    setInterruptEvent(null);
    try {
      const response = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        const err = await response.json();
        setEvents([{ type: "error", data: { message: err.error || "Request failed" }, timestamp: new Date().toISOString() }]);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      const collected: AgentEvent[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: AgentEvent = JSON.parse(line.slice(6));
              collected.push(event);
              setEvents((prev) => [...prev, event]);
              if (event.type === "interrupt") setInterruptEvent(event);
            } catch { /* skip malformed */ }
          }
        }
      }
      setCompletedEvents(collected);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection lost";
      setEvents((prev) => [...prev, { type: "error", data: { message: msg }, timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReplay = useCallback(() => {
    if (isReplaying || completedEvents.length === 0) return;
    setIsReplaying(true);
    setReplayEvents([]);
    let i = 0;
    const step = () => {
      if (i >= completedEvents.length) { setIsReplaying(false); return; }
      setReplayEvents((prev) => [...prev, completedEvents[i++]]);
      replayTimerRef.current = setTimeout(step, 380);
    };
    step();
  }, [completedEvents, isReplaying]);

  const displayEvents = isReplaying ? replayEvents : events;
  const hasActivity = displayEvents.length > 0;

  const trustStats = displayEvents.reduce((acc, e) => {
    if (e.type === "sub_agent_trust_event" || e.type === "trust_event") {
      const z = (e.data.zone as string) || "GREEN";
      acc[z] = (acc[z] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex h-full flex-col">

      {/* ── Graph section ──────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 py-10 min-h-0">
        <ExecutionGraph
          events={displayEvents}
          isLoading={isLoading && !isReplaying}
        />

        {/* Trust stats + replay controls */}
        <AnimatePresence>
          {(Object.keys(trustStats).length > 0 || (!isLoading && completedEvents.length > 0)) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2.5 flex-wrap justify-center"
            >
              {trustStats["GREEN"] ? (
                <span className="flex items-center gap-1.5 rounded-full border border-[#00E57A]/18 bg-[#00E57A]/6 px-3 py-1 text-[11px] font-medium text-[#00E57A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00E57A]" />
                  {trustStats["GREEN"]} auto
                </span>
              ) : null}
              {trustStats["YELLOW"] ? (
                <span className="flex items-center gap-1.5 rounded-full border border-[#F5C510]/18 bg-[#F5C510]/6 px-3 py-1 text-[11px] font-medium text-[#F5C510]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#F5C510]" />
                  {trustStats["YELLOW"]} medium
                </span>
              ) : null}
              {trustStats["RED"] ? (
                <span className="flex items-center gap-1.5 rounded-full border border-[#FF3D5A]/18 bg-[#FF3D5A]/6 px-3 py-1 text-[11px] font-medium text-[#FF3D5A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF3D5A]" />
                  {trustStats["RED"]} high risk
                </span>
              ) : null}
              {!isLoading && completedEvents.length > 0 && (
                <button
                  onClick={handleReplay}
                  disabled={isReplaying}
                  className="flex items-center gap-1.5 rounded-full border border-white/7 bg-white/3 px-3 py-1 text-[11px] text-white/35 transition-all hover:border-white/13 hover:text-white/60 disabled:opacity-40"
                >
                  {isReplaying
                    ? <><Play className="h-3 w-3" /> Replaying…</>
                    : <><RotateCcw className="h-3 w-3" /> Replay</>}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Activity feed (slides up when events exist) ────── */}
      <AnimatePresence>
        {hasActivity && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="shrink-0 overflow-hidden border-t border-white/4"
          >
            <div className="max-h-44 overflow-y-auto">
              <AgentActivityFeed events={displayEvents} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Command input ───────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/4 bg-[#020309]/70 px-8 py-4">
        <CommandInput onSubmit={handleSubmit} isLoading={isLoading} />
        <AnimatePresence>
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 flex items-center gap-2 flex-wrap"
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSubmit(s)}
                  className="flex items-center gap-1.5 rounded-full border border-white/5.5 bg-transparent px-3 py-1 text-[11px] text-white/28 transition-all hover:border-white/11 hover:text-white/55"
                >
                  <span className="h-1 w-1 rounded-full bg-white/18" />
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Step-up auth fullscreen overlay ────────────────── */}
      <StepUpNotification event={interruptEvent} onDismiss={() => setInterruptEvent(null)} />
    </div>
  );
}
