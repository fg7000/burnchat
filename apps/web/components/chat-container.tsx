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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <ScrollArea className="flex-1 w-full">
      <div className="flex flex-col" style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>
        {isEmpty ? (
          <WelcomeMessage />
        ) : (
          messages.map((message) => {
            const isDocumentMessage =
              message.role === "system" &&
              message.content.startsWith("[document:");

            if (isDocumentMessage) {
              const filenameMatch = message.content.match(
                /\[document:(.+?)\]/
              );
              const filename = filenameMatch ? filenameMatch[1] : "";
              const doc = documents.find((d) => d.filename === filename);
              if (!doc) return null;

              return (
                <div key={message.id} style={{ marginBottom: 16 }}>
                  <DocumentCard document={doc} />
                </div>
              );
            }

            return (
              <div key={message.id} style={{ marginBottom: 16 }}>
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
