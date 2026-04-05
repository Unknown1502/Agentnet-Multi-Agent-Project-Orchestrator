import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

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
  const mainClientId = c(process.env.AUTH0_CLIENT_ID);

  const result: Record<string, unknown> = { userId, domain };

  if (!domain || !clientId || !clientSecret) {
    return NextResponse.json({ ...result, step: "FAIL: missing env vars" });
  }

  // Step 1: M2M token
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
    return NextResponse.json({ ...result, step: "FAIL: mgmt token", status: tokenRes.status, error: await tokenRes.json().catch(() => ({})) });
  }
  const { access_token: mgmtToken } = await tokenRes.json();
  result.step1_mgmtToken = "OK";

  // Step 2: User identities
  const userRes = await fetch(`https://${domain}/api/v2/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${mgmtToken}` },
  });
  if (!userRes.ok) {
    return NextResponse.json({ ...result, step: "FAIL: GET /api/v2/users", status: userRes.status, error: await userRes.json().catch(() => ({})) });
  }
  const user = await userRes.json();
  const identities = user.identities as Array<{ provider: string; connection: string; user_id: string; access_token?: string }>;
  result.step2_getUser = "OK";
  result.identities = identities?.map((id) => ({
    connection: id.connection,
    provider: id.provider,
    hasAccessToken: !!id.access_token,
    tokenPrefix: id.access_token ? id.access_token.slice(0, 8) + "..." : null,
  }));

  // Step 3: List ALL social connections on the tenant + whether enabled for this app
  const connsRes = await fetch(`https://${domain}/api/v2/connections?strategy=oauth2&fields=name,id,enabled_clients&include_fields=true`, {
    headers: { Authorization: `Bearer ${mgmtToken}` },
  });
  const allConns = connsRes.ok ? await connsRes.json() : [];

  // Also check social connections (github, slack use strategy=social in Auth0)
  const socialRes = await fetch(`https://${domain}/api/v2/connections?fields=name,id,enabled_clients,strategy&include_fields=true`, {
    headers: { Authorization: `Bearer ${mgmtToken}` },
  });
  const allSocial = socialRes.ok ? await socialRes.json() : [];

  const relevantNames = ["github", "sign-in-with-slack", "slack"];
  result.connections = (allSocial as Array<{ name: string; id: string; strategy: string; enabled_clients?: string[] }>)
    .filter((conn) => relevantNames.some((n) => conn.name?.toLowerCase().includes(n)) || ["github", "slack"].includes(conn.strategy))
    .map((conn) => ({
      name: conn.name,
      id: conn.id,
      strategy: conn.strategy,
      enabledForMainApp: conn.enabled_clients?.includes(mainClientId) ?? false,
      enabledClientCount: conn.enabled_clients?.length ?? 0,
    }));

  result.mainClientId = mainClientId ? mainClientId.slice(0, 8) + "..." : "MISSING";

  return NextResponse.json(result);
}
