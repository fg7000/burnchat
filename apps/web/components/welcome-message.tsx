"use client";

import React, { useState } from "react";

export function WelcomeMessage() {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 max-w-[720px] mx-auto w-full">
      {/* VPN Badge — prominent */}
      <div
        className="fade-in-up flex items-center gap-3 px-6 py-3 rounded-full mb-8"
        style={{
          background: "rgba(255, 107, 53, 0.08)",
          border: "1px solid rgba(255, 107, 53, 0.15)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6b35" strokeWidth="1.5">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span
          style={{
            fontSize: "20px",
            color: "#ff6b35",
            fontWeight: 500,
            letterSpacing: "0.01em",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          The VPN for AI
        </span>
      </div>

      {/* Headline */}
      <h1
        className="fade-in-up-delay-1 text-center mb-4"
        style={{
          fontSize: "48px",
          fontWeight: 300,
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
          color: "#fff",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Talk to AI.
        <br />
        <span
          style={{
            background: "linear-gradient(135deg, #ff6b35, #ff3c1e)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Stay invisible.
        </span>
      </h1>

      {/* Subtitle */}
      <p
        className="fade-in-up-delay-1 text-center mb-10"
        style={{
          fontSize: "15px",
          color: "rgba(255,255,255,0.35)",
          fontWeight: 300,
          lineHeight: 1.7,
          maxWidth: "460px",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Chat, upload documents, or just speak your mind.
        Every name, email, and detail is stripped before it
        reaches any AI. Nothing is stored. Ever.
      </p>

      {/* Feature pills */}
      <div className="fade-in-up-delay-2 flex gap-2 flex-wrap justify-center mb-10">
        {[
          { icon: "💬", label: "Chat anonymously" },
          { icon: "📄", label: "Upload documents" },
          { icon: "🔗", label: "Paste URLs" },
          { icon: "🎙️", label: "Voice (coming soon)" },
        ].map((item, i) => (
          <div
            key={i}
            onMouseEnter={() => setHoveredFeature(i)}
            onMouseLeave={() => setHoveredFeature(null)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] transition-all duration-200 cursor-default"
            style={{
              background: hoveredFeature === i ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${hoveredFeature === i ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"}`,
            }}
          >
            <span style={{ fontSize: "14px" }}>{item.icon}</span>
            <span
              className="transition-colors duration-200"
              style={{
                fontSize: "13px",
                color: hoveredFeature === i ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                fontWeight: 400,
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="fade-in-up-delay-3 flex gap-8 justify-center items-center">
        {[
          { num: "1", text: "You type or upload" },
          { num: "2", text: "We strip all PII" },
          { num: "3", text: "AI sees nothing real" },
        ].map((item, i) => (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center"
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  background: "rgba(255, 107, 53, 0.08)",
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#ff6b35",
                }}
              >
                {item.num}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: "rgba(255,255,255,0.3)",
                  fontWeight: 300,
                }}
              >
                {item.text}
              </span>
            </div>
            {i < 2 && (
              <span style={{ color: "rgba(255,255,255,0.1)" }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Credits info */}
      <div className="fade-in-up-delay-3 mt-10">
        <p
          className="text-center"
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.2)",
            fontWeight: 300,
          }}
        >
          100 free credits to start. No card required.
        </p>
      </div>
    </div>
  );
}

export default WelcomeMessage;
