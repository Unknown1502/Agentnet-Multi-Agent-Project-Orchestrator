import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";
import { linkIdentityToPrimary } from "@/lib/account-link";
import { getMgmtToken } from "@/lib/federated-tokens";

export const dynamic = "force-dynamic";

const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

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

  // ── Step 2: Account linking — find the real primary sub and link this identity to it.
  // 
  // The unreliable approach (Redis `primary-sub:email`) fails when:
  //  • GitHub users have no public email → primary-sub was never written
  //  • layout.tsx writes primary-sub AFTER the social OAuth, storing the wrong (social) sub
  //
  // Robust approach: after Redis lookup, validate via Management API.
  // Search for other Auth0 users with the same email and pick the best primary.
  if (isRedisConfigured()) {
    try {
      const redis = await getRedis();

      // Resolve the user's email — from session, or from Management API if null
      let resolvedEmail = userEmail;
      if (!resolvedEmail) {
        const mgmtToken = await getMgmtToken();
        if (mgmtToken) {
          const res = await fetch(
            `https://${c(process.env.AUTH0_DOMAIN)}/api/v2/users/${encodeURIComponent(userId)}`,
            { headers: { Authorization: `Bearer ${mgmtToken}` } }
          );
          if (res.ok) {
            const profile = await res.json();
            resolvedEmail = (profile.email as string | undefined)?.toLowerCase();
          }
        }
      }

      // Fast path: check Redis
      let primarySub: string | null = resolvedEmail
        ? await redis.get<string>(`primary-sub:${resolvedEmail}`)
        : null;

      // Slow path: if Redis returned nothing OR returned the CURRENT sub (means layout.tsx
      // wrote primary-sub AFTER the OAuth callback with the wrong sub), search Management API
      // for the real primary — another Auth0 user with the same email.
      if ((!primarySub || primarySub === userId) && resolvedEmail) {
        const mgmtToken = await getMgmtToken();
        if (mgmtToken) {
          const searchRes = await fetch(
            `https://${c(process.env.AUTH0_DOMAIN)}/api/v2/users?q=${encodeURIComponent(`email:"${resolvedEmail}"`)}&search_engine=v3`,
            { headers: { Authorization: `Bearer ${mgmtToken}` } }
          );
          if (searchRes.ok) {
            const allUsers = (await searchRes.json()) as Array<{
              user_id: string;
              identities?: Array<{ connection: string }>;
            }>;
            // Pick the other user (not the current social sub).
            // If multiple, prefer the one with more linked identities (more established).
            const otherUsers = allUsers
              .filter((u) => u.user_id !== userId)
              .sort((a, b) => (b.identities?.length ?? 0) - (a.identities?.length ?? 0));

            if (otherUsers.length > 0) {
              primarySub = otherUsers[0].user_id;
              // Correct the Redis mapping so next time is fast
              await redis.set(`primary-sub:${resolvedEmail}`, primarySub, {
                ex: 90 * 24 * 3600,
              });
              console.log(
                `[AccountLink] Found primary via Mgmt API search: ${primarySub} (email: ${resolvedEmail})`
              );
            } else {
              // No other user found — this IS the primary, nothing to link
              primarySub = null;
            }
          }
        }
      }

      if (primarySub && primarySub !== userId) {
        console.log(`[AccountLink] Linking ${userId} → primary ${primarySub}`);

        // Write the marker under PRIMARY sub BEFORE linking so it survives relogin
        await redis.set(`conn-manual:${primarySub}:${connection}`, "1", { ex });
        await redis.del(`conn-status:${primarySub}`);

        const result = await linkIdentityToPrimary(primarySub, userId);

        if (result.success && !result.alreadyLinked) {
          await Promise.all([
            redis.del(`conn-status:${userId}`),
            redis.del(`conn-status:${primarySub}`),
          ]);

          return NextResponse.json({
            ok: true,
            linked: true,
            needsRelogin: true,
            reloginUrl: `/auth/login?returnTo=${encodeURIComponent("/dashboard/connections?linked=1")}`,
          });
        }

        if (!result.success) {
          console.warn(`[AccountLink] Link failed (non-fatal): ${result.error}`);
        }
      }
    } catch (e) {
      console.warn("[PUT] Account link check failed (non-fatal):", e);
    }
  }

  return NextResponse.json({ ok: true });
}
