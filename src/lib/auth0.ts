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
      const errRecord = error as unknown as Record<string, unknown>;
      const causeRecord = (errRecord.cause ?? {}) as Record<string, unknown>;
      const code = (errRecord.code ?? causeRecord.code ?? "") as string;
      // Surface ALL fields so we can diagnose from Vercel logs
      const authError = (causeRecord.error ?? errRecord.error ?? "") as string;
      const authDescription = (causeRecord.error_description ?? errRecord.error_description ?? causeRecord.message ?? "") as string;
      console.error("[Auth0 onCallback error]", JSON.stringify({
        message: error.message,
        code,
        causeCode: causeRecord.code,
        causeMessage: causeRecord.message,
        authError,
        authDescription,
        cause: causeRecord,
        baseUrl: BASE_URL,
      }));
      const url = new URL("/dashboard/connections", BASE_URL);

      if (code === "invalid_state" || causeRecord.code === "invalid_state") {
        url.searchParams.set(
          "error",
          "Your login session expired or was used twice. Please try connecting again. (invalid_state)"
        );
      } else if (
        code === "authorization_error" ||
        causeRecord.code === "authorization_error"
      ) {
        // Show the actual provider error if available, otherwise show generic message
        const detail = authDescription || authError;
        url.searchParams.set(
          "error",
          detail
            ? `Authorization failed: ${detail} (authorization_error)`
            : "Authorization failed. Check that (1) the social connection is enabled in Auth0 Dashboard → Authentication → Social, (2) the Client ID/Secret in Auth0 match your provider app, and (3) \"Store user access token\" is ON. (authorization_error)"
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
