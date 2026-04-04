import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

// Probe Token Vault using the MAIN app client (same client that issued the refresh token).
// Auth0 requires subject_token's issuer client == the client_id in the request.
async function probeTokenVault(connection: string, refreshToken: string): Promise<boolean> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
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

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.sub as string;
  const cacheKey = `conn-status:${userId}`;
  console.log(`[Connections GET] userId=${userId}`);

  // Serve from Redis cache when available
  if (isRedisConfigured()) {
    const redis = await getRedis();
    const cached = await redis.get<typeof CONNECTIONS>(cacheKey);
    if (cached) {
      return NextResponse.json({ connections: cached });
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

      // Check manual OAuth confirmation marker (written by PUT after redirect-back)
      if (isRedisConfigured()) {
        try {
          const redis = await getRedis();
          const marked = await redis.get(`conn-manual:${userId}:${conn.provider}`);
          if (marked) return { ...conn, connected: true };
        } catch {
          // non-fatal
        }
      }

      // Slow path — probe Token Vault with M2M client
      const connected = refreshToken
        ? await probeTokenVault(conn.provider, refreshToken)
        : false;
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
