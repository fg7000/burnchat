import { apiClient } from "./api-client";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/**
 * Sign in with Google using a popup window.
 *
 * Opens /api/auth/google in a popup. The server redirects to Google, the user
 * authenticates, and eventually the popup lands on a URL with `token=` or
 * `auth_token=` in the query string.  We poll the popup's URL until we see the
 * token, then extract it — even if the popup page itself 404s.
 *
 * Falls back to GIS One Tap if available, but the popup approach is the
 * primary flow because it works behind web-IDE proxies / tunnels where
 * server-side redirects may be cached.
 */
export function signInWithGoogle(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  // Try GIS (Google Identity Services) first — purely client-side, no redirects.
  return tryGIS().catch(() => signInWithPopup());
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
