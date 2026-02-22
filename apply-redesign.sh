#!/bin/bash
# BurnChat UI Redesign Script
# Run from ~/burnchat

set -e
echo "🔥 Applying BurnChat redesign..."

# 1. UPDATE GLOBALS.CSS
cat > apps/web/app/globals.css << 'CSSEOF'
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=JetBrains+Mono:wght@400;500&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #0a0a0b;
  --foreground: #e8e8e8;
  --accent: #ff6b35;
  --accent-dark: #ff3c1e;
  --surface: rgba(255,255,255,0.025);
  --surface-hover: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.06);
  --border-hover: rgba(255,255,255,0.08);
  --text-primary: #ffffff;
  --text-secondary: rgba(255,255,255,0.35);
  --text-muted: rgba(255,255,255,0.15);
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: 'DM Sans', -apple-system, sans-serif;
}

/* Ambient glow */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(255, 107, 53, 0.04) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

textarea { field-sizing: content; }

/* Animations */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-dot {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.animate-dot-1 { animation: pulse-dot 1.4s infinite 0s; }
.animate-dot-2 { animation: pulse-dot 1.4s infinite 0.2s; }
.animate-dot-3 { animation: pulse-dot 1.4s infinite 0.4s; }

@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }

.streaming-cursor::after {
  content: "▊";
  animation: blink 1s steps(2) infinite;
  color: #e5e7eb;
}

@keyframes blink {
  0% { opacity: 1; }
  50% { opacity: 0; }
}

.fade-in-up {
  animation: fadeInUp 0.6s ease-out both;
}

.fade-in-up-delay-1 { animation: fadeInUp 0.6s ease-out 0.1s both; }
.fade-in-up-delay-2 { animation: fadeInUp 0.6s ease-out 0.2s both; }
.fade-in-up-delay-3 { animation: fadeInUp 0.6s ease-out 0.3s both; }
CSSEOF
echo "  ✅ globals.css updated"

# 2. UPDATE WELCOME MESSAGE
cat > apps/web/components/welcome-message.tsx << 'WELCOMEEOF'
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
WELCOMEEOF
echo "  ✅ welcome-message.tsx updated"

# 3. UPDATE TOP BAR
cat > apps/web/components/top-bar.tsx << 'TOPBAREOF'
"use client";

import React from "react";
import { useSessionStore } from "@/store/session-store";
import { ModelSelector } from "./model-selector";
import { CreditDisplay } from "./credit-display";
import { useUIStore } from "@/store/ui-store";

export function TopBar() {
  const token = useSessionStore((s) => s.token);
  const startGoogleLogin = useSessionStore((s) => s.startGoogleLogin);

  return (
    <nav
      className="flex justify-between items-center px-8 py-4 relative z-10"
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #ff6b35, #ff3c1e)",
            fontSize: "14px",
            fontWeight: 500,
            color: "#0a0a0b",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "-1px",
          }}
        >
          B
        </div>
        <span
          style={{
            fontSize: "16px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          burnchat
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-5">
        <ModelSelector />
        <CreditDisplay />
        {token ? (
          <div
            className="flex items-center justify-center cursor-pointer"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1e1e22, #141416)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            U
          </div>
        ) : (
          <button
            onClick={startGoogleLogin}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              fontSize: "13px",
              fontWeight: 400,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Sign in with Google
          </button>
        )}
      </div>
    </nav>
  );
}

export default TopBar;
TOPBAREOF
echo "  ✅ top-bar.tsx updated"

# 4. UPDATE CREDIT DISPLAY
cat > apps/web/components/credit-display.tsx << 'CREDITEOF'
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
CREDITEOF
echo "  ✅ credit-display.tsx updated"

# 5. UPDATE LAYOUT METADATA
sed -i '' 's/BurnChat — The VPN for AI/BurnChat — The VPN for AI/g' apps/web/app/layout.tsx 2>/dev/null || true
# Make sure the title is correct
grep -q "The VPN for AI" apps/web/app/layout.tsx && echo "  ✅ layout.tsx title already set" || echo "  ⚠️  Update layout.tsx title manually"

# 6. UPDATE PAGE TITLE  
cat > apps/web/app/page-title.ts << 'TITLEEOF'
export const siteConfig = {
  title: "BurnChat — The VPN for AI",
  description: "Chat with AI anonymously. All personal information stripped before it reaches any model. Nothing stored.",
};
TITLEEOF
echo "  ✅ page-title.ts created"

echo ""
echo "🔥 Redesign applied! Now run:"
echo "   cd ~/burnchat && git add -A && git commit -m 'redesign: dark theme + new UI' && git push origin main"
