import { apiClient } from "./api-client";

export function getGoogleAuthUrl(): string {
  return apiClient.getGoogleAuthUrl();
}

export function extractTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
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
