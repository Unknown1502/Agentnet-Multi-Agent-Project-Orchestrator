"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Link2, ScrollText, Shield, LogOut, Zap, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    activeText: "text-cyan-400",
    activeDot: "bg-cyan-400",
    activeBar: "bg-cyan-400",
    activeShadow: "shadow-cyan-400/50",
  },
  {
    label: "Connections",
    href: "/dashboard/connections",
    icon: Link2,
    activeText: "text-violet-400",
    activeDot: "bg-violet-400",
    activeBar: "bg-violet-400",
    activeShadow: "shadow-violet-400/50",
  },
  {
    label: "Audit Trail",
    href: "/dashboard/audit",
    icon: ScrollText,
    activeText: "text-amber-400",
    activeDot: "bg-amber-400",
    activeBar: "bg-amber-400",
    activeShadow: "shadow-amber-400/50",
  },
  {
    label: "Trust Zones",
    href: "/dashboard/trust",
    icon: Shield,
    activeText: "text-emerald-400",
    activeDot: "bg-emerald-400",
    activeBar: "bg-emerald-400",
    activeShadow: "shadow-emerald-400/50",
  },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="relative z-20 flex h-full w-60 shrink-0 flex-col border-r border-white/5 bg-[#060812]/95 backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-white/5 px-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-500/25">
          <Bot className="h-4 w-4 text-white" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-[#060812] bg-emerald-500" />
          </span>
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-white leading-none">AgentNet</p>
          <p className="text-[10px] text-white/30 mt-0.5">AI Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 pt-6 pb-3">
        <p className="mb-3 px-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-white/5 text-white"
                  : "text-white/30 hover:bg-white/4 hover:text-white/65"
              )}
            >
              {isActive && (
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r-full shadow-lg",
                    item.activeBar,
                    item.activeShadow
                  )}
                />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? item.activeText : "text-white/20 group-hover:text-white/45"
                )}
              />
              <span>{item.label}</span>
              {isActive && (
                <span className={cn("ml-auto h-1.5 w-1.5 rounded-full", item.activeDot)} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Auth0 status chip */}
      <div className="px-3 pb-2">
        <div className="rounded-xl border border-cyan-500/10 bg-linear-to-br from-cyan-500/5 to-violet-500/5 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-cyan-400 shrink-0" />
            <p className="text-[11px] font-semibold text-cyan-300">Auth0 AI Active</p>
          </div>
          <p className="mt-0.5 text-[10px] text-white/25 leading-relaxed">
            Token Vault &amp; CIBA enabled
          </p>
        </div>
      </div>

      {/* Sign out */}
      <div className="border-t border-white/5 p-3">
        <a
          href="/auth/logout"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/25 transition-all hover:bg-red-500/8 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </a>
      </div>
    </aside>
  );
}

