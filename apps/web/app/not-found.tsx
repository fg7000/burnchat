"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";

export default function NotFound() {
  const [isAuthCallback, setIsAuthCallback] = useState(false);
  const { setAuth } = useSessionStore();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || params.get("auth_token");

    // If we landed on a 404 page with a token in the URL, this is likely
    // the OAuth callback that the static server couldn't route. Handle it.
    if (token) {
      setIsAuthCallback(true);

      // Store in localStorage so the main page can pick it up
      try {
        localStorage.setItem("burnchat_pending_token", token);
      } catch { /* storage blocked */ }

      // If opened as a popup, notify the opener and close
      if (window.opener) {
        try {
          window.opener.postMessage(
            { type: "burnchat_auth_token", token },
            "*"
          );
        } catch { /* ignore */ }
        setTimeout(() => window.close(), 400);
        return;
      }

      // Otherwise, try to call the API and set auth, then redirect home
      apiClient
        .getMe(token)
        .then((user) => {
          setAuth(token, user.user_id, user.email, user.credit_balance);
          window.location.replace("/");
        })
        .catch(() => {
          // API failed but token is in localStorage — redirect home anyway
          window.location.replace("/");
        });
    }
  }, [setAuth]);

  if (isAuthCallback) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
          <p className="text-gray-400">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Page not found</h2>
      <p className="text-gray-400">The page you are looking for does not exist.</p>
      <a
        href="/"
        className="rounded bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
      >
        Go home
      </a>
    </div>
  );
}
