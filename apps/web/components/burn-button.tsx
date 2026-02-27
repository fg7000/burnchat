"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import { Flame } from "lucide-react";

type BurnPhase = "idle" | "armed" | "burning" | "done";

export default function BurnButton() {
  const [phase, setPhase] = useState<BurnPhase>("idle");
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messages = useSessionStore((s) => s.messages);
  const documents = useSessionStore((s) => s.documents);
  const sessionId = useSessionStore((s) => s.sessionId);
  const token = useSessionStore((s) => s.token);
  const clearMessages = useSessionStore((s) => s.clearMessages);
  const clearDocuments = useSessionStore((s) => s.clearDocuments);
  const setSessionId = useSessionStore((s) => s.setSessionId);
  const setSessionMode = useSessionStore((s) => s.setSessionMode);
  const setCurrentMapping = useSessionStore((s) => s.setCurrentMapping);

  const hasContent = messages.length > 0 || documents.length > 0;

  useEffect(() => {
    if (phase === "armed") {
      setCountdown(3);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => c - 1);
      }, 1000);
      timerRef.current = setTimeout(() => {
        setPhase("idle");
      }, 3000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [phase]);

  const executeBurn = useCallback(async () => {
    setPhase("burning");

    const overlay = document.createElement("div");
    overlay.className = "burn-overlay";
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.add("burn-active");
    });

    if (sessionId && token) {
      try {
        await apiClient.deleteSession(sessionId, token);
      } catch (e) {
        console.error("[burn] Failed to delete server session:", e);
      }
    }

    setTimeout(() => {
      clearMessages();
      clearDocuments();
      setCurrentMapping([]);
      setSessionId(null);
      setSessionMode("quick");

      overlay.classList.add("burn-fade-out");
      setTimeout(() => {
        overlay.remove();
        setPhase("idle");
      }, 600);
    }, 1200);
  }, [sessionId, token, clearMessages, clearDocuments, setCurrentMapping, setSessionId, setSessionMode]);

  const handleClick = () => {
    if (phase === "idle") {
      setPhase("armed");
    } else if (phase === "armed") {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      executeBurn();
    }
  };

  if (!hasContent) return null;

  const isArmed = phase === "armed";
  const isBurning = phase === "burning";

  return (
    <button
      onClick={handleClick}
      disabled={isBurning}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300 ml-auto"
      style={{
        background: isArmed
          ? "rgba(255, 60, 30, 0.15)"
          : isBurning
            ? "rgba(255, 60, 30, 0.3)"
            : "transparent",
        border: isArmed
          ? "1px solid rgba(255, 60, 30, 0.4)"
          : isBurning
            ? "1px solid rgba(255, 60, 30, 0.6)"
            : "1px solid transparent",
        color: isArmed || isBurning ? "#ff3c1e" : "rgba(255, 107, 53, 0.5)",
        cursor: isBurning ? "wait" : "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px",
        fontWeight: 500,
        letterSpacing: "0.04em",
        animation: isArmed ? "pulse-burn 0.6s ease-in-out infinite" : "none",
      }}
    >
      <Flame
        className="transition-all duration-300"
        style={{
          width: "12px",
          height: "12px",
          animation: isBurning ? "spin 0.5s linear infinite" : "none",
        }}
      />
      {isBurning
        ? "BURNING..."
        : isArmed
          ? `CONFIRM (${countdown})`
          : "BURN THE CHAT"}
    </button>
  );
}
