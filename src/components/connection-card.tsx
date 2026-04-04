"use client";

import { GitBranch, MessageSquare, BookOpen, Loader2, Key, PlugZap } from "lucide-react";

const PROVIDER_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    headerGradient: string;
    iconRing: string;
    connectedBorder: string;
    connectedBg: string;
    connectedBadge: string;
    connectedText: string;
    btnClass: string;
  }
> = {
  github: {
    icon: <GitBranch className="h-6 w-6" />,
    headerGradient: "from-violet-600/25 via-violet-500/10 to-transparent",
    iconRing: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25",
    connectedBorder: "border-violet-500/20",
    connectedBg: "bg-violet-500/4",
    connectedBadge: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    connectedText: "text-violet-400",
    btnClass:
      "bg-linear-to-r from-violet-600 to-violet-700 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/35 hover:from-violet-500 hover:to-violet-600",
  },
  slack: {
    icon: <MessageSquare className="h-6 w-6" />,
    headerGradient: "from-emerald-600/25 via-emerald-500/10 to-transparent",
    iconRing: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25",
    connectedBorder: "border-emerald-500/20",
    connectedBg: "bg-emerald-500/4",
    connectedBadge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    connectedText: "text-emerald-400",
    btnClass:
      "bg-linear-to-r from-emerald-600 to-emerald-700 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:from-emerald-500 hover:to-emerald-600",
  },
  notion: {
    icon: <BookOpen className="h-6 w-6" />,
    headerGradient: "from-amber-600/25 via-amber-500/10 to-transparent",
    iconRing: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",
    connectedBorder: "border-amber-500/20",
    connectedBg: "bg-amber-500/4",
    connectedBadge: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    connectedText: "text-amber-400",
    btnClass:
      "bg-linear-to-r from-amber-600 to-amber-700 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:from-amber-500 hover:to-amber-600",
  },
};

interface ConnectionInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  scopes: string[];
  icon: string;
  connected: boolean;
}

interface ConnectionCardProps {
  connection: ConnectionInfo;
  onConnect: (provider: string) => void;
  isConnecting: boolean;
}

export function ConnectionCard({ connection, onConnect, isConnecting }: ConnectionCardProps) {
  const cfg = PROVIDER_CONFIG[connection.icon] ?? PROVIDER_CONFIG.github;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
        connection.connected
          ? `${cfg.connectedBorder} ${cfg.connectedBg}`
          : "border-white/7 bg-white/2 hover:border-white/12"
      }`}
    >
      {/* Gradient header */}
      <div
        className={`relative flex items-center justify-between px-5 py-4 bg-linear-to-r ${cfg.headerGradient}`}
      >
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cfg.iconRing}`}>
          {cfg.icon}
        </div>

        {connection.connected ? (
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.connectedBadge}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            Connected
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-xs text-white/30">
            <span className="h-1.5 w-1.5 rounded-full bg-white/15" />
            Not connected
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px w-full bg-white/5" />

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-white leading-tight">{connection.name}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/35">{connection.description}</p>

        {connection.scopes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {connection.scopes.map((scope) => (
              <span
                key={scope}
                className="inline-flex rounded-md border border-white/6 bg-white/3 px-2 py-0.5 text-[10px] text-white/30"
              >
                {scope}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4">
          {connection.connected ? (
            <div className={`flex items-center gap-2 text-xs font-medium ${cfg.connectedText}`}>
              <Key className="h-3.5 w-3.5" />
              Token secured in Auth0 Vault
            </div>
          ) : (
            <button
              onClick={() => onConnect(connection.id)}
              disabled={isConnecting}
              className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 ${cfg.btnClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Connecting…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <PlugZap className="h-3.5 w-3.5" />
                  Connect {connection.name}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ICON_MAP: Record<string, React.ReactNode> = {
  github: <GitBranch className="h-5 w-5" />,
  slack: <MessageSquare className="h-5 w-5" />,
  notion: <BookOpen className="h-5 w-5" />,
};

const COLOR_MAP: Record<string, { icon: string; ring: string; badge: string; btn: string; glow: string }> = {
  github: {
    icon: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
    ring: "hover:border-violet-500/25 hover:shadow-violet-500/5",
    badge: "border-violet-500/20 bg-violet-500/8 text-violet-400",
    btn: "border-violet-500/20 bg-violet-500/8 text-violet-300 hover:border-violet-500/40 hover:bg-violet-500/15 hover:text-violet-200",
    glow: "shadow-violet-500/10",
  },
  slack: {
    icon: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
    ring: "hover:border-emerald-500/25 hover:shadow-emerald-500/5",
    badge: "border-emerald-500/20 bg-emerald-500/8 text-emerald-400",
    btn: "border-emerald-500/20 bg-emerald-500/8 text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-200",
    glow: "shadow-emerald-500/10",
  },
  notion: {
    icon: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
    ring: "hover:border-amber-500/25 hover:shadow-amber-500/5",
    badge: "border-amber-500/20 bg-amber-500/8 text-amber-400",
    btn: "border-amber-500/20 bg-amber-500/8 text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/15 hover:text-amber-200",
    glow: "shadow-amber-500/10",
  },
};

interface ConnectionInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  scopes: string[];
  icon: string;
  connected: boolean;
}

interface ConnectionCardProps {
  connection: ConnectionInfo;
  onConnect: (provider: string) => void;
  isConnecting: boolean;
}

