import { NextRequest, NextResponse } from "next/server";
import { getRedis, isRedisConfigured } from "@/lib/db";
import { getMgmtToken } from "@/lib/federated-tokens";
import { linkIdentityToPrimary } from "@/lib/account-link";

export const dynamic = "force-dynamic";

const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

const NOTION_CLIENT_ID = "337d872b-594c-8150-95eb-003711e919c9";

function getBaseUrl() {
  if (c(process.env.AUTH0_BASE_URL)) return c(process.env.AUTH0_BASE_URL)!;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

function errRedirect(msg: string) {
  const url = new URL("/dashboard/connections", getBaseUrl());
  url.searchParams.set("error", msg);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return errRedirect(`Notion authorization failed: ${error}`);
  if (!code || !state) return errRedirect("Missing code or state from Notion");

  // ── Validate state → resolve original userId
  let originalUserId: string | null = null;
  if (isRedisConfigured()) {
    const redis = await getRedis();
    originalUserId = await redis.get<string>(`notion-oauth-state:${state}`);
    if (originalUserId) await redis.del(`notion-oauth-state:${state}`);
  }

  if (!originalUserId) return errRedirect("Invalid or expired state. Please try connecting again.");

  // ── Exchange code for token (Notion requires JSON body + Basic auth header)
  const clientSecret = c(process.env.NOTION_CLIENT_SECRET);
  if (!clientSecret) return errRedirect("NOTION_CLIENT_SECRET env var not set — add it in Vercel Dashboard");

  const redirectUri = `${getBaseUrl()}/api/auth/notion/callback`;
  const credentials = Buffer.from(`${NOTION_CLIENT_ID}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.json().catch(() => ({}));
    console.error("[Notion OAuth callback] Token exchange failed:", body);
    return errRedirect(`Notion token exchange failed (${tokenRes.status}): ${body.error ?? "unknown"}`);
  }

  const { access_token: accessToken } = await tokenRes.json() as { access_token?: string };
  if (!accessToken) return errRedirect("Notion returned no access token");

  console.log(`[Notion OAuth] Token exchange success for userId=${originalUserId}`);

  // ── Resolve primary sub (same logic as the PUT handler in [provider]/route.ts)
  let primarySub = originalUserId;
  if (isRedisConfigured()) {
    try {
      const redis = await getRedis();
      const mgmtToken = await getMgmtToken();
      if (mgmtToken) {
        const domain = c(process.env.AUTH0_DOMAIN);
        const searchRes = await fetch(
          `https://${domain}/api/v2/users/${encodeURIComponent(originalUserId)}`,
          { headers: { Authorization: `Bearer ${mgmtToken}` } }
        );
        if (searchRes.ok) {
          const profile = await searchRes.json();
          const email = (profile.email as string | undefined)?.toLowerCase();

          // If we have an email, search for any other user with the same email to find real primary
          if (email) {
            const emailSearchRes = await fetch(
              `https://${domain}/api/v2/users?q=${encodeURIComponent(`email:"${email}"`)}&search_engine=v3`,
              { headers: { Authorization: `Bearer ${mgmtToken}` } }
            );
            if (emailSearchRes.ok) {
              const allUsers = (await emailSearchRes.json()) as Array<{ user_id: string; identities?: unknown[] }>;
              const other = allUsers
                .filter((u) => u.user_id !== originalUserId)
                .sort((a, b) => (b.identities?.length ?? 0) - (a.identities?.length ?? 0));
              if (other.length > 0) {
                primarySub = other[0].user_id;
                console.log(`[Notion OAuth] Using primary sub ${primarySub} via email search`);
                // Link originalUserId to primarySub
                const linkResult = await linkIdentityToPrimary(primarySub, originalUserId);
                if (!linkResult.success && !linkResult.alreadyLinked) {
                  console.warn("[Notion OAuth] Account link failed:", linkResult.error);
                }
              }
            }
          }
        }
      }

      // Store token under primary sub
      const ex = 365 * 24 * 3600; // Notion tokens don't expire until revoked
      await redis.set(`notion-token:${primarySub}`, accessToken, { ex });
      // Also store under original sub as fallback
      if (primarySub !== originalUserId) {
        await redis.set(`notion-token:${originalUserId}`, accessToken, { ex });
      }
      // Write connection marker
      const markerEx = 7 * 24 * 3600;
      await redis.set(`conn-manual:${primarySub}:notion`, "1", { ex: markerEx });
      await redis.del(`conn-status:${primarySub}`);
      await redis.del(`conn-status:${originalUserId}`);
    } catch (e) {
      console.error("[Notion OAuth] Redis storage failed:", e);
      return errRedirect("Failed to store Notion token. Please try again.");
    }
  }

  // Redirect to connections page — token is stored, skip the PUT flow
  const successUrl = new URL("/dashboard/connections", getBaseUrl());
  successUrl.searchParams.set("connected", "notion");
  successUrl.searchParams.set("skip_put", "1");
  return NextResponse.redirect(successUrl);
}
