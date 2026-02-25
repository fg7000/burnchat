"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { signInWithGoogle } from "@/lib/auth";
import ModelSelector from "@/components/model-selector";
import CreditDisplay from "@/components/credit-display";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export default function TopBar() {
  const { email, token, creditBalance, clearAuth, setAuth } = useSessionStore();
  const { setShowCreditModal } = useUIStore();
  const [signingIn, setSigningIn] = useState(false);

  const isSignedIn = !!token && !!email;

  const handleSignIn = () => {
    setSigningIn(true);
    signInWithGoogle()
      .then(({ token: jwt, user }) => {
        setAuth(jwt, user.user_id, user.email, user.credit_balance);
      })
      .catch((err) => {
        console.error("[auth] Sign-in failed:", err.message);
      })
      .finally(() => setSigningIn(false));
  };

  const handleSignOut = () => {
    clearAuth();
    try { localStorage.removeItem("burnchat_auth"); } catch { /* ignore */ }
    window.location.href = "/";
  };

  const initial = email ? email[0].toUpperCase() : "?";

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 h-14"
      style={{
        background: "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center accent-gradient-bg"
            style={{
              width: 30,
              height: 30,
              borderRadius: "var(--radius-sm)",
            }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#0a0a0b",
                lineHeight: 1,
              }}
            >
              B
            </span>
          </div>
          <span
            className="font-primary"
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            burnchat
          </span>
        </div>

        {/* Right: Model Selector + Credits + User */}
        <div className="flex items-center gap-3">
          <ModelSelector />
          <CreditDisplay />

          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                  }}
                >
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-3 py-2">
                  <p
                    className="font-primary"
                    style={{ fontSize: 13, color: "var(--text-primary)" }}
                  >
                    {email}
                  </p>
                  <p
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      color: "var(--text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    {creditBalance} credits remaining
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowCreditModal(true)}>
                  Buy Credits
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="flex items-center gap-1.5 font-primary"
              style={{
                height: 32,
                padding: "0 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 400,
              }}
            >
              <LogIn style={{ width: 14, height: 14 }} />
              {signingIn ? "Signing in..." : "Sign in"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
