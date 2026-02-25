"use client";

import React from "react";
import { MappingEntry } from "@/store/session-store";

interface AnonymizationDiffProps {
  originalText: string;
  anonymizedText: string;
  mapping: MappingEntry[];
}

/**
 * Shows what PII was detected and replaced.
 * Highlights anonymized entities in the original text.
 */
export default function AnonymizationDiff({
  originalText,
  anonymizedText,
  mapping,
}: AnonymizationDiffProps) {
  if (!mapping || mapping.length === 0) return null;

  // Find positions of originals in the text
  const segments: Array<{
    text: string;
    isEntity: boolean;
    replacement?: string;
    entityType?: string;
  }> = [];

  // Build segments by finding each original in the text
  const positions: Array<{
    start: number;
    end: number;
    original: string;
    replacement: string;
    entityType: string;
  }> = [];

  for (const m of mapping) {
    let idx = originalText.indexOf(m.original);
    while (idx !== -1) {
      positions.push({
        start: idx,
        end: idx + m.original.length,
        original: m.original,
        replacement: m.replacement,
        entityType: m.entity_type,
      });
      idx = originalText.indexOf(m.original, idx + 1);
    }
  }

  positions.sort((a, b) => a.start - b.start);

  let lastEnd = 0;
  for (const pos of positions) {
    if (pos.start < lastEnd) continue; // skip overlaps
    if (pos.start > lastEnd) {
      segments.push({ text: originalText.slice(lastEnd, pos.start), isEntity: false });
    }
    segments.push({
      text: pos.original,
      isEntity: true,
      replacement: pos.replacement,
      entityType: pos.entityType,
    });
    lastEnd = pos.end;
  }
  if (lastEnd < originalText.length) {
    segments.push({ text: originalText.slice(lastEnd), isEntity: false });
  }

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: "8px",
        background: "rgba(255, 107, 53, 0.05)",
        border: "1px solid rgba(255, 107, 53, 0.15)",
        fontSize: "12px",
        lineHeight: "1.6",
        color: "rgba(255, 255, 255, 0.5)",
      }}
    >
      <div style={{ marginBottom: "4px", fontWeight: 500, color: "rgba(255, 107, 53, 0.7)" }}>
        🔥 {mapping.length} {mapping.length === 1 ? "entity" : "entities"} anonymized
      </div>
      <div>
        {segments.map((seg, i) =>
          seg.isEntity ? (
            <span
              key={i}
              title={`${seg.entityType} → ${seg.replacement}`}
              style={{
                background: "rgba(255, 107, 53, 0.15)",
                color: "#ff6b35",
                padding: "1px 4px",
                borderRadius: "3px",
                cursor: "help",
                textDecoration: "line-through",
                textDecorationColor: "rgba(255, 107, 53, 0.4)",
              }}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>
      <div style={{ marginTop: "4px", fontStyle: "italic", opacity: 0.6 }}>
        AI sees: {anonymizedText.length > 120 ? anonymizedText.slice(0, 120) + "..." : anonymizedText}
      </div>
    </div>
  );
}
