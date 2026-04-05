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
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#020309]">
      {/* Ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/4 h-140 w-140 -translate-x-1/2 rounded-full bg-[#4F8EFF]/2.5 blur-[130px]" />
        <div className="absolute -bottom-48 right-1/4 h-115 w-115 translate-x-1/2 rounded-full bg-[#E01E8C]/2.5 blur-[110px]" />
        <div className="absolute top-1/3 left-1/2 h-70 w-70 -translate-x-1/2 rounded-full bg-[#00D9FF]/1.5 blur-[80px]" />
      </div>

      <NavSidebar />

      <main className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {children}
      </main>
    </div>
  );
}
