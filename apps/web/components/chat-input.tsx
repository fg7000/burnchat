"use client";

import React, { useState, useRef, useCallback, KeyboardEvent } from "react";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus, ArrowUp, Mic } from "lucide-react";
import AttachmentMenu from "@/components/attachment-menu";

export default function ChatInput() {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = useSessionStore((s) => s.messages);
  const selectedModel = useSessionStore((s) => s.selectedModel);
  const sessionId = useSessionStore((s) => s.sessionId);
  const sessionMode = useSessionStore((s) => s.sessionMode);
  const token = useSessionStore((s) => s.token);
  const documents = useSessionStore((s) => s.documents);
  const isStreaming = useSessionStore((s) => s.isStreaming);
  const creditBalance = useSessionStore((s) => s.creditBalance);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateLastAssistantMessage = useSessionStore(
    (s) => s.updateLastAssistantMessage
  );
  const setStreamingComplete = useSessionStore((s) => s.setStreamingComplete);
  const setIsStreaming = useSessionStore((s) => s.setIsStreaming);

  const setShowAttachmentMenu = useUIStore((s) => s.setShowAttachmentMenu);

  const hasText = text.trim().length > 0;
  const hasDocument = documents.length > 0;

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

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Build message history for the API
    const chatHistory = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    chatHistory.push({ role: "user", content: trimmed });

    // Add user message to store
    addMessage({
      id: userMessageId,
      role: "user",
      content: trimmed,
    });

    // Add empty assistant message with streaming flag
    addMessage({
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true,
    });

    setText("");
    setIsStreaming(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      // Build options based on session mode
      const options: {
        sessionId?: string | null;
        anonymizedDocument?: string | null;
        token?: string | null;
      } = { token };

      if (sessionMode === "quick" && hasDocument) {
        // In quick mode, pass the anonymized document text
        const doc = documents[0];
        if (doc?.anonymizedText) {
          options.anonymizedDocument = doc.anonymizedText;
        }
      }

      if (sessionMode === "session" && sessionId) {
        options.sessionId = sessionId;
      }

      // Call streaming chat
      const url =
        (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") +
        "/api/chat";
      const body = JSON.stringify({
        model: selectedModel,
        messages: chatHistory,
        session_id: options.sessionId,
        anonymized_document: options.anonymizedDocument,
        session_token: options.token,
      });

      const { readerPromise } = apiClient._createSSEReader(
        url,
        body,
        token
      );
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
                setStreamingComplete(
                  assistantMessageId,
                  data.usage?.credits_used ?? 0,
                  {
                    input: data.usage?.input_tokens ?? 0,
                    output: data.usage?.output_tokens ?? 0,
                  }
                );
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    } catch {
      // On error, update the assistant message with an error notice
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
    addMessage,
    updateLastAssistantMessage,
    setStreamingComplete,
    setIsStreaming,
  ]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative bg-gray-900 border-t border-gray-800 p-3">
      <AttachmentMenu />
      <div className="max-w-3xl mx-auto">
        {/* Credit balance indicator when document loaded */}
        {hasDocument && (
          <div className="text-xs text-gray-500 mb-2 text-center">
            Credit balance: {creditBalance}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full text-gray-400 hover:text-gray-200"
            onClick={() => setShowAttachmentMenu(true)}
            disabled={isStreaming}
          >
            <Plus className="h-5 w-5" />
          </Button>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your document..."
              disabled={isStreaming}
              rows={1}
              className={cn(
                "w-full resize-none rounded-xl bg-gray-800 border border-gray-700 px-4 py-2.5",
                "text-gray-100 placeholder:text-gray-500 text-sm",
                "focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "scrollbar-thin scrollbar-thumb-gray-700"
              )}
              style={{ maxHeight: `${24 * 5}px` }}
            />
          </div>

          {/* Mic button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-10 w-10 rounded-full text-gray-600 cursor-not-allowed"
                  disabled
                >
                  <Mic className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Send button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "shrink-0 h-10 w-10 rounded-full transition-colors",
              hasText && !isStreaming
                ? "bg-teal-600 text-white hover:bg-teal-700"
                : "bg-gray-700 text-gray-500"
            )}
            onClick={handleSend}
            disabled={!hasText || isStreaming}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
