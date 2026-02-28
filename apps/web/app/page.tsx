"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import TopBar from "@/components/top-bar";
import ChatContainer from "@/components/chat-container";
import ChatInput from "@/components/chat-input";
import SessionSidebar from "@/components/session-sidebar";
import CreditPurchaseModal from "@/components/credit-purchase-modal";
import SessionListModal from "@/components/session-list-modal";
import SignInModal from "@/components/sign-in-modal";

export default function Home() {
  const { token, sessionMode, setCreditBalance, setAuth } = useSessionStore();
  const { showSessionSidebar, setShowCreditModal } = useUIStore();

  // Pick up auth from multiple sources:
  //   1. URL param ?auth_token=JWT (old redirect flow)
  //   2. localStorage "burnchat_auth" (set by inline HTML callback page)
  //   3. localStorage "pending_auth_token" (legacy)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Source 1: URL param — check both "auth_token" (new server) and "token" (old server)
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("auth_token") || params.get("token");
    if (urlToken) {
      // Clean up the URL (strip token + go to / if we're on /auth/callback)
      window.history.replaceState({}, "", "/");
    }

    // Source 2: localStorage "burnchat_auth" (set by /api/auth/callback HTML)
    let stored: { token: string; user_id: string; email: string; credit_balance: number } | null = null;
    try {
      const raw = localStorage.getItem("burnchat_auth");
      if (raw) {
        stored = JSON.parse(raw);
        localStorage.removeItem("burnchat_auth");
      }
    } catch { /* ignore parse errors */ }

    // Source 3: "burnchat_pending_token" (set by static auth/callback/index.html)
    const pendingToken = localStorage.getItem("burnchat_pending_token");
    if (pendingToken) localStorage.removeItem("burnchat_pending_token");

    // Source 4: legacy pending token
    const legacyToken = localStorage.getItem("pending_auth_token");
    if (legacyToken) localStorage.removeItem("pending_auth_token");

    // Use stored auth directly (already has user info)
    if (stored?.token) {
      setAuth(stored.token, stored.user_id, stored.email, stored.credit_balance);
      return;
    }

    // Fall back to token-only sources (need /api/auth/me call)
    const pending = urlToken || pendingToken || legacyToken;
    if (!pending) return;

    apiClient
      .getMe(pending)
      .then((user) => {
        setAuth(pending, user.user_id, user.email, user.credit_balance);
      })
      .catch(() => {});
  }, [setAuth]);

  // Listen for postMessage from auth popup (both formats)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Format 1: full auth data from inline HTML callback
      if (e.data?.type === "burnchat_auth" && e.data.auth?.token) {
        const { token: t, user_id, email: em, credit_balance } = e.data.auth;
        setAuth(t, user_id, em, credit_balance);
        return;
      }
      // Format 2: token-only from static callback page
      if (e.data?.type === "burnchat_auth_token" && e.data.token) {
        apiClient.getMe(e.data.token).then((user) => {
          setAuth(e.data.token, user.user_id, user.email, user.credit_balance);
        }).catch(() => {});
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setAuth]);

  // Check for payment success/cancel in URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" && token) {
      apiClient.getCreditBalance(token).then((data) => {
        if (Number.isFinite(data.credit_balance)) setCreditBalance(data.credit_balance);
        // Close the credit modal if it was open (e.g. from exhaustion)
        setShowCreditModal(false);
      }).catch(() => {});
      window.history.replaceState({}, "", "/");
    } else if (payment === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [token, setCreditBalance, setShowCreditModal]);

  // Warn on tab close

  // Always refresh balance from server when we have a token
  useEffect(() => {
    if (!token) return;
    apiClient.getMe(token).then((user) => {
      if (Number.isFinite(user.credit_balance)) setCreditBalance(user.credit_balance);
    }).catch(() => {});
  }, [token, setCreditBalance]);
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const { messages, documents } = useSessionStore.getState();
      if (messages.length > 0 || documents.length > 0) {
        e.preventDefault();
        e.returnValue = "Your session data will be lost. Continue?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return (
    <div className="flex h-screen flex-col pt-14">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {sessionMode === "session" && showSessionSidebar && <SessionSidebar />}
        <div className="flex flex-1 flex-col">
          <ChatContainer />
          <ChatInput />
        </div>
      </div>
      <CreditPurchaseModal />
        <SignInModal />
      <SessionListModal />
    </div>
  );
}
