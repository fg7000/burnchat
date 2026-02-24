"use client";

import React, { useState } from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { signInWithGoogle } from "@/lib/auth";
import { Shield } from "lucide-react";

export default function SignInModal() {
  const showSignInModal = useUIStore((s) => s.showSignInModal);
  const setShowSignInModal = useUIStore((s) => s.setShowSignInModal);
  const setPendingAction = useUIStore((s) => s.setPendingAction);
  const setAuth = useSessionStore((s) => s.setAuth);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!showSignInModal) return null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      setAuth(
        result.token,
        result.user.user_id,
        result.user.email,
        result.user.credit_balance
      );
      setShowSignInModal(false);
      // pendingAction remains in store — useEffects in chat-input / attachment-menu will resume it
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign-in failed. Please try again."
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDismiss = () => {
    setShowSignInModal(false);
    setPendingAction(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.8)",
      }}
      onClick={handleDismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#111113",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 16,
          padding: "36px 32px 28px",
          maxWidth: 380,
          width: "100%",
          textAlign: "center",
          animation: "fadeInUp 0.3s ease",
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "rgba(255, 107, 53, 0.08)",
            border: "1px solid rgba(255, 107, 53, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <Shield style={{ width: 28, height: 28, color: "#ff6b35" }} />
        </div>

        {/* Title */}
        <h2
          className="font-primary"
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: "#ffffff",
            marginBottom: 8,
          }}
        >
          Sign in to continue
        </h2>

        {/* Subtitle */}
        <p
          className="font-primary"
          style={{
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.35)",
            lineHeight: 1.5,
            marginBottom: 28,
          }}
        >
          Your identity stays hidden from AI. We only use Google to manage your
          credits.
        </p>

        {/* Error message */}
        {error && (
          <p
            className="font-primary"
            style={{
              fontSize: 12,
              color: "#ff3c1e",
              marginBottom: 16,
              padding: "8px 12px",
              background: "rgba(255, 60, 30, 0.08)",
              borderRadius: 8,
              border: "1px solid rgba(255, 60, 30, 0.15)",
            }}
          >
            {error}
          </p>
        )}

        {/* Sign in with Google button */}
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="font-primary"
          style={{
            width: "100%",
            padding: "12px 24px",
            borderRadius: 10,
            background: "#ffffff",
            border: "none",
            color: "#1a1a1a",
            fontSize: 14,
            fontWeight: 500,
            cursor: isSigningIn ? "wait" : "pointer",
            opacity: isSigningIn ? 0.7 : 1,
            transition: "opacity 0.25s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isSigningIn ? "Signing in..." : "Sign in with Google"}
        </button>

        {/* Credits note */}
        <p
          className="font-primary"
          style={{
            fontSize: 11,
            color: "rgba(255, 255, 255, 0.25)",
            marginTop: 16,
          }}
        >
          100 free credits to start. No card required.
        </p>
      </div>
    </div>
  );
}
