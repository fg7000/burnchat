"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import { Flame } from "lucide-react";

type BurnPhase = "idle" | "armed" | "burning" | "done";

function spawnEmbers(container: HTMLElement) {
  const count = 45;
  const colors = [
    "#ff6b35", "#ff3c1e", "#ff9500", "#ffcc00",
    "#ff5722", "#ff8a65", "#ffd54f", "#fff176",
  ];

  for (let i = 0; i < count; i++) {
    const ember = document.createElement("div");
    ember.className = "burn-ember";

    const size = 2 + Math.random() * 6;
    const x = 5 + Math.random() * 90;
    const startY = 95 + Math.random() * 10;
    const drift = -30 + Math.random() * 60;
    const duration = 0.4 + Math.random() * 0.8;
    const delay = Math.random() * 0.3;
    const color = colors[Math.floor(Math.random() * colors.length)];

    ember.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${x}%;
      top: ${startY}%;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}44;
      opacity: 0;
      animation: none;
    `;

    container.appendChild(ember);

    // Animate with JS for more control
    requestAnimationFrame(() => {
      ember.style.transition = `all ${duration}s cubic-bezier(0.2, 0.8, 0.3, 1) ${delay}s`;
      ember.style.transform = `translateY(-${60 + Math.random() * 40}vh) translateX(${drift}px) scale(0)`;
      ember.style.opacity = "0.9";

      // Flash bright then fade
      setTimeout(() => {
        ember.style.opacity = "0";
      }, (delay + duration * 0.4) * 1000);

      setTimeout(() => {
        ember.remove();
      }, (delay + duration) * 1000 + 200);
    });
  }
}

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

    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "burn-overlay";
    document.body.appendChild(overlay);

    // Screen shake
    document.body.classList.add("burn-shaking");

    // Fire it up — fast
    requestAnimationFrame(() => {
      overlay.classList.add("burn-active");
      spawnEmbers(overlay);

      // Second wave of embers
      setTimeout(() => spawnEmbers(overlay), 150);
    });

    // Delete server session
    if (sessionId && token) {
      try {
        await apiClient.deleteSession(sessionId, token);
      } catch (e) {
        console.error("[burn] Failed to delete server session:", e);
      }
    }

    // Clear state at peak intensity
    setTimeout(() => {
      clearMessages();
      clearDocuments();
      setCurrentMapping([]);
      setSessionId(null);
      setSessionMode("quick");
      document.body.classList.remove("burn-shaking");

      // Quick fade out
      overlay.classList.add("burn-fade-out");
      setTimeout(() => {
        overlay.remove();
        setPhase("idle");
      }, 400);
    }, 700);
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
          animation: isBurning ? "spin 0.3s linear infinite" : "none",
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
