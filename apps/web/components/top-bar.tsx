"use client";

import React from "react";
import { useSessionStore } from "@/store/session-store";
import ModelSelector from "./model-selector";
import CreditDisplay from "./credit-display";

export function TopBar() {
  const token = useSessionStore((s) => s.token);
  const startGoogleLogin = useSessionStore((s) => s.startGoogleLogin);

  return (
    <nav
      className="flex justify-between items-center px-8 py-4 relative z-10"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #ff6b35, #ff3c1e)",
            fontSize: "14px",
            fontWeight: 500,
            color: "#0a0a0b",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-1px",
          }}
        >
          B
        </div>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          burnchat
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">
        <ModelSelector />
        <CreditDisplay />
        {token ? (
          <div
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1e1e22, #141416)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            U
          </div>
        ) : (
          <button
            onClick={startGoogleLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              fontSize: "13px",
              fontWeight: 400,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Sign in with Google
          </button>
        )}
      </div>
    </nav>
  );
}

export default TopBar;
