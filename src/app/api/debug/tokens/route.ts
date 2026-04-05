import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

// Safe diagnostic endpoint — only works when logged in, never exposes raw tokens.
// Visit /api/debug/tokens to diagnose why getFederatedAccessToken returns undefined.
export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const userId = session.user.sub as string;
  const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();
  const domain = c(process.env.AUTH0_DOMAIN);
  const clientId = c(process.env.AUTH0_TOKEN_VAULT_CLIENT_ID);
  const clientSecret = c(process.env.AUTH0_TOKEN_VAULT_CLIENT_SECRET);

  const result: Record<string, unknown> = {
    userId,
    domain,
    clientIdPresent: !!clientId,
    clientIdPrefix: clientId.slice(0, 6),
    clientSecretPresent: !!clientSecret,
  };

  // Step 1: Get management API token
  if (!domain || !clientId || !clientSecret) {
    return NextResponse.json({ ...result, step: "FAIL: missing env vars" });
  }

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
    const body = await tokenRes.json().catch(() => ({}));
    return NextResponse.json({
      ...result,
      step: "FAIL: mgmt token request",
      status: tokenRes.status,
      error: body,
    });
  }

  const { access_token: mgmtToken } = await tokenRes.json();
  result.step1_mgmtToken = "OK";

  // Step 2: Fetch user identities
  const userRes = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${mgmtToken}` } },
  );

  if (!userRes.ok) {
    const body = await userRes.json().catch(() => ({}));
    return NextResponse.json({
      ...result,
      step: "FAIL: GET /api/v2/users",
      status: userRes.status,
      error: body,
    });
  }

  const user = await userRes.json();
  const identities = user.identities as Array<{
    provider: string;
    connection: string;
    user_id: string;
    access_token?: string;
  }>;

  result.step2_getUser = "OK";
  result.identities = identities?.map((id) => ({
    connection: id.connection,
    provider: id.provider,
    userId: id.user_id,
    hasAccessToken: !!id.access_token,
    // Show first 8 chars of token so we know it's real, not a secret
    tokenPrefix: id.access_token ? id.access_token.slice(0, 8) + "..." : null,
  }));

  return NextResponse.json(result);
}
