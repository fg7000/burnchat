"use client";

import React from "react";
import { useUIStore } from "@/store/ui-store";
import { useSessionStore } from "@/store/session-store";

export default function SignInModal() {
  const showSignInModal = useUIStore((s) => s.showSignInModal);
  const setShowSignInModal = useUIStore((s) => s.setShowSignInModal);
  const setPendingAction = useUIStore((s) => s.setPendingAction);
  const startGoogleLogin = useSessionStore((s) => s.startGoogleLogin);

  if (!showSignInModal) return null;

  return (
    <div
      onClick={() => { setShowSignInModal(false); setPendingAction(null); }}
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "40px 32px", maxWidth: "400px", width: "90%", textAlign: "center" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(255, 107, 53, 0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </div>
        <h2 style={{ fontSize: "20px", fontWeight: 400, color: "#fff", marginBottom: "8px", fontFamily: "'DM Sans', sans-serif" }}>Sign in to continue</h2>
        <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: "28px", fontFamily: "'DM Sans', sans-serif" }}>Your identity stays hidden from AI. We only use Google to manage your credits.</p>
        <button onClick={() => { setShowSignInModal(false); startGoogleLogin(); }} style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "#fff", color: "#111", border: "none", fontSize: "14px", fontWeight: 500, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Sign in with Google
        </button>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "16px", fontFamily: "'JetBrains Mono', monospace" }}>100 free credits to start. No card required.</p>
      </div>
    </div>
  );
}
