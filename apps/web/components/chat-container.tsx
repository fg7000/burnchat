"use client";

import React, { useEffect, useRef } from "react";
import { useSessionStore } from "@/store/session-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat-message";
import { WelcomeMessage } from "@/components/welcome-message";
import { DocumentCard } from "@/components/document-card";

export default function ChatContainer() {
  const messages = useSessionStore((s) => s.messages);
  const currentMapping = useSessionStore((s) => s.currentMapping);
  const showRealNames = useSessionStore((s) => s.showRealNames);
  const documents = useSessionStore((s) => s.documents);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or content updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <ScrollArea className="flex-1 w-full">
      <div className="flex flex-col max-w-3xl mx-auto px-4 py-6">
        {isEmpty ? (
          <WelcomeMessage />
        ) : (
          messages.map((message) => {
            // Check if this is a system message with document info (document upload notification)
            const isDocumentMessage =
              message.role === "system" &&
              message.content.startsWith("[document:");

            if (isDocumentMessage) {
              // Parse document info from system message
              // Format: [document:filename.pdf]
              const filenameMatch = message.content.match(
                /\[document:(.+?)\]/
              );
              const filename = filenameMatch ? filenameMatch[1] : "";

              const doc = documents.find((d) => d.filename === filename);
              if (!doc) return null;

              return (
                <div key={message.id} className="mb-4">
                  <DocumentCard document={doc} />
                </div>
              );
            }

            return (
              <div key={message.id} className="mb-4">
                <ChatMessage
                  message={message}
                  mapping={currentMapping}
                  showRealNames={showRealNames}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
