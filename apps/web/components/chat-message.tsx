"use client";

import { useState, useMemo } from "react";
import { Eye, EyeOff, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ChatMessage as ChatMessageType, type MappingEntry } from "@/store/session-store";
import { deAnonymize } from "@/lib/anonymizer/de-anonymizer";
import { Button } from "@/components/ui/button";

interface ChatMessageProps {
  message: ChatMessageType;
  mapping: MappingEntry[];
  showRealNames: boolean;
}

function FlameIcon({ animated = false }: { animated?: boolean }) {
  return (
    <div
      className={cn("flex items-center justify-center", animated && "animate-flame")}
      style={{ width: "22px", height: "22px", borderRadius: "6px", background: "linear-gradient(135deg, #ff6b35, #ff3c1e)", flexShrink: 0 }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 0c0 4-3 6-3 10 0 2.21 1.34 3 3 3s3-.79 3-3c0-4-3-6-3-10z" fill="#0a0a0b" fillOpacity="0.8"/>
      </svg>
      <style jsx>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          25% { opacity: 0.85; transform: scale(0.97); }
          50% { opacity: 0.95; transform: scale(1.03); }
          75% { opacity: 0.9; transform: scale(0.98); }
        }
        .animate-flame {
          animation: flicker 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
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

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div
          className="max-w-[80%] rounded-xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="text-sm whitespace-pre-wrap break-words" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans', sans-serif" }}>
            {displayContent}
          </div>
        </div>
      </div>
    );
  }

  if (isAssistant) {
    const isThinking = message.isStreaming && !message.content;

    return (
      <div className="flex w-full justify-start gap-2.5">
        <FlameIcon animated={!!message.isStreaming} />
        <div className="max-w-[80%]">
          {isThinking ? (
            <div className="flex items-center gap-2 py-2">
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                Thinking...
              </span>
            </div>
          ) : (
            <>
              <div
                className="text-sm whitespace-pre-wrap break-words"
                style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans', sans-serif", lineHeight: "1.65" }}
              >
                {displayContent}
                {message.isStreaming && message.content && (
                  <span
                    className="inline-block ml-0.5"
                    style={{
                      width: "6px",
                      height: "14px",
                      background: "#ff6b35",
                      borderRadius: "1px",
                      animation: "blink 1s step-end infinite",
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </div>

              {/* Footer */}
              {!message.isStreaming && (
                <div className="mt-2 flex items-center gap-3 pt-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  {mapping && mapping.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocalShowReal(!localShowReal)}
                      className="h-6 gap-1 px-2 text-xs"
                      style={{ color: localShowReal ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)" }}
                    >
                      {localShowReal ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {localShowReal ? "Hide real names" : "Show real names"}
                    </Button>
                  )}
                  {message.creditsUsed != null && message.creditsUsed > 0 && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      <Coins className="h-3 w-3" />
                      {message.creditsUsed} credit{message.creditsUsed !== 1 ? "s" : ""}
                    </span>
                  )}
                  {message.tokenCount && (
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                      {message.tokenCount.input + message.tokenCount.output} tokens
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          <style jsx global>{`
            @keyframes blink {
              50% { opacity: 0; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return null;
}
