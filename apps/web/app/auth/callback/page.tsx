export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

/**
 * Server Component — no "use client" needed.
 *
 * This page exists solely to redirect /auth/callback?token=X to /?token=X.
 * By using a server-side redirect, we bypass ALL client-side hydration,
 * routing, and service worker issues that previously caused 404s.
 *
 * The middleware.ts also performs this redirect, but this is a defense-in-depth
 * fallback for any edge case where the middleware doesn't fire.
 */
export default function AuthCallback({
  searchParams,
}: {
  searchParams: { token?: string; auth_token?: string; code?: string };
}) {
  const token = searchParams.token || searchParams.auth_token;

  if (token) {
    redirect(`/?token=${encodeURIComponent(token)}`);
  }

  // If we got a "code" param, this is an OAuth callback that should have
  // gone through /api/auth/callback instead. Redirect there.
  if (searchParams.code) {
    redirect(`/api/auth/callback?code=${encodeURIComponent(searchParams.code)}`);
  }

  // No params at all — just go home
  redirect("/");
}
