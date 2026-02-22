"use client";

import { ArrowRight } from "lucide-react";

interface DiffEntry {
  original: string;
  replacement: string;
  entity_type: string;
}

interface AnonymizationDiffProps {
  mapping: DiffEntry[];
}

export function AnonymizationDiff({ mapping }: AnonymizationDiffProps) {
  if (!mapping || mapping.length === 0) return null;

  return (
    <div
      style={{
        maxHeight: 200,
        overflowY: "auto",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--bg)",
      }}
    >
      {mapping.map((entry, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
          style={{
            padding: "6px 10px",
            borderBottom: i < mapping.length - 1 ? "1px solid var(--border)" : "none",
            fontSize: 12,
          }}
        >
          <span className="font-mono" style={{ color: "var(--accent)" }}>
            {entry.original}
          </span>
          <ArrowRight style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0 }} />
          <span className="font-mono" style={{ color: "var(--text-secondary)" }}>
            {entry.replacement}
          </span>
          <span
            className="ml-auto font-mono"
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              flexShrink: 0,
            }}
          >
            {entry.entity_type}
          </span>
        </div>
      ))}
    </div>
  );
}
