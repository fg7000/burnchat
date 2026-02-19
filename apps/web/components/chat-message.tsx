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

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
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
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3",
          isUser
            ? "bg-gray-800 border border-gray-600"
            : "bg-gray-800"
        )}
      >
        {/* Message label */}
        <div className="mb-1">
          <span
            className={cn(
              "text-xs font-medium",
              isUser ? "text-gray-200" : "text-gray-400"
            )}
          >
            {isUser ? "You" : "Assistant"}
          </span>
        </div>

        {/* Message content */}
        <div className="text-sm text-gray-200 whitespace-pre-wrap break-words">
          {displayContent}
          {message.isStreaming && (
            <span className="ml-1 inline-block">
              <StreamingDots />
            </span>
          )}
        </div>

        {/* Assistant message footer */}
        {isAssistant && !message.isStreaming && (
          <div className="mt-2 flex items-center gap-3 border-t border-gray-700/50 pt-2">
            {/* Show real names toggle */}
            {mapping && mapping.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalShowReal(!localShowReal)}
                className={cn(
                  "h-6 gap-1 px-2 text-xs",
                  localShowReal
                    ? "text-white hover:text-gray-200"
                    : "text-gray-500 hover:text-gray-300"
                )}
              >
                {localShowReal ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
                {localShowReal ? "Hide real names" : "Show real names"}
              </Button>
            )}

            {/* Credits used */}
            {message.creditsUsed != null && message.creditsUsed > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Coins className="h-3 w-3" />
                {message.creditsUsed} credit{message.creditsUsed !== 1 ? "s" : ""}
              </span>
            )}

            {/* Token count */}
            {message.tokenCount && (
              <span className="text-xs text-gray-500">
                {message.tokenCount.input + message.tokenCount.output} tokens
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
