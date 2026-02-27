"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSessionStore } from "@/store/session-store";
import { signInWithGoogle } from "@/lib/auth";
import ModelSelector from "./model-selector";
import CreditDisplay from "./credit-display";

export default function TopBar() {
  const [signingIn, setSigningIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const token = useSessionStore((s) => s.token);
  const email = useSessionStore((s) => s.email);
  const setAuth = useSessionStore((s) => s.setAuth);
  const clearAuth = useSessionStore((s) => s.clearAuth);

  const handleSignIn = () => {
    setSigningIn(true);
    signInWithGoogle()
      .then(({ token: jwt, user }) => {
        setAuth(jwt, user.user_id, user.email, user.credit_balance);
      })
      .catch((err) => {
        console.error("[top-bar] Sign-in failed:", err);
      })
      .finally(() => setSigningIn(false));
  };

  const handleSignOut = () => {
    clearAuth();
    try { localStorage.removeItem("burnchat_auth"); } catch {}
    window.location.href = "/";
  };

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = email ? email[0].toUpperCase() : "U";

  return (
    <nav className="flex justify-between items-center px-8 py-4 relative z-10" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center" style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#161618", border: "1px solid rgba(255,255,255,0.06)", fontSize: "15px" }}>🔥</div>
        <span style={{ fontSize: "15px", fontWeight: 500, letterSpacing: "-0.02em", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>burnchat</span>
        <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)", marginLeft: "2px", marginRight: "2px" }} />
        <span style={{ fontSize: "12px", color: "#ff6b35", fontWeight: 500, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em" }}>The VPN for AI</span>
      </div>
      <div className="flex items-center gap-5">
        <ModelSelector />
        <CreditDisplay />
        {token ? (
          <div ref={menuRef} className="relative">
            <div
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center justify-center cursor-pointer"
              style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg, #1e1e22, #141416)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}
            >
              {initial}
            </div>
            {showMenu && (
              <div style={{ position: "absolute", top: "36px", right: 0, background: "#141416", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "4px", minWidth: "160px", zIndex: 50 }}>
                <div style={{ padding: "6px 12px", fontSize: "12px", color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "4px" }}>
                  {email}
                </div>
                <button
                  onClick={handleSignOut}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", fontSize: "13px", color: "rgba(255,255,255,0.6)", background: "none", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleSignIn} disabled={signingIn} className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 400, fontFamily: "'DM Sans', sans-serif", cursor: signingIn ? "wait" : "pointer", opacity: signingIn ? 0.6 : 1 }}>
            {signingIn ? "Signing in..." : "Sign in with Google"}
          </button>
        )}
      </div>
    </nav>
  );
}
