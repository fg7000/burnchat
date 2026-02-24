"use client";

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, ArrowUp, Mic, Coins } from "lucide-react";
import AttachmentMenu from "@/components/attachment-menu";

export default function ChatInput() {
  const [text, setText] = useState("");
  const [showVoiceToast, setShowVoiceToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceToastTimer = useRef<ReturnType<typeof setTimeout>>();

  const messages = useSessionStore((s) => s.messages);
  const selectedModel = useSessionStore((s) => s.selectedModel);
  const sessionId = useSessionStore((s) => s.sessionId);
  const sessionMode = useSessionStore((s) => s.sessionMode);
  const token = useSessionStore((s) => s.token);
  const documents = useSessionStore((s) => s.documents);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const creditBalance = useSessionStore((s) => s.creditBalance);
  const creditsExhausted = useSessionStore((s) => s.creditsExhausted);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateLastAssistantMessage = useSessionStore(
    (s) => s.updateLastAssistantMessage
  );
  const setStreamingComplete = useSessionStore((s) => s.setStreamingComplete);
  const setIsStreaming = useSessionStore((s) => s.setIsStreaming);

  const setShowAttachmentMenu = useUIStore((s) => s.setShowAttachmentMenu);
  const setShowCreditModal = useUIStore((s) => s.setShowCreditModal);
  const setCreditModalReason = useUIStore((s) => s.setCreditModalReason);
  const setShowSignInModal = useUIStore((s) => s.setShowSignInModal);
  const setPendingAction = useUIStore((s) => s.setPendingAction);
  const pendingAction = useUIStore((s) => s.pendingAction);

  const hasText = text.trim().length > 0;
  const hasDocument = documents.length > 0;

  // Cleanup voice toast timer on unmount
  useEffect(() => {
    return () => {
      if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current);
    };
  }, []);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 5;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    adjustTextareaHeight();
  };

  const handleSend = useCallback(async (overrideText?: string) => {
    const trimmed = (overrideText !== undefined ? overrideText : text).trim();
    if (!trimmed || isStreaming) return;

    // Auth gate — show sign-in modal if not authenticated
    if (!token) {
      setPendingAction({ type: "message", data: trimmed });
      setShowSignInModal(true);
      return;
    }

    if (creditsExhausted) {
      setCreditModalReason("exhausted");
      setShowCreditModal(true);
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    const chatHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: "user", content: trimmed });

    addMessage({
      id: userMessageId,
      role: "user",
      content: trimmed,
    });

    addMessage({
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    setText("");
    setIsStreaming(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const options: {
        sessionId?: string | null;
        anonymizedDocument?: string | null;
        token?: string | null;
      } = { token };

      if (sessionMode === "quick" && hasDocument) {
        const doc = documents[0];
        if (doc?.anonymizedText) {
          options.anonymizedDocument = doc.anonymizedText;
        }
      }

      if (sessionMode === "session" && sessionId) {
        options.sessionId = sessionId;
      }

      const url = "/api/chat";
      const body = JSON.stringify({
        model: selectedModel,
        messages: chatHistory,
        session_id: options.sessionId,
        anonymized_document: options.anonymizedDocument,
        session_token: options.token,
      });

      const { readerPromise } = apiClient._createSSEReader(url, body, token);
      const reader = await readerPromise;
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "token") {
                fullContent += data.content;
                updateLastAssistantMessage(fullContent);
              } else if (data.type === "done") {
                const serverBalance = data.usage?.credit_balance;
                setStreamingComplete(
                  assistantMessageId,
                  data.usage?.credits_used ?? 0,
                  {
                    input: data.usage?.input_tokens ?? 0,
                    output: data.usage?.output_tokens ?? 0,
                  },
                  serverBalance
                );

                if (data.credits_exhausted) {
                  setCreditModalReason("exhausted");
                  setShowCreditModal(true);
                }
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    } catch {
      updateLastAssistantMessage(
        "Something went wrong. Please try again."
      );
      setIsStreaming(false);
    }
  }, [
    text,
    isStreaming,
    messages,
    selectedModel,
    sessionId,
    sessionMode,
    token,
    documents,
    hasDocument,
    creditsExhausted,
    addMessage,
    updateLastAssistantMessage,
    setStreamingComplete,
    setIsStreaming,
    setShowCreditModal,
    setCreditModalReason,
    setShowSignInModal,
    setPendingAction,
  ]);

  // Resume pending message after sign-in
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;

  useEffect(() => {
    if (token && pendingAction?.type === "message") {
      const msg = pendingAction.data as string;
      setPendingAction(null);
      handleSendRef.current(msg);
    }
  }, [token, pendingAction, setPendingAction]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleBuyCredits = useCallback(() => {
    setCreditModalReason("exhausted");
    setShowCreditModal(true);
  }, [setCreditModalReason, setShowCreditModal]);

  const handleMicClick = useCallback(() => {
    setShowVoiceToast(true);
    if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current);
    voiceToastTimer.current = setTimeout(() => setShowVoiceToast(false), 2500);
  }, []);

  return (
    <div className="relative z-10" style={{ padding: "12px 16px 16px" }}>
      <AttachmentMenu />
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Credits exhausted banner */}
        {creditsExhausted && (
          <div
            style={{
              marginBottom: 12,
              padding: "12px 16px",
              borderRadius: "var(--radius-lg)",
              background: "var(--accent-subtle-bg)",
              border: "1px solid var(--accent-subtle-border)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Coins style={{ width: 16, height: 16, color: "var(--accent)", flexShrink: 0 }} />
                <p className="font-primary" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  You&apos;ve run out of credits. Purchase more to continue chatting.
                </p>
              </div>
              <button
                onClick={handleBuyCredits}
                className="accent-gradient-bg font-primary"
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#0a0a0b",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Buy Credits
              </button>
            </div>
          </div>
        )}

        {/* Main input container */}
        <div
          className={cn(
            "flex items-end gap-1",
            "focus-within:border-[rgba(255,107,53,0.2)]"
          )}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 4,
          }}
        >
          {/* Attachment button */}
          <button
            onClick={() => setShowAttachmentMenu(true)}
            disabled={isStreaming}
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: isStreaming ? "not-allowed" : "pointer",
              opacity: isStreaming ? 0.5 : 1,
            }}
          >
            <Plus style={{ width: 18, height: 18 }} />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={creditsExhausted ? "Purchase credits to continue..." : "Say anything. It\u2019s anonymous."}
            disabled={isStreaming || creditsExhausted}
            rows={1}
            className="font-primary"
            style={{
              flex: 1,
              resize: "none",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "8px 8px",
              fontSize: 14,
              fontWeight: 300,
              color: "var(--text-primary)",
              maxHeight: 24 * 5,
              lineHeight: "24px",
            }}
          />

          {/* Mic button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleMicClick}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--radius-md)",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    cursor: "pointer",
                    transition: "color 0.25s ease, border-color 0.25s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  }}
                >
                  <Mic style={{ width: 16, height: 16 }} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Voice input coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Send button */}
          <button
            onClick={() => handleSend()}
            disabled={!hasText || isStreaming || creditsExhausted}
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: hasText && !isStreaming ? "var(--accent-gradient)" : "var(--surface)",
              backgroundImage: hasText && !isStreaming ? "linear-gradient(135deg, #ff6b35, #ff3c1e)" : "none",
              border: hasText && !isStreaming ? "none" : "1px solid var(--border)",
              color: hasText && !isStreaming ? "#0a0a0b" : "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: hasText && !isStreaming ? "pointer" : "default",
            }}
          >
            <ArrowUp style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Voice toast */}
        {showVoiceToast && (
          <div
            className="font-primary"
            style={{
              position: "fixed",
              bottom: 100,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#111113",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.7)",
              zIndex: 60,
              animation: "fadeInUp 0.2s ease",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
              whiteSpace: "nowrap",
            }}
          >
            Voice input coming soon!
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-center gap-2 font-mono"
          style={{
            marginTop: 10,
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          <span>zero persistence</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", opacity: 0.5 }} />
          <span>all PII stripped</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", opacity: 0.5 }} />
          <span>nothing stored</span>
        </div>
      </div>
    </div>
  );
}
