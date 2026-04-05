"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, RefreshCw, Smartphone } from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

const TIMEOUT = 120;
const CIRCUMFERENCE = 2 * Math.PI * 45; // r=45 → ~282.7

interface StepUpNotificationProps {
  event: AgentEvent | null;
  onDismiss: () => void;
}

export function StepUpNotification({ event, onDismiss }: StepUpNotificationProps) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT);

  const isVisible = !!(event?.type === "interrupt");
  const message   = (event?.data?.message  as string) || "";
  const agentId   = (event?.data?.agentId  as string) || "";

  const isTokenError =
    message.toLowerCase().includes("token vault") ||
    message.toLowerCase().includes("authorization required");

  const providerLabel = agentId
    ? agentId.charAt(0).toUpperCase() + agentId.slice(1)
    : "the provider";

  // Countdown timer
  useEffect(() => {
    if (!isVisible) return;
    setSecondsLeft(TIMEOUT);
    const id = setInterval(() => {
      setSecondsLeft((s) => { if (s <= 1) { clearInterval(id); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [isVisible, event]);

  // ESC to dismiss
  const handleKey = useCallback((e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); }, [onDismiss]);
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const progress      = secondsLeft / TIMEOUT;
  const strokeOffset  = CIRCUMFERENCE * (1 - progress);
  const isUrgent      = secondsLeft <= 15 && !isTokenError;
  const accentColor   = isTokenError ? "#4F8EFF" : "#FF3D5A";
  const accentDim     = isTokenError ? "rgba(79,142,255,0.08)" : "rgba(255,61,90,0.08)";
  const accentBorder  = isTokenError ? "rgba(79,142,255,0.22)" : "rgba(255,61,90,0.22)";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-[#020309]/88 backdrop-blur-2xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Ambient radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(ellipse at center, ${accentColor}0d 0%, transparent 55%)` }}
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 flex w-full max-w-sm flex-col items-center gap-7 px-8 py-10 text-center"
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Dismiss */}
            <button
              onClick={onDismiss}
              className="absolute top-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/7 text-white/25 transition-all hover:border-white/14 hover:text-white/55"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Visual: countdown ring —or— shield icon */}
            {isTokenError ? (
              <div
                className="flex h-22 w-22 items-center justify-center rounded-2xl border"
                style={{ background: accentDim, borderColor: accentBorder }}
              >
                <Shield className="h-9 w-9" style={{ color: accentColor }} />
              </div>
            ) : (
              <div className="relative flex items-center justify-center">
                <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
                  {/* Track */}
                  <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="2" />
                  {/* Progress arc */}
                  <motion.circle
                    cx="60" cy="60" r="45"
                    fill="none"
                    stroke={accentColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    animate={{ strokeDashoffset: strokeOffset }}
                    transition={{ duration: 0.8, ease: "linear" }}
                    style={{ filter: `drop-shadow(0 0 6px ${accentColor}99)` }}
                  />
                </svg>

                {/* Center: MM:SS */}
                <div className="absolute flex flex-col items-center">
                  <motion.span
                    className="font-mono text-[28px] font-light leading-none tracking-tight"
                    style={{ color: accentColor }}
                    animate={{ opacity: isUrgent ? [1, 0.35, 1] : 1 }}
                    transition={{ duration: 0.5, repeat: isUrgent ? Infinity : 0 }}
                  >
                    {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                  </motion.span>
                  <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/25">
                    remaining
                  </span>
                </div>
              </div>
            )}

            {/* Title + body */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-white">
                {isTokenError ? `${providerLabel} Not Connected` : "Approval Required"}
              </h2>
              <p className="text-[13px] leading-relaxed text-white/40">
                {isTokenError
                  ? `Connect ${providerLabel} to give the agent access to your account.`
                  : "A sensitive action was flagged. Approve this request in your Guardian app to continue."}
              </p>
            </div>

            {/* CTA */}
            {isTokenError ? (
              <a
                href="/dashboard/connections"
                className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: accentColor,
                  boxShadow: `0 4px 24px ${accentColor}28`,
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Connect {providerLabel}
              </a>
            ) : (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/2.5 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="h-4 w-4 text-white/35" />
                    <span className="text-[13px] text-white/40">Check Guardian app</span>
                  </div>
                  <motion.span
                    className="h-2 w-2 rounded-full"
                    style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                </div>
                <button
                  onClick={onDismiss}
                  className="w-full rounded-xl border border-white/6 py-2.5 text-sm text-white/30 transition-all hover:border-white/12 hover:text-white/55"
                >
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}