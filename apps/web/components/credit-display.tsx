"use client";

import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";

export default function CreditDisplay() {
  const { creditBalance } = useSessionStore();
  const { setShowCreditModal } = useUIStore();

  const dollars = (creditBalance / 100).toFixed(2);

  return (
    <button
      onClick={() => setShowCreditModal(true)}
      className="flex items-center gap-2 font-mono"
      style={{
        height: 30,
        padding: "0 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        fontSize: 12,
        color: "var(--text-secondary)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent)",
          flexShrink: 0,
        }}
      />
      <span>${dollars} credit</span>
    </button>
  );
}
