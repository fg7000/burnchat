"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Coins, Lock, LogIn, Loader2, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { redirectToCheckout } from "@/lib/stripe";
import { signInWithGoogle } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  badge?: string;
}

const PACKAGES: CreditPackage[] = [
  { id: "starter", name: "Starter", credits: 500, price: 5 },
  { id: "standard", name: "Standard", credits: 2200, price: 20, badge: "Popular" },
  { id: "power", name: "Power", credits: 6000, price: 50, badge: "20% bonus" },
  { id: "pro", name: "Pro", credits: 13000, price: 100, badge: "30% bonus" },
];

function formatCredits(n: number): string {
  return n.toLocaleString("en-US");
}

const POLL_INTERVAL_MS = 3000;

export default function CreditPurchaseModal() {
  const { token, creditBalance, setCreditBalance } = useSessionStore();
  const { showCreditModal, setShowCreditModal, creditModalReason } = useUIStore();
  const [selectedPackage, setSelectedPackage] = useState("standard");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSignedIn = !!token;
  const isExhausted = creditModalReason === "exhausted";

  // Poll for balance updates after Stripe checkout opens in new tab
  const startPolling = useCallback(() => {
    if (!token || pollIntervalRef.current) return;
    setIsPolling(true);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const data = await apiClient.getCreditBalance(token);
        const newBalance = data.credit_balance;
        if (newBalance > 0) {
          setCreditBalance(newBalance);
          setAwaitingPayment(false);
          setShowCreditModal(false);
          // Stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setIsPolling(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, POLL_INTERVAL_MS);
  }, [token, setCreditBalance, setShowCreditModal]);

  // Cleanup polling on unmount or when modal closes
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Reset awaiting state when modal is reopened
  useEffect(() => {
    if (showCreditModal) {
      setAwaitingPayment(false);
      setError(null);
    }
  }, [showCreditModal]);

  const handlePurchase = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.purchaseCredits(selectedPackage, token);
      if (result.checkout_url) {
        if (isExhausted) {
          // Open in new tab to preserve session state
          window.open(result.checkout_url, "_blank");
          setAwaitingPayment(true);
          startPolling();
        } else {
          // Normal flow: redirect in same tab
          await redirectToCheckout(result.checkout_url);
        }
      } else {
        setError("Failed to create checkout session. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    if (!token) return;
    setIsPolling(true);
    try {
      const data = await apiClient.getCreditBalance(token);
      const newBalance = data.credit_balance;
      setCreditBalance(newBalance);
      if (newBalance > 0) {
        setAwaitingPayment(false);
        setShowCreditModal(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    } catch {
      setError("Could not check balance. Please try again.");
    } finally {
      setIsPolling(false);
    }
  };

  const handleSignIn = () => {
    signInWithGoogle()
      .then(({ token: jwt, user }) => {
        useSessionStore.getState().setAuth(jwt, user.user_id, user.email, user.credit_balance);
      })
      .catch(() => {
        // All flows failed — popup was likely blocked
      });
  };

  const handleOpenChange = (open: boolean) => {
    // Prevent closing the modal when credits are exhausted
    if (!open && isExhausted) return;
    setShowCreditModal(open);
  };

  return (
    <Dialog open={showCreditModal} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn("sm:max-w-md", isExhausted && "[&>button:last-child]:hidden")}
        onPointerDownOutside={isExhausted ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isExhausted ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isExhausted ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Credits Exhausted
              </>
            ) : (
              <>
                <Coins className="h-5 w-5 text-gray-300" />
                Buy Credits
              </>
            )}
          </DialogTitle>
          {isExhausted && (
            <DialogDescription className="text-gray-400">
              Purchase credits to continue chatting. Your session and documents are saved.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Current balance */}
        <div className={cn(
          "rounded-lg border px-4 py-3",
          isExhausted
            ? "border-amber-800/50 bg-amber-950/20"
            : "border-gray-700 bg-gray-800/50"
        )}>
          <p className="text-sm text-gray-400">Current balance</p>
          <p className={cn(
            "text-2xl font-semibold",
            isExhausted ? "text-amber-300" : "text-gray-100"
          )}>
            {formatCredits(Math.max(0, creditBalance))}{" "}
            <span className="text-sm font-normal text-gray-500">credits</span>
          </p>
        </div>

        {isSignedIn ? (
          awaitingPayment ? (
            /* Waiting for payment completion */
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <ExternalLink className="h-4 w-4" />
                <span>Complete your payment in the new tab</span>
              </div>
              <p className="text-xs text-gray-500 text-center">
                We&apos;ll detect your payment automatically, or click below to check manually.
              </p>
              <Button
                onClick={handleManualRefresh}
                disabled={isPolling}
                variant="outline"
                className="gap-2"
              >
                {isPolling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Check Balance
                  </>
                )}
              </Button>
              <Button
                onClick={() => setAwaitingPayment(false)}
                variant="ghost"
                size="sm"
                className="text-xs text-gray-500"
              >
                Choose a different package
              </Button>
            </div>
          ) : (
            <>
              {/* Package selection */}
              <div className="space-y-2">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                      selectedPackage === pkg.id
                        ? "border-white bg-gray-800"
                        : "border-gray-700 bg-gray-800/30 hover:border-gray-600"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Radio indicator */}
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border-2",
                          selectedPackage === pkg.id
                            ? "border-white"
                            : "border-gray-600"
                        )}
                      >
                        {selectedPackage === pkg.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200">
                            {pkg.name}
                          </span>
                          {pkg.badge && (
                            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold text-gray-300">
                              {pkg.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatCredits(pkg.credits)} credits
                        </span>
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-gray-100">
                      ${pkg.price}
                    </span>
                  </button>
                ))}
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-gray-400">{error}</p>
              )}

              {/* Purchase button */}
              <Button
                onClick={handlePurchase}
                disabled={isLoading}
                className="w-full gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Pay with Stripe"
                )}
              </Button>

              {/* Footer info */}
              <div className="flex flex-col items-center gap-1 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Lock className="h-3 w-3" />
                  <span>Secure payment via Stripe</span>
                </div>
                <p className="text-xs text-gray-500">Credits never expire</p>
              </div>
            </>
          )
        ) : (
          /* Not signed in state */
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-sm text-gray-400">
              Sign in first to purchase credits
            </p>
            <Button onClick={handleSignIn} className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign in with Google
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
