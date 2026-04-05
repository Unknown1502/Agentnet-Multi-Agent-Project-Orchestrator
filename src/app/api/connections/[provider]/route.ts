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

// Probe the Token Vault exchange to verify the connection actually works end-to-end.
// Called in PUT so we catch misconfigured Auth0 apps before writing "Connected" markers.
async function probeTokenVault(connection: string, refreshToken: string | undefined): Promise<boolean> {
  if (!refreshToken) return false;
  const clean = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();
  const domain = clean(process.env.AUTH0_DOMAIN);
  const clientId = clean(process.env.AUTH0_CLIENT_ID);
  const clientSecret = clean(process.env.AUTH0_CLIENT_SECRET);
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
    console.log(`[TokenVault PUT probe] ${connection} → ${res.status}:`, JSON.stringify(body).slice(0, 200));
    return res.ok;
  } catch (e) {
    console.warn(`[TokenVault PUT probe] ${connection} error:`, e);
    return false;
  }
}

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
  const sessionV4 = session as { tokenSet?: { refreshToken?: string } } & Record<string, unknown>;
  const refreshToken = (sessionV4.tokenSet?.refreshToken as string | undefined) || undefined;

  // ── Step 1: Persist connection markers (by sub AND by email).
  // Always write FIRST regardless of Token Vault probe result — the OAuth did succeed
  // and the UI must show "Connected". Vault configuration issues are advisory.
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

  // ── Step 2: Probe Token Vault to warn if agent won't work yet.
  // The probe is ADVISORY — it tells the user what to fix in Auth0 Dashboard.
  // It does NOT block the connected state or the account linking step.
  const vaultWorking = await probeTokenVault(connection, refreshToken);
  if (!vaultWorking) {
    console.warn(`[PUT ${provider}] Token Vault probe failed. refreshToken present: ${!!refreshToken}. Connection IS marked.`);
    return NextResponse.json({
      ok: true,
      vaultWarning: true,
      error:
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} connected via OAuth, but the Token Vault exchange ` +
        `isn't configured yet — the agent will prompt you to re-connect until fixed.\n\n` +
        `Fix in Auth0 Dashboard:\n` +
        `1. Applications → [Your App] → Settings → Advanced → Grant Types → enable "Token Exchange"\n` +
        `2. Authentication → Social → ${provider} → Purpose = "Authentication and Connected Accounts for Token Vault"\n` +
        `3. For Notion: ensure the redirect URI in your Notion OAuth app is exactly:\n` +
        `   https://<your-tenant>.us.auth0.com/login/callback`,
    });
  }

  // ── Step 3: Account linking — link this social identity to the primary Auth0 user.
  if (isRedisConfigured() && userEmail) {
    try {
      const redis = await getRedis();
      const primarySub = await redis.get<string>(`primary-sub:${userEmail}`);

      if (primarySub && primarySub !== userId) {
        console.log(`[AccountLink] Linking ${userId} → primary ${primarySub}`);
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
