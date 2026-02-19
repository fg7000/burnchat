"use client";

import { useState } from "react";
import { Coins, Lock, LogIn, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { redirectToCheckout } from "@/lib/stripe";
import { getGoogleAuthUrl } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

export default function CreditPurchaseModal() {
  const { token, creditBalance } = useSessionStore();
  const { showCreditModal, setShowCreditModal } = useUIStore();
  const [selectedPackage, setSelectedPackage] = useState("standard");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignedIn = !!token;

  const handlePurchase = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiClient.purchaseCredits(selectedPackage, token);
      if (result.checkout_url) {
        await redirectToCheckout(result.checkout_url);
      } else {
        setError("Failed to create checkout session. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    window.location.href = getGoogleAuthUrl();
  };

  return (
    <Dialog open={showCreditModal} onOpenChange={setShowCreditModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-gray-300" />
            Buy Credits
          </DialogTitle>
        </DialogHeader>

        {/* Current balance */}
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3">
          <p className="text-sm text-gray-400">Current balance</p>
          <p className="text-2xl font-semibold text-gray-100">
            {formatCredits(creditBalance)}{" "}
            <span className="text-sm font-normal text-gray-500">credits</span>
          </p>
        </div>

        {isSignedIn ? (
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
