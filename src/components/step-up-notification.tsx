"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldAlert, AlertTriangle, X, Smartphone, RefreshCw, Clock } from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

interface StepUpNotificationProps {
  event: AgentEvent | null;
  onDismiss: () => void;
}

const TIMEOUT_SECONDS = 120;

export function StepUpNotification({ event, onDismiss }: StepUpNotificationProps) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);

  const isVisible = !!(event && event.type === "interrupt");

  const message = (event?.data?.message as string) || "";
  const agentId = (event?.data?.agentId as string) || "";
  const isTokenVaultError =
    message.toLowerCase().includes("token vault") ||
    message.toLowerCase().includes("authorization required to access") ||
    message.toLowerCase().includes("authorization required for");

  const providerLabel = agentId
    ? agentId.charAt(0).toUpperCase() + agentId.slice(1)
    : "the provider";

  // Reset + start countdown whenever a new interrupt event arrives
  useEffect(() => {
    if (!isVisible) return;
    setSecondsLeft(TIMEOUT_SECONDS);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(id); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isVisible, event]);

  const progress = secondsLeft / TIMEOUT_SECONDS;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isTokenVaultError ? onDismiss : undefined}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border bg-[#080b18] shadow-2xl">

              {/* Glow border */}
              <div className={`absolute inset-0 rounded-3xl pointer-events-none ${
                isTokenVaultError
                  ? "shadow-[inset_0_0_0_1.5px_rgba(6,182,212,0.35)]"
                  : "shadow-[inset_0_0_0_1.5px_rgba(249,115,22,0.40)]"
              }`} />

              {/* Animated top bar */}
              <motion.div
                className={`h-1 ${isTokenVaultError ? "bg-linear-to-r from-cyan-500 via-violet-500 to-cyan-500" : "bg-linear-to-r from-orange-600 via-red-500 to-orange-600"}`}
                style={{ backgroundSize: "200% 200%" }}
              />

              <div className="p-7">
                {/* Icon + title */}
                <div className="flex items-center gap-4 mb-6">
                  <motion.div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border-2 ${
                      isTokenVaultError
                        ? "border-cyan-500/40 bg-cyan-500/10"
                        : "border-orange-500/40 bg-orange-500/10"
                    }`}
                    animate={!isTokenVaultError ? {
                      boxShadow: [
                        "0 0 0 0 rgba(249,115,22,0.4)",
                        "0 0 0 10px rgba(249,115,22,0)",
                        "0 0 0 0 rgba(249,115,22,0)",
                      ],
                    } : {}}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  >
                    {isTokenVaultError
                      ? <Shield className="h-6 w-6 text-cyan-400" />
                      : <ShieldAlert className="h-6 w-6 text-orange-400" />
                    }
                  </motion.div>
                  <div>
                    <h2 className={`text-lg font-bold ${isTokenVaultError ? "text-cyan-100" : "text-orange-100"}`}>
                      {isTokenVaultError ? `${providerLabel} Not Connected` : "Security Approval Required"}
                    </h2>
                    <p className="text-xs text-white/35 mt-0.5">
                      {isTokenVaultError ? "Token Vault access unavailable" : "High-risk action detected · Guardian push sent"}
                    </p>
                  </div>
                  <button
                    onClick={onDismiss}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border border-white/8 text-white/30 hover:bg-white/6 hover:text-white/60 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Message box */}
                <div className={`rounded-2xl border px-4 py-3.5 mb-5 ${
                  isTokenVaultError
                    ? "border-cyan-500/20 bg-cyan-500/5"
                    : "border-orange-500/20 bg-orange-500/5"
                }`}>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {isTokenVaultError
                      ? `The ${providerLabel} agent needs your OAuth credentials to operate. Connect your account so Auth0 Token Vault can securely exchange tokens on your behalf.`
                      : message || "A high-risk action requires your explicit approval. Check your Guardian app or email."}
                  </p>
                </div>

                {isTokenVaultError ? (
                  <a
                    href="/dashboard/connections"
                    className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-linear-to-r from-cyan-600 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-violet-500 hover:shadow-cyan-500/30 active:scale-[0.98]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Connect {providerLabel} Account
                  </a>
                ) : (
                  <div className="space-y-3">
                    {/* Countdown bar */}
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-orange-400/60 shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-white/6 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-linear-to-r from-orange-500 to-red-500"
                          style={{ width: `${progress * 100}%` }}
                          transition={{ duration: 1, ease: "linear" }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-orange-300/60 w-10 text-right">
                        {secondsLeft}s
                      </span>
                    </div>

                    {/* Guardian instruction */}
                    <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/3 px-4 py-3">
                      <Smartphone className="h-5 w-5 text-orange-400/70 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-white/70">Open Auth0 Guardian App</p>
                        <p className="text-xs text-white/35 mt-0.5">Push notification sent · Approve to continue</p>
                      </div>
                      <motion.div
                        className="ml-auto h-2.5 w-2.5 rounded-full bg-orange-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500/50 shrink-0" />
                      <p className="text-xs text-white/30">This alert will auto-dismiss in {secondsLeft}s</p>
                    </div>

                    <button
                      onClick={onDismiss}
                      className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/6 hover:text-white/70"
                    >
                      Dismiss notification
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
