import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware that:
 * 1. Redirects /auth/callback to / (safety net for stale cached proxy responses)
 * 2. Adds aggressive anti-cache headers to ALL responses to defeat proxy caching
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Redirect /auth/callback to / with token preserved
  if (pathname === "/auth/callback" || pathname === "/auth/callback/") {
    const token = searchParams.get("token") || searchParams.get("auth_token");
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.delete("auth_token");
      url.searchParams.set("token", token);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Add aggressive anti-cache headers to ALL responses
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Surrogate-Control", "no-store");
  response.headers.set("Vary", "*");

  return response;
}

export const config = {
  // Match all paths except static files and API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
