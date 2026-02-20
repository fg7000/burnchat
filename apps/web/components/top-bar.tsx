"use client";

import { useState } from "react";
import { Shield, LogIn, User } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { signInWithGoogle } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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
  const [signInError, setSignInError] = useState<string | null>(null);

  const isSignedIn = !!token && !!email;

  const handleSignIn = () => {
    // Navigate to a self-contained auth page served by the backend.
    // This bypasses any proxy-cached frontend JS that might use old
    // redirect-based OAuth. The backend page has GIS Code Client inline.
    window.location.href = "/api/auth/signin-page";
  };

  const handleSignOut = () => {
    clearAuth();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-gray-800 bg-gray-950/95 backdrop-blur supports-[backdrop-filter]:bg-gray-950/80">
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-white" />
          <span className="text-lg font-semibold text-white">BurnChat</span>
        </div>

        {/* Right: Model Selector + Credits + User */}
        <div className="flex items-center gap-3">
          {/* Model Selector */}
          <ModelSelector />

          {/* Credit Display */}
          <CreditDisplay />

          {/* User area */}
          {isSignedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-700">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="max-w-[160px] truncate">{email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm text-gray-300">{email}</p>
                  <p className="text-xs text-gray-500">
                    {creditBalance} credits remaining
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowCreditModal(true)}
                  className="text-gray-300"
                >
                  Buy Credits
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-gray-400 focus:text-gray-300"
                >
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              {signInError && (
                <span className="text-xs text-red-400 max-w-[200px] truncate" title={signInError}>
                  {signInError}
                </span>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleSignIn}
                disabled={signingIn}
                className="gap-1.5"
              >
                <LogIn className="h-4 w-4" />
                {signingIn ? "Signing in..." : "Sign in with Google"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
