import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

// Probe Token Vault using the MAIN app client (same client that issued the refresh token).
// Auth0 requires subject_token's issuer client == the client_id in the request.
async function probeTokenVault(connection: string, refreshToken: string): Promise<boolean> {
  const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();
  const domain = c(process.env.AUTH0_DOMAIN);
  const clientId = c(process.env.AUTH0_CLIENT_ID);
  const clientSecret = c(process.env.AUTH0_CLIENT_SECRET);
  if (!domain || !clientId || !clientSecret) return false;
  try {
    const res = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
        client_id: clientId,
        client_secret: clientSecret,
        subject_token_type: "urn:ietf:params:oauth:token-type:refresh_token",
        subject_token: refreshToken,
        connection,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[TokenVault probe] ${connection} FAILED (${res.status}):`, JSON.stringify(body));
    } else {
      console.log(`[TokenVault probe] ${connection} SUCCESS`);
    }
    return res.ok;
  } catch (e) {
    console.warn(`[TokenVault probe] ${connection} error:`, e);
    return false;
  }
}

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
  {
    id: "notion",
    name: "Notion",
    provider: "notion",
    description: "Search, create, and manage Notion pages",
    scopes: [],
    icon: "notion",
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

  // In @auth0/nextjs-auth0 v4, the refresh token is nested at session.tokenSet.refreshToken.
  // The top-level session.refreshToken does NOT exist in this SDK version.
  type SessionV4 = { tokenSet?: { refreshToken?: string }; connectionTokenSets?: Array<{ connection: string }> } & Record<string, unknown>;
  const sessionData = session as SessionV4;
  const refreshToken = sessionData.tokenSet?.refreshToken;
  const connectionTokenSets = sessionData.connectionTokenSets ?? [];
  console.log(`[Connections GET] session keys:`, Object.keys(sessionData));
  console.log(`[Connections GET] refreshToken present:`, !!refreshToken);
  console.log(`[Connections GET] connectionTokenSets:`, connectionTokenSets.map((c) => c.connection));

  // Probe Token Vault for each connection.
  // Fast path: check session.connectionTokenSets first (populated by SDK after connect).
  // Slow path: do a live Token Vault exchange with the M2M client + refresh token.
  const connectionStatuses = await Promise.all(
    CONNECTIONS.map(async (conn) => {
      // Fast path — SDK already cached this connection token in the session
      const inSession = connectionTokenSets.some((c) => c.connection === conn.provider);
      if (inSession) return { ...conn, connected: true };

      // Check manual OAuth confirmation marker (written by PUT after redirect-back).
      // We check TWO keys:
      //   1. sub-keyed  — written for the current session (fastest within same sub)
      //   2. email-keyed — stable across different social logins (different subs, same email)
      if (isRedisConfigured()) {
        try {
          const redis = await getRedis();
          const bySubKey = `conn-manual:${userId}:${conn.provider}`;
          const byEmailKey = userEmail ? `conn-manual:email:${userEmail}:${conn.provider}` : null;
          const markedBySub = await redis.get(bySubKey);
          const markedByEmail = byEmailKey ? await redis.get(byEmailKey) : null;
          if (markedBySub || markedByEmail) return { ...conn, connected: true };
        } catch {
          // non-fatal
        }
      }

      // Slow path — probe Token Vault with the current refresh token
      const connected = refreshToken
        ? await probeTokenVault(conn.provider, refreshToken)
        : false;

      // When the probe succeeds, persist the result as an email-keyed marker so it
      // survives future logins that change the user's sub.
      if (connected && isRedisConfigured() && userEmail) {
        try {
          const redis = await getRedis();
          const ex = 7 * 24 * 3600;
          await Promise.all([
            redis.set(`conn-manual:${userId}:${conn.provider}`, "1", { ex }),
            redis.set(`conn-manual:email:${userEmail}:${conn.provider}`, "1", { ex }),
          ]);
        } catch {
          // non-fatal
        }
      }

      return { ...conn, connected };
    })
  );

  // Write-through cache
  if (isRedisConfigured()) {
    const redis = await getRedis();
    await redis.set(cacheKey, connectionStatuses, { ex: CACHE_TTL });
  }

  return NextResponse.json({ connections: connectionStatuses });
}
