"use client";

import React from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { signInWithGoogle } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
      .catch(() => {
        window.location.href = "/api/auth/google";
      });
  };

  const handleBuyCredits = () => {
    setShowCreditModal(true);
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div
        className={cn(
          "bg-gray-800/50 border border-gray-700 rounded-lg p-6",
          "max-w-sm w-full text-center space-y-4"
        )}
      >
        <div className="text-2xl font-semibold text-gray-100">
          You&apos;re out of credits!
        </div>

        {!isSignedIn ? (
          <>
            <p className="text-sm text-gray-400">
              Sign in with Google to buy more credits
            </p>
            <Button onClick={handleGoogleSignIn} className="w-full gap-2">
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">
              Buy more credits to continue
            </p>
            <Button onClick={handleBuyCredits} className="w-full gap-2">
              <CreditCard className="h-4 w-4" />
              Buy Credits
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
