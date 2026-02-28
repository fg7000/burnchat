"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";
import { initGliner, isGlinerReady } from "@/lib/anonymizer/gliner-engine";

interface PrivacyShieldProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const STAGE_MAP: Record<string, number> = {
  "Downloading privacy model...": 20,
  "Initializing privacy engine...": 70,
  "Privacy engine ready ✓": 100,
};

export default function PrivacyShield({ enabled, onToggle }: PrivacyShieldProps) {
  const [modelStatus, setModelStatus] = useState<"idle" | "loading" | "ready" | "error">(
    isGlinerReady() ? "ready" : "idle"
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (enabled && modelStatus === "idle") {
      setModelStatus("loading");
      setProgress(5);
      initGliner((msg) => {
        setStatusMessage(msg);
        setProgress(STAGE_MAP[msg] || progress);
      })
        .then(() => { setModelStatus("ready"); setProgress(100); })
        .catch(() => setModelStatus("error"));
    }
  }, [enabled, modelStatus]);

  // Animate progress slowly while downloading (the longest phase)
  useEffect(() => {
    if (modelStatus !== "loading" || progress >= 65) return;
    const timer = setInterval(() => {
      setProgress((p) => {
        // Creep up slowly to 60 max during download phase
        if (p < 60) return p + 0.5;
        return p;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [modelStatus, progress]);

  const handleClick = useCallback(() => {
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
          background: enabled ? "rgba(255, 107, 53, 0.1)" : "transparent",
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

      {/* Loading progress bar */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            bottom: "-10px",
            left: "0",
            right: "0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "2px",
              borderRadius: "1px",
              background: "rgba(255, 255, 255, 0.1)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: Math.round(progress) + "%",
                height: "100%",
                background: "#ff6b35",
                borderRadius: "1px",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "9px",
              color: "rgba(255, 255, 255, 0.35)",
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: "nowrap",
            }}
          >
            {Math.round(progress)}%
          </span>
        </div>
      )}
    </div>
  );
}
