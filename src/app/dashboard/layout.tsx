export const dynamic = "force-dynamic";

import { NavSidebar } from "@/components/nav-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-[#04050d]">
      {/* Animated ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute -top-52 -left-20 h-150 w-150 rounded-full bg-cyan-500/4 blur-[160px]" />
        <div
          className="animate-aurora absolute -bottom-32 -right-20 h-125 w-125 rounded-full bg-violet-600/5 blur-[140px]"
          style={{ animationDelay: "-3s" }}
        />
        <div
          className="animate-aurora absolute top-1/2 left-1/2 h-100 w-100 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/2 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
      </div>
      <NavSidebar />
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
