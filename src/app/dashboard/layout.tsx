export const dynamic = "force-dynamic";

import { NavSidebar } from "@/components/nav-sidebar";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Store the FIRST sub we ever see for this email as the "primary sub".
  // When the user later connects a social provider (github|xxx, slack|yyy),
  // the PUT handler links those identities back to this primary sub so that
  // Token Vault credentials work under a single unified user in Auth0.
  // Uses Redis NX so only the first sub ever seen is stored.
  try {
    const session = await auth0.getSession();
    if (session && isRedisConfigured()) {
      const email = (session.user.email as string | undefined)?.toLowerCase();
      const sub = session.user.sub as string | undefined;
      if (email && sub) {
        const redis = await getRedis();
        await redis.set(`primary-sub:${email}`, sub, { ex: 90 * 24 * 3600, nx: true });
      }
    }
  } catch {
    // Never block the layout render for Redis failures
  }

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
