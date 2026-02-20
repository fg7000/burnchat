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

export default function Home() {
  const { token, sessionMode, setCreditBalance, setAuth } = useSessionStore();
  const { showSessionSidebar, setShowCreditModal } = useUIStore();

  // Pick up a pending auth token from URL params (OAuth redirect) or localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("auth_token");
    const pending = urlToken || localStorage.getItem("pending_auth_token");

    if (!pending) return;

    // Clean up: remove from localStorage and strip token from URL
    localStorage.removeItem("pending_auth_token");
    if (urlToken) {
      params.delete("auth_token");
      const clean = params.toString();
      window.history.replaceState({}, "", clean ? `/app?${clean}` : "/app");
    }

    apiClient
      .getMe(pending)
      .then((user) => {
        setAuth(pending, user.user_id, user.email, user.credit_balance);
      })
      .catch(() => {});
  }, [setAuth]);

  // Check for payment success/cancel in URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" && token) {
      apiClient.getCreditBalance(token).then((data) => {
        setCreditBalance(data.credit_balance);
        // Close the credit modal if it was open (e.g. from exhaustion)
        setShowCreditModal(false);
      }).catch(() => {});
      window.history.replaceState({}, "", "/");
    } else if (payment === "cancelled") {
      window.history.replaceState({}, "", "/");
    }
  }, [token, setCreditBalance, setShowCreditModal]);

  // Warn on tab close
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
      <SessionListModal />
    </div>
  );
}
