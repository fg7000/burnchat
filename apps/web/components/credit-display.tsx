"use client";

import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { useUIStore } from "@/store/ui-store";

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export default function CreditDisplay() {
  const { creditBalance } = useSessionStore();
  const { setShowCreditModal } = useUIStore();

  const isLow = creditBalance <= 0;

  return (
    <button
      onClick={() => setShowCreditModal(true)}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
        isLow
          ? "text-gray-500 hover:text-gray-300"
          : "text-gray-300 hover:text-white"
      )}
    >
      <Coins
        className={cn(
          "h-4 w-4",
          isLow ? "text-gray-500" : "text-gray-300"
        )}
      />
      <span className="font-medium tabular-nums">
        {formatNumber(creditBalance)}
      </span>
    </button>
  );
}
