import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { getRedis, isRedisConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

const c = (v: string | undefined) => (v || "").replace(/[\r\n]+/g, "").trim();

const NOTION_CLIENT_ID = "337d872b-594c-8150-95eb-003711e919c9";

function getBaseUrl() {
  if (c(process.env.AUTH0_BASE_URL)) return c(process.env.AUTH0_BASE_URL)!;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export async function GET() {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", getBaseUrl()));
  }

  const userId = session.user.sub as string;
  const state = crypto.randomUUID();

  if (isRedisConfigured()) {
    const redis = await getRedis();
    // Store state → current userId, TTL 10 min
    await redis.set(`notion-oauth-state:${state}`, userId, { ex: 600 });
  }

  const redirectUri = `${getBaseUrl()}/api/auth/notion/callback`;
  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authUrl.searchParams.set("client_id", NOTION_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  console.log(`[Notion OAuth] Starting flow for userId=${userId} redirectUri=${redirectUri}`);
  return NextResponse.redirect(authUrl.toString());
}
