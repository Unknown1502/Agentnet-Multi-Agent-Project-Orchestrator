"use client";

import { AlertTriangle, ShieldCheck, X, Bell, RefreshCw } from "lucide-react";
import type { AgentEvent } from "@/lib/agent/state";

interface StepUpNotificationProps {
  event: AgentEvent | null;
  onDismiss: () => void;
}

export function StepUpNotification({ event, onDismiss }: StepUpNotificationProps) {
  if (!event || event.type !== "interrupt") return null;

  const message = (event.data.message as string) || "";
  const connection = (event.data.connection as string) || "";
  const agentId = (event.data.agentId as string) || "";

  // TokenVaultInterrupt fires when Token Vault exchange fails (e.g. connection not
  // authorized yet). Show a reconnect prompt instead of a Guardian instruction.
  const isTokenVaultError = message.toLowerCase().includes("token vault") ||
    message.toLowerCase().includes("authorization required to access");

  const providerLabel = agentId
    ? agentId.charAt(0).toUpperCase() + agentId.slice(1)
    : connection || "provider";

  return (
    <div className="fixed bottom-6 right-6 z-50 w-90 animate-in slide-in-from-bottom-4">
      {/* Glow */}
      <div className="absolute inset-0 rounded-2xl bg-orange-500/10 blur-xl" />

      <div className="relative rounded-2xl border border-orange-500/25 bg-[#0f0a04] p-5 shadow-2xl shadow-orange-500/10 backdrop-blur-xl">
        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-linear-to-r from-transparent via-orange-500/50 to-transparent" />

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
            <Bell className="h-5 w-5 text-orange-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-orange-200">
                {isTokenVaultError ? `${providerLabel} Not Connected` : "Step-Up Required"}
              </h4>
              <button
                onClick={onDismiss}
                className="flex h-6 w-6 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-white/10 hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-orange-300/70">
              {isTokenVaultError
                ? `The agent needs access to ${providerLabel}. Connect your account to continue.`
                : message || "Approve the action in your Auth0 Guardian app."}
            </p>
            {isTokenVaultError ? (
              <a
                href="/dashboard/connections"
                className="mt-3 flex items-center gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-xs text-orange-300 transition-colors hover:bg-orange-500/20"
              >
                <RefreshCw className="h-3.5 w-3.5 shrink-0" />
                Go to Connected Accounts
              </a>
            ) : (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-500/15 bg-orange-500/7 px-3 py-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                <span className="text-xs text-orange-400/80">Check your Auth0 Guardian app</span>
                <AlertTriangle className="ml-auto h-3 w-3 text-orange-500/60" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
