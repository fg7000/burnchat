"use client";

import React, { useState } from "react";
import { MappingEntry } from "@/store/session-store";
import { ChevronDown, ChevronUp, Shield } from "lucide-react";

interface AnonymizationDiffProps {
  originalText: string;
  anonymizedText: string;
  mapping: MappingEntry[];
  mode?: "message" | "document";
}

/**
 * Shows what PII was detected and replaced.
 * Two modes:
 *   - "message" (default): Compact inline banner for chat messages
 *   - "document": Expandable panel with full entity list for uploaded docs
 */
export default function AnonymizationDiff({
  originalText,
  anonymizedText,
  mapping,
  mode = "message",
}: AnonymizationDiffProps) {
  const [expanded, setExpanded] = useState(false);

  if (!mapping || mapping.length === 0) return null;

  // Group entities by type for document mode
  const entityGroups: Record<string, MappingEntry[]> = {};
  for (const m of mapping) {
    const key = m.entity_type.toUpperCase();
    if (!entityGroups[key]) entityGroups[key] = [];
    entityGroups[key].push(m);
  }

  // Build highlighted segments from original text
  const segments = buildSegments(originalText, mapping);

  // ---- COMPACT MESSAGE MODE ----
  if (mode === "message") {
    return (
      <div
        style={{
          padding: "8px 12px",
          borderRadius: "10px",
          background: "rgba(255, 107, 53, 0.04)",
          border: "1px solid rgba(255, 107, 53, 0.12)",
          fontSize: "12px",
          lineHeight: "1.5",
          color: "rgba(255, 255, 255, 0.45)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <Shield style={{ width: "12px", height: "12px", color: "#ff6b35", opacity: 0.7 }} />
          <span style={{ color: "rgba(255, 107, 53, 0.7)", fontWeight: 500 }}>
            {mapping.length} {mapping.length === 1 ? "entity" : "entities"} shielded
          </span>
        </div>

        {/* Inline highlighted text — truncate if long */}
        <div style={{ marginBottom: "4px" }}>
          {segments.slice(0, 20).map((seg, i) =>
            seg.isEntity ? (
              <span
                key={i}
                title={`${seg.entityType} → ${seg.replacement}`}
                style={{
                  background: "rgba(255, 107, 53, 0.12)",
                  color: "#ff6b35",
                  padding: "0 3px",
                  borderRadius: "3px",
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(255, 107, 53, 0.3)",
                  cursor: "help",
                }}
              >
                {seg.text}
              </span>
            ) : (
              <span key={i}>
                {seg.text.length > 60 ? seg.text.slice(0, 60) + "..." : seg.text}
              </span>
            )
          )}
        </div>

        {/* What AI sees */}
        <div style={{ fontStyle: "italic", opacity: 0.5, fontSize: "11px" }}>
          AI sees: {anonymizedText.length > 100 ? anonymizedText.slice(0, 100) + "…" : anonymizedText}
        </div>
      </div>
    );
  }

  // ---- DOCUMENT MODE ----
  return (
    <div
      style={{
        borderRadius: "12px",
        background: "rgba(255, 107, 53, 0.04)",
        border: "1px solid rgba(255, 107, 53, 0.12)",
        overflow: "hidden",
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "rgba(255, 255, 255, 0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield style={{ width: "14px", height: "14px", color: "#ff6b35" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255, 107, 53, 0.8)" }}>
            {mapping.length} {mapping.length === 1 ? "entity" : "entities"} shielded
          </span>
          {/* Entity type pills */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {Object.entries(entityGroups).map(([type, entries]) => (
              <span
                key={type}
                style={{
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "8px",
                  background: "rgba(255, 107, 53, 0.1)",
                  color: "rgba(255, 107, 53, 0.6)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {type} ({entries.length})
              </span>
            ))}
          </div>
        </div>
        {expanded ? (
          <ChevronUp style={{ width: "14px", height: "14px", opacity: 0.4 }} />
        ) : (
          <ChevronDown style={{ width: "14px", height: "14px", opacity: 0.4 }} />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: "0 14px 12px" }}>
          {/* Entity table */}
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              marginBottom: "8px",
              fontSize: "12px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "rgba(255, 255, 255, 0.3)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Original</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Replaced with</th>
                  <th style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {mapping.map((m, i) => (
                  <tr key={i} style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                    <td style={{ padding: "3px 8px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <span style={{ color: "#ff6b35", textDecoration: "line-through", textDecorationColor: "rgba(255,107,53,0.3)" }}>
                        {m.original}
                      </span>
                    </td>
                    <td style={{ padding: "3px 8px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontFamily: "monospace", fontSize: "11px" }}>
                      {m.replacement}
                    </td>
                    <td style={{ padding: "3px 8px", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: "10px", textTransform: "uppercase", opacity: 0.5 }}>
                      {m.entity_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Preview of anonymized text */}
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
            AI sees: {anonymizedText.length > 200 ? anonymizedText.slice(0, 200) + "…" : anonymizedText}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Helper: Build segments ----
function buildSegments(
  text: string,
  mapping: MappingEntry[]
): Array<{
  text: string;
  isEntity: boolean;
  replacement?: string;
  entityType?: string;
}> {
  const positions: Array<{
    start: number;
    end: number;
    original: string;
    replacement: string;
    entityType: string;
  }> = [];

  for (const m of mapping) {
    let idx = text.indexOf(m.original);
    while (idx !== -1) {
      positions.push({
        start: idx,
        end: idx + m.original.length,
        original: m.original,
        replacement: m.replacement,
        entityType: m.entity_type,
      });
      idx = text.indexOf(m.original, idx + 1);
    }
  }

  positions.sort((a, b) => a.start - b.start);

  const segments: Array<{
    text: string;
    isEntity: boolean;
    replacement?: string;
    entityType?: string;
  }> = [];

  let lastEnd = 0;
  for (const pos of positions) {
    if (pos.start < lastEnd) continue;
    if (pos.start > lastEnd) {
      segments.push({ text: text.slice(lastEnd, pos.start), isEntity: false });
    }
    segments.push({
      text: pos.original,
      isEntity: true,
      replacement: pos.replacement,
      entityType: pos.entityType,
    });
    lastEnd = pos.end;
  }
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), isEntity: false });
  }

  return segments;
}
