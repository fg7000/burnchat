"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, Coins } from "lucide-react";
import { type ChatMessage as ChatMessageType, type MappingEntry } from "@/store/session-store";
import { deAnonymize } from "@/lib/anonymizer/de-anonymizer";

interface ChatMessageProps {
  message: ChatMessageType;
  mapping: MappingEntry[];
  showRealNames: boolean;
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--text-secondary)", animationDelay: "-0.3s" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--text-secondary)", animationDelay: "-0.15s" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--text-secondary)" }} />
    </span>
  );
}

export function ChatMessage({ message, mapping, showRealNames: initialShowReal }: ChatMessageProps) {
  const [localShowReal, setLocalShowReal] = useState(initialShowReal);

  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const displayContent = useMemo(() => {
    if (!isAssistant || !localShowReal || !mapping || mapping.length === 0) {
      return message.content;
    }
    return deAnonymize(message.content, mapping);
  }, [message.content, mapping, localShowReal, isAssistant]);

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="font-primary"
        style={{
          maxWidth: "75%",
          padding: "12px 16px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          ...(isUser
            ? {
                backgroundImage: "linear-gradient(135deg, #ff6b35, #ff3c1e)",
                color: "#0a0a0b",
              }
            : {
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }),
        }}
      >
        {/* Message content */}
        <div style={{ fontSize: 14, fontWeight: 300, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>
          {displayContent}
          {message.isStreaming && (
            <span className="ml-1 inline-block">
              <StreamingDots />
            </span>
          )}
        </div>

        {/* Assistant message footer */}
        {isAssistant && !message.isStreaming && (
          <div
            className="flex items-center gap-3"
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: "1px solid var(--border)",
            }}
          >
            {mapping && mapping.length > 0 && (
              <button
                onClick={() => setLocalShowReal(!localShowReal)}
                className="flex items-center gap-1 font-primary"
                style={{
                  fontSize: 11,
                  color: localShowReal ? "var(--text-primary)" : "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {localShowReal ? (
                  <EyeOff style={{ width: 12, height: 12 }} />
                ) : (
                  <Eye style={{ width: 12, height: 12 }} />
                )}
                {localShowReal ? "Hide real names" : "Show real names"}
              </button>
            )}

            {message.creditsUsed != null && message.creditsUsed > 0 && (
              <span className="flex items-center gap-1 font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <Coins style={{ width: 12, height: 12 }} />
                {message.creditsUsed} credit{message.creditsUsed !== 1 ? "s" : ""}
              </span>
            )}

            {message.tokenCount && (
              <span className="font-mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {message.tokenCount.input + message.tokenCount.output} tokens
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
