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

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("auth_token") || params.get("token");
    if (urlToken) {
      window.history.replaceState({}, "", "/");
    }

    let stored: { token: string; user_id: string; email: string; credit_balance: number } | null = null;
    try {
      const raw = localStorage.getItem("burnchat_auth");
      if (raw) {
        stored = JSON.parse(raw);
        localStorage.removeItem("burnchat_auth");
      }
    } catch { /* ignore parse errors */ }

    const pendingToken = localStorage.getItem("burnchat_pending_token");
    if (pendingToken) localStorage.removeItem("burnchat_pending_token");

    const legacyToken = localStorage.getItem("pending_auth_token");
    if (legacyToken) localStorage.removeItem("pending_auth_token");

    if (stored?.token) {
      setAuth(stored.token, stored.user_id, stored.email, stored.credit_balance);
      return;
    }

    const pending = urlToken || pendingToken || legacyToken;
    if (!pending) return;

    apiClient
      .getMe(pending)
      .then((user) => {
        setAuth(pending, user.user_id, user.email, user.credit_balance);
      })
      .catch(() => {});
  }, [setAuth]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "burnchat_auth" && e.data.auth?.token) {
        const { token: t, user_id, email: em, credit_balance } = e.data.auth;
        setAuth(t, user_id, em, credit_balance);
        return;
      }
      if (e.data?.type === "burnchat_auth_token" && e.data.token) {
        apiClient.getMe(e.data.token).then((user) => {
          setAuth(e.data.token, user.user_id, user.email, user.credit_balance);
        }).catch(() => {});
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [setAuth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" && token) {
      apiClient.getCreditBalance(token).then((data) => {
        setCreditBalance(data.credit_balance);
        setShowCreditModal(false);
      }).catch(() => {});
      window.history.replaceState({}, "", "/");
    } else if (payment === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [token, setCreditBalance, setShowCreditModal]);

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
    <div className="flex h-screen flex-col pt-14" style={{ position: "relative", zIndex: 1 }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        {sessionMode === "session" && showSessionSidebar && <SessionSidebar />}
        <div className="flex flex-1 flex-col">
          <ChatContainer />
          <ChatInput />
        </div>
      </div>
      <CreditPurchaseModal />
      <SessionListModal />
      <SignInModal />
    </div>
  );
}
