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
 * Sign in with Google.
 *
 * Primary strategy: use google.accounts.oauth2.initCodeClient() which opens
 * a Google-managed popup (NOT window.open — not blocked by popup blockers).
 * The authorization code is sent to our backend via a POST API call.
 * No server-side redirects. No callback URLs. No 404s.
 *
 * Fallbacks (if GIS library not loaded):
 *   2. GIS One Tap (google.accounts.id.prompt)
 *   3. window.open popup with URL polling
 *   4. Full-page redirect (last resort)
 */
export function signInWithGoogle(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return tryGISCodeClient()
    .catch(() => tryGISOneTap())
    .catch(() => signInWithPopup())
    .catch(() => signInWithRedirect());
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

    const client = google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "email profile openid",
      ux_mode: "popup",
      callback: async (response) => {
        if (response.error || !response.code) {
          reject(new Error(response.error || "No authorization code received"));
          return;
        }
        try {
          const data = await apiClient.exchangeGoogleCode(response.code);
          resolve({
            token: data.token,
            user: {
              user_id: data.user_id,
              email: data.email,
              credit_balance: data.credit_balance,
            },
          });
        } catch (err) {
          reject(err);
        }
      },
      error_callback: (error) => {
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
 * Opens /api/auth/google in a popup and polls the URL for the token.
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
    }, 120_000);

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          clearTimeout(timeout);
          reject(new Error("Popup closed"));
          return;
        }
        const url = popup.location.href;
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
        // Cross-origin error — popup is still on Google's domain
      }
    }, 500);
  });
}

/**
 * Last-resort: full-page redirect to /api/auth/google.
 */
function signInWithRedirect(): Promise<never> {
  return new Promise((_resolve, reject) => {
    window.location.href = "/api/auth/google";
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
