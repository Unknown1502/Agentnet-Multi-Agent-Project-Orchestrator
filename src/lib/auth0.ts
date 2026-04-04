import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  appBaseUrl: process.env.AUTH0_BASE_URL,
  secret: process.env.AUTH0_SECRET,
  authorizationParameters: {
    scope: process.env.AUTH0_SCOPE || "openid profile email offline_access",
  },
  enableConnectAccountEndpoint: true,
  onCallback: async (error, ctx) => {
    const base = process.env.AUTH0_BASE_URL || "http://localhost:3000";
    if (error) {
      // Log the full error server-side so it's visible in the terminal
      console.error("[Auth0 onCallback error]", {
        message: error.message,
        code: (error as unknown as Record<string, unknown>).code,
        causeCode: ((error as unknown as Record<string, unknown>).cause as Record<string, unknown>)?.code,
        causeMessage: ((error as unknown as Record<string, unknown>).cause as Record<string, unknown>)?.message,
        status: ((error as unknown as Record<string, unknown>).cause as Record<string, unknown>)?.status,
      });
      const url = new URL("/dashboard/connections", base);
      url.searchParams.set("error", error.message || "Authentication failed");
      return NextResponse.redirect(url);
    }
    const returnTo = ctx.returnTo || "/dashboard";
    return NextResponse.redirect(new URL(returnTo, base));
  },
});
