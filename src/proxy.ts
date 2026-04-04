import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function proxy(request: NextRequest) {
  const authResponse = await auth0.middleware(request);

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/dashboard")) {
    const session = await auth0.getSession();
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
