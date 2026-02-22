"use client";

import React from "react";
import { useSessionStore } from "@/store/session-store";

export function CreditDisplay() {
  const creditBalance = useSessionStore((s) => s.creditBalance);
  const dollars = (creditBalance / 100).toFixed(2);

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "#ff6b35",
        }}
      />
      <span
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        ${dollars} credit
      </span>
    </div>
  );
}

export default CreditDisplay;
