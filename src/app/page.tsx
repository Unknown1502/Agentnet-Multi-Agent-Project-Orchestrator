import { redirect } from "next/navigation";
import { Shield, GitBranch, MessageSquare, ArrowRight, Zap, Lock, Cpu, ChevronRight } from "lucide-react";
import { auth0 } from "@/lib/auth0";

export default async function Home() {
  const session = await auth0.getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#030712]">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-150 w-225 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute top-1/3 -left-40 h-100 w-100 rounded-full bg-violet-600/10 blur-[100px]" />
        <div className="absolute top-1/3 -right-40 h-100 w-100 rounded-full bg-blue-600/10 blur-[100px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Navbar */}
      <header className="relative z-10 border-b border-white/5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">AgentNet</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-500 sm:block">v2.0 — Hackathon Edition</span>
            <a
              href="/auth/login?returnTo=/dashboard"
              className="group inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 backdrop-blur-sm transition-all hover:border-indigo-400/60 hover:bg-indigo-600/30 hover:text-white"
            >
              Sign In
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center">
        {/* Hero */}
        <section className="flex w-full flex-col items-center px-6 pb-16 pt-24 text-center sm:pt-32">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-indigo-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
            </span>
            Powered by Auth0 Token Vault &amp; CIBA
          </div>

          {/* Headline */}
          <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-7xl">
            AI Agents That{" "}
            <span className="relative">
              <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-blue-400 bg-clip-text text-transparent">
                Act With Authority
              </span>
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">
            AgentNet orchestrates GitHub and Slack agents with cascading trust delegation.
            Every action is authorized through Auth0 Token Vault — zero credentials exposed to the AI.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/auth/login?returnTo=/dashboard"
              className="group inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 hover:brightness-110"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="https://github.com/Unknown1502/Agentnet-Multi-Agent-Project-Orchestrator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm font-semibold text-gray-300 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <GitBranch className="h-4 w-4" />
              View on GitHub
            </a>
          </div>

          {/* Stats row */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-center">
            {[
              { value: "3", label: "AI Agents" },
              { value: "Zero", label: "Exposed Credentials" },
              { value: "Real-time", label: "Trust Delegation" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="mt-0.5 text-xs text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <section className="w-full max-w-6xl px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1 */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-indigo-500/30 hover:bg-indigo-500/5">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
                <Lock className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">Token Vault</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                OAuth tokens are stored in Auth0's federated Token Vault and delegated
                to agents on demand. The AI never sees raw credentials.
              </p>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-indigo-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Card 2 */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/5">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">Trust Zones</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                GREEN, YELLOW, and RED trust tiers per tool. High-risk actions are
                gated by CIBA step-up — a push notification to your device.
              </p>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Card 3 */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-violet-500/30 hover:bg-violet-500/5">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                <Cpu className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">Orchestrator</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                Llama 3.3 70b (Groq) routes natural language commands to the right
                agent, with LangGraph managing the interrupt-and-resume flow.
              </p>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-violet-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Card 4 */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-sky-500/30 hover:bg-sky-500/5">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10">
                <GitBranch className="h-5 w-5 text-sky-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">GitHub Agent</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                List repos, read issues, create PRs, and post comments — all through
                your delegated GitHub OAuth token.
              </p>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-sky-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Card 5 */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/2 p-6 transition-all hover:border-purple-500/30 hover:bg-purple-500/5">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                <MessageSquare className="h-5 w-5 text-purple-400" />
              </div>
              <h3 className="mb-2 font-semibold text-white">Slack Agent</h3>
              <p className="text-sm leading-relaxed text-gray-500">
                Post messages, list channels, and read conversations from Slack using
                Auth0's Sign-in-with-Slack federation.
              </p>
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-purple-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Card 6 — CTA card */}
            <div className="group relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-linear-to-br from-indigo-600/10 to-violet-600/10 p-6 transition-all hover:border-indigo-500/40">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-500/20">
                <Zap className="h-5 w-5 text-indigo-300" />
              </div>
              <h3 className="mb-2 font-semibold text-white">Ready to try it?</h3>
              <p className="text-sm leading-relaxed text-gray-400">
                Connect your accounts and run your first multi-agent command in under a minute.
              </p>
              <a
                href="/auth/login?returnTo=/dashboard"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
              >
                Launch AgentNet
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </section>

        {/* How it works strip */}
        <section className="w-full border-y border-white/5 bg-white/1 px-6 py-14">
          <div className="mx-auto max-w-4xl">
            <p className="mb-10 text-center text-xs font-semibold uppercase tracking-widest text-gray-600">How it works</p>
            <div className="grid gap-8 sm:grid-cols-4">
              {[
                { step: "01", title: "Sign In", desc: "Authenticate with Auth0 — your identity is the root of trust." },
                { step: "02", title: "Connect", desc: "Link GitHub & Slack via OAuth. Tokens are stored in the Vault." },
                { step: "03", title: "Prompt", desc: "Type a natural language command for your agents to execute." },
                { step: "04", title: "Approve", desc: "Review and approve high-risk actions via CIBA push notification." },
              ].map((item) => (
                <div key={item.step} className="flex flex-col gap-2">
                  <span className="text-xs font-bold tabular-nums text-indigo-500">{item.step}</span>
                  <h4 className="font-semibold text-white">{item.title}</h4>
                  <p className="text-xs leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 flex items-center justify-between border-t border-white/5 px-6 py-5 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-indigo-700" /> AgentNet
        </span>
        <span>Built for the Auth0 for AI Agents Hackathon</span>
      </footer>
    </div>
  );
}
