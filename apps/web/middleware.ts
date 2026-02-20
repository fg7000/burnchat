import { NextRequest, NextResponse } from "next/server";

/**
 * Redirect /auth/callback?token=X to /?token=X so the main page handles auth.
 *
 * This catches any lingering cached redirects, browser history entries, or
 * code paths that still send users to /auth/callback with a token param.
 * Running as Next.js middleware means it executes server-side before the
 * App Router, avoiding client-side hydration issues.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  console.log(`[middleware] ${request.method} ${pathname}?${searchParams.toString()}`);

  if (pathname === "/auth/callback" || pathname === "/auth/callback/") {
    const token = searchParams.get("token") || searchParams.get("auth_token");
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.delete("auth_token");
      url.searchParams.set("token", token);
      console.log(`[middleware] Redirecting to /?token=...`);
      return NextResponse.redirect(url);
    }
    // No token — redirect to home anyway (page component also does this)
    console.log(`[middleware] No token, redirecting to /`);
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Match ALL paths to log what the browser actually requests
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
