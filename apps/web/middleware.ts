import { NextRequest, NextResponse } from "next/server";

/**
 * Redirect /auth/callback to / so stale cached proxy responses don't show 404.
 *
 * This is a safety net. The primary auth flow (GIS Code Client) never uses
 * /auth/callback at all — it POSTs to /api/auth/google-code and gets JSON back.
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
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/auth/callback", "/auth/callback/"],
};
