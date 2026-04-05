import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function proxy(request: NextRequest) {
  const authResponse = await auth0.middleware(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    // In Edge middleware, pass `request` to getSession() so the SDK reads
    // session cookies from the incoming request rather than ambient context.
    // Calling getSession() without an argument in Edge runtime can return null
    // for a valid session, causing a spurious /auth/login redirect that
    // overwrites the OAuth state cookie and produces invalid_state on callback.
    const session = await auth0.getSession(request);
    if (!session) {
      const loginUrl = new URL("/auth/login", request.nextUrl.origin);
      loginUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return authResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
