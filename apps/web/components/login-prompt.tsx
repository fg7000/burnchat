"use client";

import React from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { signInWithGoogle } from "@/lib/auth";
import { LogIn, CreditCard } from "lucide-react";

export default function LoginPrompt() {
  const token = useSessionStore((s) => s.token);
  const email = useSessionStore((s) => s.email);
  const setAuth = useSessionStore((s) => s.setAuth);
  const setShowCreditModal = useUIStore((s) => s.setShowCreditModal);

  const isSignedIn = !!token && !!email;

  const handleGoogleSignIn = () => {
    signInWithGoogle()
      .then(({ token: jwt, user }) => {
        setAuth(jwt, user.user_id, user.email, user.credit_balance);
      })
      .catch(() => {});
  };

  const handleBuyCredits = () => {
    setShowCreditModal(true);
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          maxWidth: 360,
          width: "100%",
          textAlign: "center",
        }}
      >
        <div className="font-primary" style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", marginBottom: 16 }}>
          You&apos;re out of credits!
        </div>

        {!isSignedIn ? (
          <>
            <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Sign in with Google to buy more credits
            </p>
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2 accent-gradient-bg font-primary"
              style={{
                padding: "10px 0",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 500,
                color: "#0a0a0b",
                border: "none",
                cursor: "pointer",
              }}
            >
              <LogIn style={{ width: 16, height: 16 }} />
              Sign in with Google
            </button>
          </>
        ) : (
          <>
            <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Buy more credits to continue
            </p>
            <button
              onClick={handleBuyCredits}
              className="w-full flex items-center justify-center gap-2 accent-gradient-bg font-primary"
              style={{
                padding: "10px 0",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                fontWeight: 500,
                color: "#0a0a0b",
                border: "none",
                cursor: "pointer",
              }}
            >
              <CreditCard style={{ width: 16, height: 16 }} />
              Buy Credits
            </button>
          </>
        )}
      </div>
    </div>
  );
}
