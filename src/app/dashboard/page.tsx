"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CommandInput } from "@/components/command-input";
import { AgentActivityFeed } from "@/components/agent-activity-feed";
import { StepUpNotification } from "@/components/step-up-notification";
import { ExecutionGraph } from "@/components/execution-graph";
import {
  Bot,
  Zap,
  GitBranch,
  MessageSquare,
  BookOpen,
  Sparkles,
  ArrowRight,
  RotateCcw,
  ChevronRight,
  Play,
} from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

const SUGGESTIONS = [
  "List open issues on my GitHub repo",
  "Post a sprint update to #general on Slack",
  "Create a GitHub issue for the login bug",
  "Search my Notion pages for meeting notes",
];

const AGENTS = [
  {
    id: "github",
    label: "GitHub",
    icon: GitBranch,
    pill: "border-violet-500/20 bg-violet-500/8 text-violet-300",
    dot: "bg-violet-400",
  },
  {
    id: "slack",
    label: "Slack",
    icon: MessageSquare,
    pill: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300",
    dot: "bg-emerald-400",
  },
  {
    id: "notion",
    label: "Notion",
    icon: BookOpen,
    pill: "border-amber-500/20 bg-amber-500/8 text-amber-300",
    dot: "bg-amber-400",
  },
];

export default function DashboardPage() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [interruptEvent, setInterruptEvent] = useState<AgentEvent | null>(null);
  // Replay state
  const [replayEvents, setReplayEvents] = useState<AgentEvent[]>([]);
  const [isReplaying, setIsReplaying] = useState(false);
  const [completedEvents, setCompletedEvents] = useState<AgentEvent[]>([]);
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
        setEvents([
          {
            type: "error",
            data: { message: err.error || "Request failed" },
            timestamp: new Date().toISOString(),
          },
        ]);
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
            } catch {
              // skip malformed
            }
          }
        }
      }
      setCompletedEvents(collected);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection lost";
      setEvents((prev) => [
        ...prev,
        {
          type: "error",
          data: {
            message: prev.length > 0
              ? `Stream interrupted: ${msg}. If this keeps happening, the agent request may be taking too long.`
              : `Could not reach the agent server. Check your connection.`,
          },
          timestamp: new Date().toISOString(),
        },
      ]);
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
      if (i >= completedEvents.length) {
        setIsReplaying(false);
        return;
      }
      setReplayEvents((prev) => [...prev, completedEvents[i]]);
      i++;
      replayTimerRef.current = setTimeout(step, 420);
    };
    step();
  }, [completedEvents, isReplaying]);

  // Derive trust stats from events
  const trustStats = events.reduce(
    (acc, e) => {
      if (e.type === "sub_agent_trust_event" || e.type === "trust_event") {
        const zone = (e.data.zone as string) || "GREEN";
        acc[zone] = (acc[zone] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );
  const totalChecks = Object.values(trustStats).reduce((s, n) => s + n, 0);

  const displayEvents = isReplaying ? replayEvents : events;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">Command Center</h1>
          <p className="mt-1 text-sm text-white/35">
            Orchestrate your GitHub, Slack &amp; Notion agents with natural language
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-400"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-500" />
              </span>
              Running
            </motion.span>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-white/6 bg-white/2 px-3 py-1.5 text-xs text-white/40">
            <Bot className="h-3.5 w-3.5 text-cyan-400" />
            <span className="font-bold text-white">3</span>&nbsp;agents
          </div>
        </div>
      </div>

      {/* Agent status pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {AGENTS.map((agent) => (
          <span
            key={agent.id}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${agent.pill}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${agent.dot} ${isLoading ? "animate-pulse" : ""}`} />
            <agent.icon className="h-3 w-3" />
            {agent.label}
            <span className="text-white/30 font-normal">Ready</span>
          </span>
        ))}
      </div>

      {/* Command card */}
      <div
        className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          isLoading
            ? "border-cyan-500/25 shadow-lg shadow-cyan-500/6"
            : "border-white/7 hover:border-white/10"
        } bg-white/2`}
      >
        <div
          className={`h-px w-full bg-linear-to-r from-transparent via-cyan-500/40 to-transparent transition-opacity duration-500 ${
            isLoading ? "opacity-100" : "opacity-40"
          }`}
        />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Command
            </span>
          </div>
          <CommandInput onSubmit={handleSubmit} isLoading={isLoading} />
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSubmit(s)}
                disabled={isLoading}
                className="group flex items-center gap-1 rounded-full border border-white/6 bg-white/2 px-3 py-1 text-xs text-white/30 transition-all hover:border-cyan-500/25 hover:bg-cyan-500/6 hover:text-cyan-300 disabled:opacity-40"
              >
                <ArrowRight className="h-3 w-3 opacity-0 max-w-0 overflow-hidden transition-all group-hover:opacity-100 group-hover:max-w-4 group-hover:mr-0.5" />
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step-up notification — fullscreen overlay */}
      <StepUpNotification
        event={interruptEvent}
        onDismiss={() => setInterruptEvent(null)}
      />

      {/* Activity area */}
      <AnimatePresence mode="wait">
        {displayEvents.length > 0 ? (
          <motion.div
            key="activity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Execution graph */}
            <ExecutionGraph events={displayEvents} isLoading={isLoading && !isReplaying} />

            {/* Trust Insights + Replay row */}
            {totalChecks > 0 || completedEvents.length > 0 ? (
              <div className="flex items-stretch gap-3 flex-wrap">
                {/* Trust insights pill row */}
                {totalChecks > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 px-4 py-2.5 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mr-1">Trust Checks</span>
                    {trustStats["GREEN"] ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/8 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {trustStats["GREEN"]} Low Risk
                      </span>
                    ) : null}
                    {trustStats["YELLOW"] ? (
                      <span className="flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/8 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                        {trustStats["YELLOW"]} Medium
                      </span>
                    ) : null}
                    {trustStats["RED"] ? (
                      <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/8 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        {trustStats["RED"]} High Risk
                      </span>
                    ) : null}
                    <span className="ml-1 text-xs text-white/25">{totalChecks} total</span>
                  </div>
                )}

                {/* Replay button */}
                {!isLoading && completedEvents.length > 0 && (
                  <button
                    onClick={handleReplay}
                    disabled={isReplaying}
                    className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-xs font-medium text-white/50 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/6 hover:text-cyan-300 disabled:opacity-40"
                  >
                    {isReplaying ? (
                      <>
                        <Play className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                        Replaying…
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Replay Execution
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null}

            {/* Activity log */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white/70">Agent Activity</h2>
                  <span className="rounded-full border border-white/8 bg-white/3 px-2 py-0.5 text-[10px] text-white/40">
                    {displayEvents.length}
                  </span>
                  {isReplaying && (
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/8 px-2 py-0.5 text-[10px] text-cyan-400 animate-pulse">
                      Replay
                    </span>
                  )}
                </div>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    isLoading && !isReplaying
                      ? "border-cyan-500/25 bg-cyan-500/8 text-cyan-400"
                      : isReplaying
                      ? "border-violet-500/25 bg-violet-500/8 text-violet-400"
                      : "border-emerald-500/20 bg-emerald-500/8 text-emerald-400"
                  }`}
                >
                  {isLoading && !isReplaying ? (
                    <>
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-cyan-500" />
                      </span>
                      Live
                    </>
                  ) : isReplaying ? (
                    <>
                      <ChevronRight className="h-3 w-3" />
                      Replay
                    </>
                  ) : (
                    "Complete"
                  )}
                </span>
              </div>
              <div className="rounded-2xl border border-white/6 bg-white/2 p-4">
                <AgentActivityFeed events={displayEvents} />
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/2 py-24 text-center"
          >
            <div className="animate-float relative mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-linear-to-br from-cyan-500/10 to-violet-500/10 shadow-lg shadow-cyan-500/5">
                <Bot className="h-7 w-7 text-white/20" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/20 shadow-sm shadow-cyan-500/20">
                <Sparkles className="h-2.5 w-2.5 text-cyan-400" />
              </div>
            </div>
            <p className="font-semibold text-white/40 text-sm">Ready for your command</p>
            <p className="mt-1.5 text-xs text-white/20">
              Type a prompt above or click a suggestion to get started
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

