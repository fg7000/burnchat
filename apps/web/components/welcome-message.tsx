"use client";

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const featurePills = [
  "\uD83D\uDCAC Chat anonymously",
  "\uD83D\uDCC4 Upload documents",
  "\uD83D\uDD17 Paste URLs",
  "\uD83C\uDF99\uFE0F Voice (coming soon)",
];

const steps = [
  { num: "1", text: "You type or upload" },
  { num: "2", text: "We strip all PII" },
  { num: "3", text: "AI sees nothing real" },
];

export function WelcomeMessage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div
        className="flex flex-col items-center text-center"
        style={{ maxWidth: 720 }}
      >
        {/* 1. VPN Tagline pill */}
        <div className="animate-fade-in-up stagger-1">
          <div
            className="inline-flex items-center gap-2"
            style={{
              padding: "10px 24px",
              borderRadius: 24,
              background: "rgba(255, 107, 53, 0.08)",
              border: "1px solid rgba(255, 107, 53, 0.15)",
              marginBottom: 32,
            }}
          >
            <span style={{ color: "var(--accent)" }}>
              <ShieldIcon />
            </span>
            <span
              className="font-primary"
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "var(--accent)",
              }}
            >
              The VPN for AI
            </span>
          </div>
        </div>

        {/* 2. Headline */}
        <div className="animate-fade-in-up stagger-2">
          <h1
            className="font-primary"
            style={{
              fontSize: 48,
              fontWeight: 300,
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              color: "var(--text-primary)",
              marginBottom: 20,
            }}
          >
            Talk to AI.
            <br />
            <span className="accent-gradient-text">Stay invisible.</span>
          </h1>
        </div>

        {/* 3. Subtitle */}
        <div className="animate-fade-in-up stagger-3">
          <p
            className="font-primary"
            style={{
              fontSize: 15,
              fontWeight: 300,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              maxWidth: 460,
              margin: "0 auto 32px",
            }}
          >
            Chat, upload documents, or just speak your mind. Every name, email,
            and detail is stripped before it reaches any AI. Nothing is stored.
            Ever.
          </p>
        </div>

        {/* 4. Feature pills */}
        <div className="animate-fade-in-up stagger-4">
          <div
            className="flex flex-wrap justify-center gap-2"
            style={{ marginBottom: 40 }}
          >
            {featurePills.map((pill) => (
              <div
                key={pill}
                style={{
                  padding: "8px 16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  cursor: "default",
                }}
                className="hover:text-white/70"
              >
                {pill}
              </div>
            ))}
          </div>
        </div>

        {/* 5. How it works */}
        <div className="animate-fade-in-up stagger-5">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono flex items-center justify-center"
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: "var(--accent-subtle-bg)",
                      fontSize: 11,
                      color: "var(--accent)",
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {step.num}
                  </span>
                  <span
                    className="font-primary"
                    style={{
                      fontSize: 13,
                      fontWeight: 300,
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    {step.text}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.1)",
                    }}
                  >
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
