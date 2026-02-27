"use client";

import React, { useState, useEffect } from "react";

// ═══ THREE EXAMPLE SCENARIOS ═══
interface TextPart {
  text: string;
  hl?: boolean;
  preserve?: boolean;
  reason?: string;
  replacement?: string;
}

interface Example {
  id: string;
  label: string;
  emoji: string;
  original: TextPart[];
  stats: string;
  preserveNote: string;
}

const EXAMPLES: Example[] = [
  {
    id: "medical",
    label: "Health question",
    emoji: "🏥",
    original: [
      { text: "I've been on " },
      { text: "Lexapro", preserve: true, reason: "medication" },
      { text: " for 6 months but still having panic attacks. My psychiatrist " },
      { text: "Dr. Sarah Chen", hl: true, replacement: "Dr. Karen Williams" },
      { text: " in " },
      { text: "Portland", preserve: true, reason: "jurisdiction" },
      { text: " said to increase the dose. My SSN is " },
      { text: "412-55-8903", hl: true, replacement: "███-██-████" },
      { text: "." },
    ],
    stats: "1 name swapped, 1 redacted",
    preserveNote: "Medication & location kept — AI needs these for a safe answer",
  },
  {
    id: "substance",
    label: "Urgent safety",
    emoji: "⚠️",
    original: [
      { text: "My friend " },
      { text: "David Reeves", hl: true, replacement: "Mark Sullivan" },
      { text: " in " },
      { text: "Austin", preserve: true, reason: "jurisdiction" },
      { text: " took leftover " },
      { text: "Xanax", preserve: true, reason: "medication" },
      { text: " for flight anxiety — 1mg — and also had two beers. He's feeling dizzy. Should he go to urgent care? His phone is " },
      { text: "512-555-0147", hl: true, replacement: "███-███-████" },
      { text: "." },
    ],
    stats: "1 name swapped, 1 redacted",
    preserveNote: "Drug & dosage kept — critical for safety advice",
  },
  {
    id: "workplace",
    label: "Workplace rights",
    emoji: "⚖️",
    original: [
      { text: "I work at " },
      { text: "Goldman Sachs", hl: true, replacement: "a financial firm" },
      { text: " in " },
      { text: "New York", preserve: true, reason: "jurisdiction" },
      { text: " and my manager " },
      { text: "Rachel Torres", hl: true, replacement: "Linda Park" },
      { text: " has been making comments about my pregnancy. I want to know my rights but don't want HR to find out I asked." },
    ],
    stats: "1 name swapped, 1 generalized",
    preserveNote: "Location kept — employment law is state-specific",
  },
];

function AnonymizationFlow() {
  const [exIndex, setExIndex] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timings = [3000, 2200, 3200, 1200];
    const t = setTimeout(() => {
      if (step === 3) {
        setExIndex((i) => (i + 1) % EXAMPLES.length);
        setStep(0);
      } else {
        setStep((s) => s + 1);
      }
    }, timings[step]);
    return () => clearTimeout(t);
  }, [step, exIndex]);

  const ex = EXAMPLES[exIndex];

  const renderOriginal = (fade: boolean) =>
    ex.original.map((part, i) =>
      part.hl ? (
        <span key={i} style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", padding: "1px 4px", borderRadius: 3, fontWeight: 600, fontSize: 12, transition: "opacity 0.4s", opacity: fade ? 0.3 : 1 }}>{part.text}</span>
      ) : part.preserve ? (
        <span key={i} style={{ color: "rgba(255,255,255,0.5)", borderBottom: "1px dashed rgba(255,255,255,0.2)", fontStyle: "italic", fontSize: 12 }}>{part.text}</span>
      ) : (<span key={i}>{part.text}</span>)
    );

  const renderAnonymized = () =>
    ex.original.map((part, i) =>
      part.hl ? (
        <span key={i} style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", padding: "1px 4px", borderRadius: 3, fontWeight: 600, fontSize: 12 }}>{part.replacement}</span>
      ) : part.preserve ? (
        <span key={i} style={{ fontWeight: 500, color: "#fff" }}>{part.text}</span>
      ) : (<span key={i}>{part.text}</span>)
    );

  const StepNum = ({ n, active, done, color }: { n: string; active: boolean; done?: boolean; color?: string }) => (
    <div style={{
      width: 18, height: 18, borderRadius: "50%", fontSize: 9, fontWeight: 700,
      background: done ? "#22c55e" : active ? (color || "#ff6b35") : "#1e1e1e",
      color: active || done ? "#fff" : "rgba(255,255,255,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.4s", flexShrink: 0,
    }}>{done ? "✓" : n}</div>
  );

  return (
    <div style={{ width: "100%" }}>
      {/* Example tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 12 }}>
        {EXAMPLES.map((e, i) => (
          <button key={e.id} onClick={() => { setExIndex(i); setStep(0); }} style={{
            display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 5,
            border: "none", cursor: "pointer",
            background: i === exIndex ? "rgba(255, 107, 53, 0.08)" : "transparent",
            transition: "all 0.3s",
          }}>
            <span style={{ fontSize: 10 }}>{e.emoji}</span>
            <span style={{ fontSize: 9, fontWeight: i === exIndex ? 600 : 400, color: i === exIndex ? "#ff6b35" : "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif" }}>{e.label}</span>
          </button>
        ))}
      </div>

      {/* Step 1 */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <StepNum n="1" active={step === 0} />
        <span style={{ fontSize: 10, fontWeight: 600, color: step === 0 ? "#ff6b35" : "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif", transition: "all 0.4s" }}>You type your message</span>
      </div>
      <div key={`o-${exIndex}`} className="fade-in-up" style={{
        padding: "10px 12px", borderRadius: 7, background: "#161618",
        border: `1px solid ${step === 0 ? "rgba(255, 107, 53, 0.15)" : "rgba(255,255,255,0.06)"}`,
        fontSize: 12, lineHeight: 1.75, color: "#fff",
        fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.4s",
      }}>
        {renderOriginal(step >= 2)}
      </div>
      {step === 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: 1.5, background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444" }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Personal info</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: 1.5, background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.2)" }} />
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>Context preserved</span>
          </div>
        </div>
      )}

      {/* Arrow 1 */}
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: step >= 1 ? "#ff6b35" : "rgba(255,255,255,0.06)", transition: "all 0.4s" }} />
          <svg width="7" height="4" viewBox="0 0 8 5" fill={step >= 1 ? "#ff6b35" : "rgba(255,255,255,0.06)"} style={{ transition: "fill 0.4s" }}><path d="M0 0L4 5L8 0Z" /></svg>
        </div>
      </div>

      {/* Step 2 */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <StepNum n="2" active={step === 1} done={step > 1} />
        <span style={{ fontSize: 10, fontWeight: 600, color: step === 1 ? "#ff6b35" : step > 1 ? "#22c55e" : "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif", transition: "all 0.4s" }}>BurnChat strips your identity</span>
      </div>
      <div style={{
        padding: "8px 12px", borderRadius: 7,
        background: step === 1 ? "rgba(255, 107, 53, 0.08)" : "#161618",
        border: `1px solid ${step === 1 ? "rgba(255, 107, 53, 0.15)" : step > 1 ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.4s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: step === 1 ? "#ff6b35" : step > 1 ? "#22c55e" : "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.4s" }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L13.5 4V7.5C13.5 11 11 13.7 8 14.5C5 13.7 2.5 11 2.5 7.5V4L8 1.5Z" fill="#fff" opacity="0.9" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: step === 1 ? "#ff6b35" : step > 1 ? "#22c55e" : "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif", transition: "all 0.4s" }}>Privacy Engine</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Runs in your browser — data never leaves</div>
          </div>
        </div>
        <div>
          {step === 1 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div className="animate-dot-1" style={{ width: 4, height: 4, borderRadius: "50%", background: "#ff6b35" }} />
              <span style={{ fontSize: 10, color: "#ff6b35", fontWeight: 500 }}>Stripping...</span>
            </div>
          ) : step > 1 ? (
            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 500 }}>{ex.stats}</span>
          ) : (
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>Waiting</span>
          )}
        </div>
      </div>

      {/* Arrow 2 */}
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <div style={{ width: 2, height: 12, borderRadius: 1, background: step >= 2 ? "#60a5fa" : "rgba(255,255,255,0.06)", transition: "all 0.4s" }} />
          <svg width="7" height="4" viewBox="0 0 8 5" fill={step >= 2 ? "#60a5fa" : "rgba(255,255,255,0.06)"} style={{ transition: "fill 0.4s" }}><path d="M0 0L4 5L8 0Z" /></svg>
        </div>
      </div>

      {/* Step 3 */}
      <div style={{ opacity: step >= 2 ? 1 : 0.2, transition: "all 0.5s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <StepNum n="3" active={step >= 2} color="#60a5fa" />
          <span style={{ fontSize: 10, fontWeight: 600, color: step >= 2 ? "#60a5fa" : "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif", transition: "all 0.4s" }}>AI only sees this</span>
          {step >= 2 && (
            <span className="fade-in-up" style={{ fontSize: 8, color: "#22c55e", fontWeight: 600, background: "rgba(34,197,94,0.1)", padding: "1px 6px", borderRadius: 8 }}>You&apos;re invisible</span>
          )}
        </div>
        <div key={`a-${exIndex}`} style={{
          padding: "10px 12px", borderRadius: 7, position: "relative",
          background: step >= 2 ? "rgba(96,165,250,0.03)" : "#161618",
          border: `1px solid ${step >= 2 ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.06)"}`,
          fontSize: 12, lineHeight: 1.75, color: step >= 2 ? "#fff" : "rgba(255,255,255,0.15)",
          fontFamily: "'DM Sans', sans-serif", transition: "all 0.5s",
        }}>
          {step >= 2 && (
            <div style={{ position: "absolute", top: -7, right: 10, background: "#141416", border: "1px solid rgba(96,165,250,0.2)", padding: "0px 6px", borderRadius: 3, fontSize: 8, color: "#60a5fa", fontWeight: 700, letterSpacing: "0.05em" }}>AI&apos;S VIEW</div>
          )}
          {renderAnonymized()}
        </div>
        {step >= 2 && (
          <div className="fade-in-up" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 9, color: "#22c55e" }}>✓</span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{ex.preserveNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 max-w-[560px] mx-auto w-full">
      {/* Headline */}
      <h1
        className="fade-in-up text-center mb-2.5"
        style={{
          fontSize: "clamp(26px, 3.5vw, 40px)",
          fontWeight: 300,
          letterSpacing: "-0.035em",
          lineHeight: 1.1,
          color: "#fff",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        Every AI you talk to
        <br />
        <span style={{ background: "linear-gradient(135deg, #ff6b35, #ff3c1e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          is building a profile on you.
        </span>
      </h1>

      {/* Subtitle */}
      <p
        className="fade-in-up-delay-1 text-center mb-5"
        style={{ fontSize: "14px", color: "rgba(255,255,255,0.35)", fontWeight: 300, lineHeight: 1.65, maxWidth: "440px", fontFamily: "'DM Sans', sans-serif" }}
      >
        BurnChat strips your identity in real-time before your prompts reach any AI. The AI gets your question — never the person behind it.
      </p>

      {/* Animated flow */}
      <div
        className="fade-in-up-delay-2 w-full"
        style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 14px 10px", marginBottom: "18px" }}
      >
        <div style={{ textAlign: "center", fontSize: "9px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.08em", textTransform: "uppercase" as const, fontWeight: 500, marginBottom: "2px", fontFamily: "'JetBrains Mono', monospace" }}>
          See how your data is protected
        </div>
        <AnonymizationFlow />
      </div>

      {/* Feature pills */}
      <div className="fade-in-up-delay-2 flex gap-1.5 flex-wrap justify-center mb-3">
        {[
          { icon: "💬", label: "Chat anonymously" },
          { icon: "📄", label: "Upload docs" },
          { icon: "🔗", label: "Paste URLs" },
          { icon: "🎙️", label: "Voice input" },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-default" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: "12px" }}>{item.icon}</span>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Credits */}
      <div className="fade-in-up-delay-3">
        <p className="text-center" style={{ fontSize: "12px", color: "rgba(255,255,255,0.15)", fontWeight: 300 }}>
          100 free credits to start. No card required.
        </p>
      </div>
    </div>
  );
}

export default WelcomeMessage;
