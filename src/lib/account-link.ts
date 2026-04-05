/**
 * Auth0 Account Linking via Management API.
 *
 * Problem: each /auth/login?connection=X creates a new Auth0 session with a
 * different sub (github|xxx, oauth2|slack|yyy, etc.).  Token Vault stores
 * credentials per user-connection pair keyed by sub, so tokens from a GitHub
 * session are invisible when the user is later logged in as their Slack sub.
 *
 * Fix: after the user connects a social provider, link that social identity to
 * their PRIMARY Auth0 user (the sub from their very first login).  Auth0 then
 * returns the primary sub for ALL future logins through any linked identity,
 * and Token Vault credentials are shared across all providers under that sub.
 *
 * Requirement: AUTH0_TOKEN_VAULT_CLIENT_ID (M2M app) must have
 *   `read:users`  + `update:users`  granted on the Management API in the
 *   Auth0 Dashboard.  Go to Applications → APIs → Auth0 Management API →
 *   authorize the M2M app.
 */

const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

export interface LinkResult {
  success: boolean;
  alreadyLinked?: boolean;
  error?: string;
}

export async function linkIdentityToPrimary(
  primaryUserId: string,
  secondaryUserId: string,
): Promise<LinkResult> {
  if (primaryUserId === secondaryUserId) {
    return { success: true, alreadyLinked: true };
  }

  const domain = c(process.env.AUTH0_DOMAIN);
  const clientId = c(process.env.AUTH0_TOKEN_VAULT_CLIENT_ID);
  const clientSecret = c(process.env.AUTH0_TOKEN_VAULT_CLIENT_SECRET);

  if (!domain || !clientId || !clientSecret) {
    const msg = "Missing AUTH0_TOKEN_VAULT_CLIENT_ID / SECRET for Management API";
    console.warn("[AccountLink]", msg);
    return { success: false, error: msg };
  }

  try {
    // 1. Get a Management API token via client_credentials
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      const msg = `Management API token request failed (${tokenRes.status}): ${JSON.stringify(err)}`;
      console.error("[AccountLink]", msg);
      return { success: false, error: msg };
    }

    const { access_token } = await tokenRes.json();

    // 2. Fetch the secondary user's profile to get their exact identity details
    const profileRes = await fetch(
      `https://${domain}/api/v2/users/${encodeURIComponent(secondaryUserId)}`,
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    if (!profileRes.ok) {
      const err = await profileRes.json().catch(() => ({}));
      const msg = `Cannot fetch secondary user profile (${profileRes.status}): ${JSON.stringify(err)}`;
      console.error("[AccountLink]", msg);
      return { success: false, error: msg };
    }

    const profile = await profileRes.json();
    const identity = profile.identities?.[0];

    if (!identity) {
      return { success: false, error: "Secondary user has no identities" };
    }

    // 3. Link the secondary identity to the primary user
    const linkRes = await fetch(
      `https://${domain}/api/v2/users/${encodeURIComponent(primaryUserId)}/identities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: identity.provider,
          user_id: identity.user_id,
        }),
      },
    );

    if (!linkRes.ok) {
      const err = await linkRes.json().catch(() => ({}));
      // "already linked" / "already exists" → treat as success
      const msg: string = err?.message ?? "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return { success: true, alreadyLinked: true };
      }
      console.error(`[AccountLink] Identity link failed (${linkRes.status}):`, JSON.stringify(err));
      return { success: false, error: `${msg} (${linkRes.status})` };
    }

    console.log(
      `[AccountLink] ✓ Linked ${secondaryUserId} (${identity.provider}|${identity.user_id}) → primary ${primaryUserId}`,
    );
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[AccountLink] Unexpected error:", msg);
    return { success: false, error: msg };
  }
}
