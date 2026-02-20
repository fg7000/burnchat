import { apiClient } from "./api-client";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/**
 * Sign in with Google.
 *
 * Tries multiple strategies in order:
 * 1. GIS One Tap (client-side, no page navigation)
 * 2. Popup-based OAuth redirect (opens /api/auth/google in a popup)
 * 3. Full-page redirect (last resort — registers service worker first to
 *    intercept the /auth/callback route on return)
 */
export function signInWithGoogle(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return tryGIS()
    .catch(() => signInWithPopup())
    .catch(() => signInWithRedirect());
}

/** GIS One Tap / popup flow (client-side only, no page navigation). */
function tryGIS(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return new Promise((resolve, reject) => {
    const google = (
      window as unknown as {
        google?: {
          accounts: {
            id: {
              initialize: (config: Record<string, unknown>) => void;
              prompt: (
                cb?: (notification: {
                  isNotDisplayed: () => boolean;
                  isSkippedMoment: () => boolean;
                }) => void
              ) => void;
            };
          };
        };
      }
    ).google;

    if (!google || !GOOGLE_CLIENT_ID) {
      reject(new Error("GIS not available"));
      return;
    }

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

/**
 * Popup-based OAuth redirect flow.
 *
 * Opens a popup to /api/auth/google. After authentication, the popup ends up
 * at a URL containing the JWT (either as `token=` or `auth_token=`). We poll
 * the popup's location to extract the token — the callback page doesn't even
 * need to load successfully.
 */
function signInWithPopup(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "/api/auth/google",
      "google-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (!popup) {
      reject(new Error("Popup blocked"));
      return;
    }

    const timeout = setTimeout(() => {
      clearInterval(interval);
      try { popup.close(); } catch { /* ignore */ }
      reject(new Error("Auth timeout"));
    }, 120_000); // 2 minute timeout

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error("Popup closed"));
          return;
        }

        // Reading popup.location throws while on a different origin (Google).
        // Once it returns to our origin, we can read the URL.
        const url = popup.location.href;

        // Look for the token in the URL (handles both old and new redirect styles)
        const match = url.match(/[?&](?:auth_)?token=([^&]+)/);
        if (match) {
          clearInterval(interval);
          clearTimeout(timeout);
          popup.close();

          const jwt = decodeURIComponent(match[1]);
          apiClient
            .getMe(jwt)
            .then((user) => resolve({ token: jwt, user }))
            .catch((err) => reject(err));
        }
      } catch {
        // Cross-origin error — popup is still on Google's domain, keep polling
      }
    }, 500);
  });
}

/**
 * Last-resort: full-page redirect to /api/auth/google.
 *
 * Before navigating away, registers the service worker (if supported)
 * so it's active when the browser returns to /auth/callback?token=JWT.
 * The SW intercepts the callback request and returns a page that
 * stores the token and redirects to /.
 */
function signInWithRedirect(): Promise<never> {
  return new Promise(async (_resolve, reject) => {
    try {
      // Ensure SW is registered and active before navigating away
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Wait for the SW to be active
        if (reg.installing || reg.waiting) {
          await new Promise<void>((resolve) => {
            const sw = reg.installing || reg.waiting;
            if (!sw) { resolve(); return; }
            sw.addEventListener("statechange", () => {
              if (sw.state === "activated") resolve();
            });
            // Timeout after 3 seconds — don't block forever
            setTimeout(resolve, 3000);
          });
        }
      }
    } catch {
      // SW registration failed — proceed anyway, the trailingSlash fix
      // or not-found.tsx safety net should handle the callback
    }

    // Navigate the main page to the OAuth endpoint
    window.location.href = "/api/auth/google";

    // This promise never resolves — the page navigates away
    // If somehow the navigation fails, reject after a timeout
    setTimeout(() => reject(new Error("Redirect failed")), 5000);
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
