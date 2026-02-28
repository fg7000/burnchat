"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";
import { initGliner, isGlinerReady } from "@/lib/anonymizer/gliner-engine";

interface PrivacyShieldProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onLoadingStage?: (stage: string) => void;
}

export default function PrivacyShield({ enabled, onToggle, onLoadingStage }: PrivacyShieldProps) {
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isGlinerReady() ? "ready" : "idle"
  );
  const [statusMessage, setStatusMessage] = useState("");

  // Load model when privacy is first enabled
  useEffect(() => {
    if (enabled && modelStatus === "idle") {
      setModelStatus("loading");
      initGliner((msg) => { setStatusMessage(msg); onLoadingStage?.(msg); })
        .then(() => { setModelStatus("ready"); onLoadingStage?.("ready"); })
        .catch(() => setModelStatus("error"));
    }
  }, [enabled, modelStatus]);

  const handleClick = useCallback(() => {
    onToggle(!enabled);
  }, [enabled, onToggle]);

  const isLoading = modelStatus === "loading";

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isLoading}
        title={
          enabled
            ? modelStatus === "ready"
              ? "Privacy Shield: ON (AI model active)"
              : modelStatus === "loading"
              ? statusMessage || "Loading privacy model..."
              : "Privacy Shield: ON (regex only)"
            : "Privacy Shield: OFF"
        }
        className="flex items-center justify-center rounded-lg transition-all duration-200"
        style={{
          width: "36px",
          height: "36px",
          background: enabled
            ? "rgba(255, 107, 53, 0.1)"
            : "transparent",
          border: enabled
            ? "1px solid rgba(255, 107, 53, 0.3)"
            : "1px solid rgba(255, 255, 255, 0.08)",
          color: enabled ? "#ff6b35" : "rgba(255, 255, 255, 0.3)",
          cursor: isLoading ? "wait" : "pointer",
        }}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : enabled ? (
          <ShieldCheck className="h-4 w-4" />
        ) : (
          <Shield className="h-4 w-4" />
        )}
      </button>

      {/* Model status dot */}
      {enabled && (
        <div
          style={{
            position: "absolute",
            top: "2px",
            right: "2px",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background:
              modelStatus === "ready"
                ? "#22c55e"
                : modelStatus === "loading"
                ? "#f59e0b"
                : modelStatus === "error"
                ? "#ef4444"
                : "#666",
          }}
        />
      )}
    </div>
  );
}
