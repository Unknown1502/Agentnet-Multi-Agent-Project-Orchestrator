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

      // Dump everything — we need to find where the real provider error lives
      try {
        console.error("[Auth0 onCallback FULL error]", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error("[Auth0 onCallback errRecord]", JSON.stringify(errRecord));
        console.error("[Auth0 onCallback causeRecord]", JSON.stringify(causeRecord));
      } catch {
        console.error("[Auth0 onCallback error raw]", String(error));
      }

      const url = new URL("/dashboard/connections", BASE_URL);

      if (code === "invalid_state" || causeRecord.code === "invalid_state") {
        url.searchParams.set("error", "Your login session expired or was used twice. Please try connecting again. (invalid_state)");
      } else if (code === "authorization_error" || causeRecord.code === "authorization_error") {
        // Walk every nested object looking for error_description or error
        const findField = (obj: unknown, ...keys: string[]): string => {
          if (!obj || typeof obj !== "object") return "";
          const rec = obj as Record<string, unknown>;
          for (const k of keys) {
            if (typeof rec[k] === "string" && rec[k]) return rec[k] as string;
          }
          for (const v of Object.values(rec)) {
            const found = findField(v, ...keys);
            if (found) return found;
          }
          return "";
        };
        const detail =
          findField(error, "error_description", "error", "message") ||
          findField(causeRecord, "error_description", "error", "message");
        url.searchParams.set(
          "error",
          detail && detail !== error.message
            ? `Authorization failed: ${detail} (authorization_error)`
            : "Authorization failed. In Auth0 Dashboard → Authentication → Social → Notion: (1) toggle the connection ON for your app, (2) paste the correct Client ID & Secret from notion.so/my-integrations, (3) enable \"Store user access token\". (authorization_error)"
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
