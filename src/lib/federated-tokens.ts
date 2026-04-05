/**
 * Fetch a linked identity's access token directly from the Auth0 Management API.
 *
 * This is the fallback for tenants that don't have the Token Vault feature
 * (free / trial plans where Token Exchange grant type is unavailable).
 *
 * When a user connects a social provider via Auth0 account linking, Auth0
 * stores the provider's access token inside the user's identity record.
 * We retrieve it via:
 *   GET /api/v2/users/{user_id}   (requires read:users + read:user_idp_tokens)
 *
 * Required M2M permissions (Applications → APIs → Auth0 Management API):
 *   read:users            — already added for account linking
 *   read:user_idp_tokens  — NEW: add this to your M2M app
 */

const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

// In-process cache to avoid a Management API round-trip on every tool invocation.
// Resets when the serverless function is recycled.
let _mgmtCache: { token: string; expiresAt: number } | null = null;

export async function getMgmtToken(): Promise<string | undefined> {
  if (_mgmtCache && _mgmtCache.expiresAt > Date.now() + 10_000) {
    return _mgmtCache.token;
  }

  const domain = c(process.env.AUTH0_DOMAIN);
  const clientId = c(process.env.AUTH0_TOKEN_VAULT_CLIENT_ID);
  const clientSecret = c(process.env.AUTH0_TOKEN_VAULT_CLIENT_SECRET);

  if (!domain || !clientId || !clientSecret) {
    console.warn("[FederatedTokens] Missing M2M credentials — cannot fetch identity tokens");
    return undefined;
  }

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(`[FederatedTokens] M2M token request failed (${res.status}):`, JSON.stringify(body).slice(0, 200));
    return undefined;
  }

  const { access_token, expires_in } = await res.json();
  _mgmtCache = {
    token: access_token,
    expiresAt: Date.now() + (Number(expires_in) || 86_400) * 1_000,
  };
  return access_token;
}

interface Auth0Identity {
  provider: string;
  connection: string;
  user_id: string;
  access_token?: string;
  refresh_token?: string;
}

/**
 * Returns the OAuth access token Auth0 stored for a linked social identity.
 *
 * @param userId   - Auth0 user sub (e.g. "auth0|abc123" or "github|123456")
 * @param connection - Auth0 connection name (e.g. "github", "sign-in-with-slack", "notion")
 */
export async function getFederatedAccessToken(
  userId: string | undefined,
  connection: string,
): Promise<string | undefined> {
  if (!userId) return undefined;

  const domain = c(process.env.AUTH0_DOMAIN);
  if (!domain) return undefined;

  try {
    const mgmtToken = await getMgmtToken();
    if (!mgmtToken) {
      console.error(`[FederatedTokens] No mgmt token — check AUTH0_TOKEN_VAULT_CLIENT_ID/SECRET and Management API authorization`);
      return undefined;
    }

    const url = `https://${domain}/api/v2/users/${encodeURIComponent(userId)}`;
    console.log(`[FederatedTokens] Fetching identities for userId=${userId} connection=${connection}`);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${mgmtToken}` } });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn(`[FederatedTokens] GET /api/v2/users failed (${res.status}):`, JSON.stringify(body).slice(0, 200));
      return undefined;
    }

    const user = await res.json();
    const identities = user.identities as Auth0Identity[] | undefined;
    console.log(`[FederatedTokens] Found ${identities?.length ?? 0} identities:`, identities?.map(i => `${i.connection}(hasToken:${!!i.access_token})`).join(", "));

    // Primary identity: look for exact connection match
    const identity = identities?.find((id) => id.connection === connection);
    if (identity?.access_token) {
      console.log(`[FederatedTokens] Found access_token for ${connection}`);
      return identity.access_token;
    }

    console.warn(`[FederatedTokens] No access_token found for connection=${connection}. identity found: ${!!identity}`);
    return undefined;
  } catch (e) {
    console.warn("[FederatedTokens] Error fetching identity token:", e);
    return undefined;
  }
}
