import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

const PROVIDER_MAP: Record<string, string> = {
  github: "github",
  slack: "sign-in-with-slack",
  notion: "notion",
};

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const connection = PROVIDER_MAP[provider];

  if (!connection) {
    return NextResponse.json(
      { error: "Unknown provider" },
      { status: 400 }
    );
  }

  // Bust the connection-status cache so the next GET reflects the new link
  if (isRedisConfigured()) {
    try {
      const redis = await getRedis();
      await redis.del(`conn-status:${session.user.sub}`);
    } catch {
      // Cache invalidation failure should not block connection initiation.
    }
  }

  // Trigger a fresh OAuth flow for this specific connection.
  // Auth0 will authenticate the user with the requested social provider,
  // obtaining a social refresh token. Token Vault then exchanges this via
  // the federated token exchange grant to get provider access tokens.
  const returnTo = `/dashboard/connections?connected=${provider}`;
  const connectUrl = `/auth/login?connection=${encodeURIComponent(connection)}&returnTo=${encodeURIComponent(returnTo)}`;

  return NextResponse.json({ connectUrl });
}

// Called by the connections page after OAuth redirect-back to persist the mark.
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { provider } = await params;
  const connection = PROVIDER_MAP[provider];
  if (!connection) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const userId = session.user.sub as string;
  if (isRedisConfigured()) {
    try {
      const redis = await getRedis();
      // Mark as connected for 7 days
      await redis.set(`conn-manual:${userId}:${connection}`, "1", { ex: 7 * 24 * 3600 });
      // Bust the status cache so next GET reflects the mark
      await redis.del(`conn-status:${userId}`);
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json({ ok: true });
}
