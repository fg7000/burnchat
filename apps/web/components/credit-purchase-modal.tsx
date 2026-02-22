"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Lock, LogIn, Loader2, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { redirectToCheckout } from "@/lib/stripe";
import { signInWithGoogle } from "@/lib/auth";
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
  bonus?: string;
}

const PACKAGES: CreditPackage[] = [
  { id: "starter", name: "Starter", credits: 500, price: 5 },
  { id: "standard", name: "Standard", credits: 2200, price: 20, badge: "most popular" },
  { id: "power", name: "Power", credits: 6000, price: 50, bonus: "+10%" },
  { id: "pro", name: "Pro", credits: 13000, price: 100, bonus: "+30%" },
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

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

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
          window.open(result.checkout_url, "_blank");
          setAwaitingPayment(true);
          startPolling();
        } else {
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
      .catch(() => {});
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && isExhausted) return;
    setShowCreditModal(open);
  };

  return (
    <Dialog open={showCreditModal} onOpenChange={handleOpenChange}>
      <DialogContent
        className={isExhausted ? "[&>button:last-child]:hidden" : ""}
        onPointerDownOutside={isExhausted ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isExhausted ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2 font-primary" style={{ fontSize: 20, fontWeight: 400 }}>
              {isExhausted ? (
                <>
                  <AlertTriangle style={{ width: 20, height: 20, color: "var(--accent)" }} />
                  Credits Exhausted
                </>
              ) : (
                "Add credits"
              )}
            </span>
          </DialogTitle>
          {isExhausted && (
            <DialogDescription>
              Purchase credits to continue chatting. Your session and documents are saved.
            </DialogDescription>
          )}
        </DialogHeader>

        {isSignedIn ? (
          awaitingPayment ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="flex items-center gap-2 font-primary" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <ExternalLink style={{ width: 16, height: 16 }} />
                <span>Complete your payment in the new tab</span>
              </div>
              <p className="font-primary text-center" style={{ fontSize: 12, color: "var(--text-muted)" }}>
                We&apos;ll detect your payment automatically, or click below to check manually.
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={isPolling}
                className="flex items-center gap-2 font-primary"
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {isPolling ? (
                  <><Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> Checking...</>
                ) : (
                  <><RefreshCw style={{ width: 14, height: 14 }} /> Check Balance</>
                )}
              </button>
              <button
                onClick={() => setAwaitingPayment(false)}
                className="font-primary"
                style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
              >
                Choose a different package
              </button>
            </div>
          ) : (
            <>
              {/* Package selection */}
              <div className="space-y-2">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className="flex w-full items-center justify-between font-primary"
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-lg)",
                      background: selectedPackage === pkg.id ? "var(--surface-hover)" : "var(--surface)",
                      border: selectedPackage === pkg.id ? "1px solid var(--border-hover)" : "1px solid var(--border)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>
                          ${pkg.price}
                        </span>
                        {pkg.badge && (
                          <span className="font-mono" style={{ fontSize: 10, color: "var(--accent)", padding: "1px 6px", borderRadius: 6, background: "var(--accent-subtle-bg)" }}>
                            {pkg.badge}
                          </span>
                        )}
                      </div>
                      <span className="font-mono" style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                        {formatCredits(pkg.credits)} credits
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pkg.bonus && (
                        <span className="font-mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                          {pkg.bonus}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {error && (
                <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)" }}>{error}</p>
              )}

              <button
                onClick={handlePurchase}
                disabled={isLoading}
                className="w-full accent-gradient-bg font-primary flex items-center justify-center gap-2"
                style={{
                  padding: "12px 0",
                  borderRadius: "var(--radius-lg)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#0a0a0b",
                  border: "none",
                  cursor: isLoading ? "wait" : "pointer",
                }}
              >
                {isLoading ? (
                  <><Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Processing...</>
                ) : (
                  "Pay with Stripe"
                )}
              </button>

              <div className="flex flex-col items-center gap-1" style={{ paddingTop: 4 }}>
                <div className="flex items-center gap-1.5 font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  <Lock style={{ width: 12, height: 12 }} />
                  <span>Secure payment via Stripe</span>
                </div>
                <p className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Credits never expire</p>
              </div>
            </>
          )
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Sign in first to purchase credits
            </p>
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 accent-gradient-bg font-primary"
              style={{
                padding: "10px 20px",
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
