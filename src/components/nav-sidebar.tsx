"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, LogOut } from "lucide-react";

const LINKS = [
  { href: "/dashboard",             label: "Command",     exact: true },
  { href: "/dashboard/connections", label: "Connections"              },
  { href: "/dashboard/audit",       label: "Audit"                    },
  { href: "/dashboard/trust",       label: "Trust"                    },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center border-b border-white/4.5 bg-[#020309]/85 px-5 backdrop-blur-xl">
      {/* Wordmark */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-8">
        <div className="relative flex h-6 w-6 items-center justify-center rounded-md bg-linear-to-br from-[#00D9FF] to-[#4F8EFF] shadow-md shadow-[#00D9FF]/20">
          <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-semibold tracking-tight text-white/85">
          AgentNet
        </span>
      </Link>

      {/* Nav links */}
      <nav className="flex items-center gap-0.5">
        {LINKS.map(({ href, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "text-white/90"
                  : "text-white/32 hover:text-white/62"
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 rounded-lg bg-white/5.5" />
              )}
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full bg-[#00E57A]"
            style={{ boxShadow: "0 0 5px #00E57A" }}
          />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/22">
            Live
          </span>
        </div>
        <a
          href="/auth/logout"
          className="flex items-center gap-1.5 text-[12px] text-white/22 transition-colors hover:text-white/50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </a>
      </div>
    </header>
  );
}

