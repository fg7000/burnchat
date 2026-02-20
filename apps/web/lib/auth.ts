import { apiClient } from "./api-client";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/* ------------------------------------------------------------------ */
/*  Type shims for Google Identity Services (loaded via <script> tag) */
/* ------------------------------------------------------------------ */

interface GoogleOAuth2CodeClient {
  requestCode: () => void;
}

interface GoogleAccounts {
  id: {
    initialize: (config: Record<string, unknown>) => void;
    prompt: (
      cb?: (notification: {
        isNotDisplayed: () => boolean;
        isSkippedMoment: () => boolean;
      }) => void
    ) => void;
  };
  oauth2: {
    initCodeClient: (config: {
      client_id: string;
      scope: string;
      ux_mode: string;
      callback: (response: { code?: string; error?: string }) => void;
      error_callback?: (error: { type: string; message?: string }) => void;
    }) => GoogleOAuth2CodeClient;
  };
}

declare const google: { accounts: GoogleAccounts } | undefined;

/* ------------------------------------------------------------------ */

/**
 * Wait for the Google Identity Services library to load.
 * The <script src="https://accounts.google.com/gsi/client" async defer>
 * tag in layout.tsx may not have finished loading by the time the user
 * clicks "Sign In". This polls until `google.accounts.oauth2` is available.
 */
function waitForGIS(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (typeof google !== "undefined" && google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if (typeof google !== "undefined" && google?.accounts?.oauth2) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error(
          "Google sign-in library failed to load. Check your internet connection or try disabling ad blockers."
        ));
      }
    }, 100);
  });
}

/**
 * Sign in with Google.
 *
 * Uses google.accounts.oauth2.initCodeClient() which opens a Google-managed
 * popup (NOT window.open — not blocked by popup blockers). The authorization
 * code is sent to our backend via a POST API call.
 *
 * No server-side redirects. No callback URLs. No 404s.
 *
 * IMPORTANT: We deliberately do NOT fall back to redirect-based OAuth flows
 * (signInWithPopup / signInWithRedirect). This environment uses a proxy that
 * aggressively caches responses, including 404s and redirects. Redirect-based
 * flows always fail because the proxy serves stale cached responses.
 */
export function signInWithGoogle(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  if (!GOOGLE_CLIENT_ID) {
    return Promise.reject(new Error("Google Client ID is not configured"));
  }

  // Wait for GIS library, then try code client, then try one-tap
  return waitForGIS()
    .then(() => tryGISCodeClient())
    .catch((codeErr) => {
      console.warn("[auth] GIS Code Client failed:", codeErr.message);
      return tryGISOneTap().catch((tapErr) => {
        console.warn("[auth] GIS One Tap failed:", tapErr.message);
        // Both GIS methods failed — throw a user-friendly error
        throw new Error(
          "Google sign-in failed. Please allow popups for this site and try again."
        );
      });
    });
}

/**
 * PRIMARY: Google Identity Services OAuth2 Code Client.
 *
 * Opens Google's own consent popup (managed by Google's JS library).
 * Returns an authorization code that we POST to our backend.
 * Zero redirects. Zero callback URLs. Works in sandboxed environments.
 */
function tryGISCodeClient(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return new Promise((resolve, reject) => {
    if (typeof google === "undefined" || !google?.accounts?.oauth2 || !GOOGLE_CLIENT_ID) {
      reject(new Error("GIS OAuth2 not available"));
      return;
    }

    console.log("[auth] Starting GIS Code Client flow");

    const client = google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "email profile openid",
      ux_mode: "popup",
      callback: async (response) => {
        if (response.error || !response.code) {
          console.error("[auth] GIS callback error:", response.error);
          reject(new Error(response.error || "No authorization code received"));
          return;
        }
        try {
          console.log("[auth] Got auth code, exchanging with backend...");
          const data = await apiClient.exchangeGoogleCode(response.code);
          console.log("[auth] Code exchange successful");
          resolve({
            token: data.token,
            user: {
              user_id: data.user_id,
              email: data.email,
              credit_balance: data.credit_balance,
            },
          });
        } catch (err) {
          console.error("[auth] Code exchange failed:", err);
          reject(err);
        }
      },
      error_callback: (error) => {
        console.error("[auth] GIS error_callback:", error);
        reject(new Error(error?.message || "GIS OAuth2 error"));
      },
    });

    client.requestCode();
  });
}

/** GIS One Tap / ID token flow (client-side only, no page navigation). */
function tryGISOneTap(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return new Promise((resolve, reject) => {
    if (typeof google === "undefined" || !google?.accounts?.id || !GOOGLE_CLIENT_ID) {
      reject(new Error("GIS not available"));
      return;
    }

    console.log("[auth] Starting GIS One Tap flow");

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        try {
          const data = await apiClient.verifyGoogleToken(response.credential);
          const user = await apiClient.getMe(data.token);
          resolve({ token: data.token, user });
        } catch (err) {
          reject(err);
        }
      },
      ux_mode: "popup",
    });

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error("GIS prompt blocked"));
      }
    });
  });
}

export function encryptMapping(
  mapping: Array<{ original: string; replacement: string; entity_type: string }>,
  _token: string
): string {
  const data = JSON.stringify(mapping);
  const encoded = btoa(unescape(encodeURIComponent(data)));
  return encoded;
}

export function decryptMapping(
  encrypted: string,
  _token: string
): Array<{ original: string; replacement: string; entity_type: string }> {
  try {
    const decoded = decodeURIComponent(escape(atob(encrypted)));
    return JSON.parse(decoded);
  } catch {
    return [];
  }
}
