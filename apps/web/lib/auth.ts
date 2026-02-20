import { apiClient } from "./api-client";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/**
 * Trigger Google Sign-In using Google Identity Services (client-side popup).
 * Returns a Promise that resolves with { token, user } on success.
 * This avoids the redirect-based OAuth flow which breaks behind web-IDE proxies.
 */
export function signInWithGoogle(): Promise<{
  token: string;
  user: { user_id: string; email: string; credit_balance: number };
}> {
  return new Promise((resolve, reject) => {
    const google = (window as unknown as { google?: { accounts: { id: {
      initialize: (config: Record<string, unknown>) => void;
      prompt: (cb?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
    } } } }).google;

    if (!google) {
      reject(new Error("Google Identity Services not loaded"));
      return;
    }

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        try {
          // Send the Google ID token to our backend
          const data = await apiClient.verifyGoogleToken(response.credential);
          // Fetch full user info
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
        reject(new Error("Google sign-in popup was blocked or dismissed"));
      }
    });
  });
}

export function encryptMapping(
  mapping: Array<{ original: string; replacement: string; entity_type: string }>,
  _token: string
): string {
  // Simple base64 encoding. In production, use Web Crypto API with AES-GCM
  // using a key derived from the token.
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
