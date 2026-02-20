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

  if (pathname === "/auth/callback" || pathname === "/auth/callback/") {
    const token = searchParams.get("token") || searchParams.get("auth_token");
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.delete("auth_token");
      url.searchParams.set("token", token);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/callback", "/auth/callback/"],
};
