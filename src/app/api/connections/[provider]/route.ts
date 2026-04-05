import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";
import { linkIdentityToPrimary } from "@/lib/account-link";

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
  const userEmail = (session.user.email as string | undefined)?.toLowerCase();

  // ── Step 1: Persist connection markers (by sub AND by email).
  // Always write regardless of anything else — the OAuth did succeed
  // and the UI must show "Connected".
  const ex = 7 * 24 * 3600;
  if (isRedisConfigured()) {
    try {
      const redis = await getRedis();
      await Promise.all([
        redis.set(`conn-manual:${userId}:${connection}`, "1", { ex }),
        ...(userEmail
          ? [redis.set(`conn-manual:email:${userEmail}:${connection}`, "1", { ex })]
          : []),
      ]);
      await redis.del(`conn-status:${userId}`);
    } catch {
      // non-fatal
    }
  }

  // ── Step 2: Account linking — link this social identity to the primary Auth0 user.
  if (isRedisConfigured() && userEmail) {
    try {
      const redis = await getRedis();
      const primarySub = await redis.get<string>(`primary-sub:${userEmail}`);

      if (primarySub && primarySub !== userId) {
        console.log(`[AccountLink] Linking ${userId} → primary ${primarySub}`);

        // Write the marker under the PRIMARY sub FIRST so it persists after relogin.
        // After linking, the user is redirected to re-login as primarySub — at that
        // point only keys under primarySub are visible, not the current social sub.
        if (isRedisConfigured()) {
          try {
            await redis.set(`conn-manual:${primarySub}:${connection}`, "1", { ex });
            await redis.del(`conn-status:${primarySub}`);
          } catch {
            // non-fatal
          }
        }

        const result = await linkIdentityToPrimary(primarySub, userId);

        if (result.success && !result.alreadyLinked) {
          // Bust caches for both sub identities
          await Promise.all([
            redis.del(`conn-status:${userId}`),
            redis.del(`conn-status:${primarySub}`),
          ]);

          // The user must re-login to get a session under the primary sub.
          // After account linking, logging in via GitHub/Slack/Notion all return the
          // primary sub, enabling Token Vault to work for ALL providers simultaneously.
          return NextResponse.json({
            ok: true,
            linked: true,
            needsRelogin: true,
            reloginUrl: `/auth/login?returnTo=${encodeURIComponent("/dashboard/connections?linked=1")}`,
          });
        }

        if (!result.success) {
          console.warn(`[AccountLink] Link failed (non-fatal): ${result.error}`);
          // Don't block — connection is still marked, just multi-sub issue persists
        }
      }
    } catch (e) {
      console.warn("[PUT] Account link check failed (non-fatal):", e);
    }
  }

  return NextResponse.json({ ok: true });
}
