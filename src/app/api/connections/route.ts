import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";
import { getMgmtToken } from "@/lib/federated-tokens";

export const dynamic = "force-dynamic";

const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

const CONNECTIONS = [
  {
    id: "github",
    name: "GitHub",
    provider: "github",
    description: "Access repositories, issues, and pull requests",
    scopes: ["repo", "read:org", "read:user"],
    icon: "github",
  },
  {
    id: "slack",
    name: "Slack",
    provider: "sign-in-with-slack",
    description: "Send messages and manage channels",
    scopes: ["chat:write", "channels:read", "channels:manage", "users:read"],
    icon: "slack",
  },
];

const CACHE_TTL = 30; // seconds

export async function GET(request: NextRequest) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bust param: if the client passes ?bust=1 skip the cache and recompute fresh.
  // This is called after a connect flow completes to guarantee up-to-date status.
  const bust = request.nextUrl.searchParams.has("bust");

  const userId = session.user.sub as string;
  // Email is a stable cross-session identifier — the sub changes each time the user
  // logs in via a different social provider, but the email stays the same.
  const userEmail = (session.user.email as string | undefined)?.toLowerCase();
  const cacheKey = `conn-status:${userId}`;
  console.log(`[Connections GET] userId=${userId} email=${userEmail} bust=${bust}`);

  // Serve from Redis cache when available (skip when bust requested)
  if (!bust && isRedisConfigured()) {
    try {
      const redis = await getRedis();
      const cached = await redis.get<typeof CONNECTIONS>(cacheKey);
      if (cached) {
        return NextResponse.json({ connections: cached });
      }
    } catch {
      // non-fatal — fall through to recompute
    }
  }

  // ── Ground truth: fetch actual linked identities from Management API.
  // This is reliable regardless of which sub the session uses — after account linking,
  // ALL providers appear under the primary sub's identities array.
  let linkedConnections: string[] = [];
  try {
    const mgmtToken = await getMgmtToken();
    if (mgmtToken) {
      const domain = c(process.env.AUTH0_DOMAIN);
      const res = await fetch(
        `https://${domain}/api/v2/users/${encodeURIComponent(userId)}`,
        { headers: { Authorization: `Bearer ${mgmtToken}` } }
      );
      if (res.ok) {
        const user = await res.json();
        linkedConnections = (
          (user.identities as Array<{ connection: string }>) ?? []
        ).map((i) => i.connection);
        console.log(`[Connections GET] mgmt identities for ${userId}:`, linkedConnections);
      } else {
        console.warn(`[Connections GET] mgmt user fetch failed (${res.status})`);
      }
    }
  } catch (e) {
    console.warn("[Connections GET] Management API check failed, using Redis fallback:", e);
  }

  const connectionStatuses = await Promise.all(
    CONNECTIONS.map(async (conn) => {
      // ── Primary check: Management API (ground truth after account linking)
      if (linkedConnections.includes(conn.provider)) return { ...conn, connected: true };

      // ── Fallback: Redis markers (covers cases where Mgmt API is temporarily unavailable,
      //    or the user just completed an OAuth flow but account linking is still pending)
      if (isRedisConfigured()) {
        try {
          const redis = await getRedis();
          const bySub = await redis.get(`conn-manual:${userId}:${conn.provider}`);
          const byEmail = userEmail
            ? await redis.get(`conn-manual:email:${userEmail}:${conn.provider}`)
            : null;
          if (bySub || byEmail) return { ...conn, connected: true };
        } catch {
          // non-fatal
        }
      }

      return { ...conn, connected: false };
    })
  );

  // Write-through cache
  if (isRedisConfigured()) {
    try {
      const redis = await getRedis();
      await redis.set(cacheKey, connectionStatuses, { ex: CACHE_TTL });
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({ connections: connectionStatuses });
}
