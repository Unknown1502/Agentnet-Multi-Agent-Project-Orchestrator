import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

// Vercel CLI injects \r\n into env var values via stdin on Windows.
// Trim all Auth0 env vars defensively before passing to the SDK.
const clean = (v: string | undefined) => v?.replace(/[\r\n]+/g, "").trim();

// Resolve the canonical production base URL.
// Priority: AUTH0_BASE_URL (explicit) → VERCEL_PROJECT_PRODUCTION_URL (Vercel alias) → VERCEL_URL (deployment-specific) → localhost dev fallback.
function resolveBaseUrl(): string {
  if (clean(process.env.AUTH0_BASE_URL)) return clean(process.env.AUTH0_BASE_URL)!;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

const BASE_URL = resolveBaseUrl();

export const auth0 = new Auth0Client({
  domain: clean(process.env.AUTH0_DOMAIN),
  clientId: clean(process.env.AUTH0_CLIENT_ID),
  clientSecret: clean(process.env.AUTH0_CLIENT_SECRET),
  appBaseUrl: BASE_URL,
  secret: clean(process.env.AUTH0_SECRET),
  authorizationParameters: {
    scope: clean(process.env.AUTH0_SCOPE) || "openid profile email offline_access",
  },
  onCallback: async (error, ctx) => {
    if (error) {
      // Log the full error server-side so it's visible in the terminal
      const errRecord = error as unknown as Record<string, unknown>;
      const causeRecord = (errRecord.cause ?? {}) as Record<string, unknown>;
      const code = (errRecord.code ?? causeRecord.code ?? "") as string;
      console.error("[Auth0 onCallback error]", {
        message: error.message,
        code,
        causeCode: causeRecord.code,
        causeMessage: causeRecord.message,
        status: causeRecord.status,
        baseUrl: BASE_URL,
      });
      const url = new URL("/dashboard/connections", BASE_URL);

      // For invalid_state the session/cookie simply expired or was replayed.
      // Give the user a human-readable message with a code they can search for.
      if (code === "invalid_state" || causeRecord.code === "invalid_state") {
        url.searchParams.set(
          "error",
          "Your login session expired or was used twice. Please try connecting again. (invalid_state)"
        );
      } else if (
        code === "authorization_error" ||
        causeRecord.code === "authorization_error"
      ) {
        // Most common cause: the OAuth app's redirect URI in the social provider's
        // developer portal doesn't include the Auth0 callback URL.
        // For Notion: go to https://www.notion.so/my-integrations → OAuth Domain & URIs
        // and add: https://<your-auth0-tenant>.us.auth0.com/login/callback
        url.searchParams.set(
          "error",
          "Authorization flow failed. For Notion: ensure your Notion OAuth app's redirect URI includes " +
            `https://${clean(process.env.AUTH0_DOMAIN)}/login/callback. ` +
            "For all providers: check that the social connection is enabled in Auth0 Dashboard → Authentication → Social. (authorization_error)"
        );
      } else {
        const displayMsg = code
          ? `${error.message || "Authentication failed"} (${code})`
          : error.message || "Authentication failed";
        url.searchParams.set("error", displayMsg);
      }
      return NextResponse.redirect(url);
    }
    const returnTo = ctx.returnTo || "/dashboard";
    return NextResponse.redirect(new URL(returnTo, BASE_URL));
  },
});
