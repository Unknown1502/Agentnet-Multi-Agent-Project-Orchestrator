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

      // Access cause properties directly — they are class instance properties,
      // not enumerable via JSON, so JSON traversal returns "undefined".
      type WithCause = { cause?: { code?: string; message?: string } };
      const causeCode = (error as unknown as WithCause).cause?.code;
      const causeMsg = (error as unknown as WithCause).cause?.message;

      console.error("[Auth0 onCallback error]", {
        code,
        causeCode,
        causeMsg,
        message: error.message,
      });

      const url = new URL("/dashboard/connections", BASE_URL);

      if (code === "invalid_state" || causeRecord.code === "invalid_state") {
        url.searchParams.set("error", "Your login session expired or was used twice. Please try connecting again. (invalid_state)");
      } else if (code === "authorization_error" || causeRecord.code === "authorization_error") {
        const detail = causeCode && causeMsg && !causeMsg.startsWith("Received the")
          ? `${causeCode}: ${causeMsg}`
          : causeCode ?? causeMsg;
        url.searchParams.set(
          "error",
          detail
            ? `Authorization failed: ${detail} (authorization_error)`
            : "Authorization failed. Check your social connection configuration in the Auth0 Dashboard. (authorization_error)"
        );
      } else {
        url.searchParams.set("error", code ? `${error.message || "Authentication failed"} (${code})` : error.message || "Authentication failed");
      }
      return NextResponse.redirect(url);
    }
    const returnTo = ctx.returnTo || "/dashboard";
    return NextResponse.redirect(new URL(returnTo, BASE_URL));
  },
});
