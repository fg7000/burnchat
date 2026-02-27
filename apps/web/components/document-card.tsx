"use client";

import { useState } from "react";
import {
  FileText,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
} from "lucide-react";
import { type DocumentInfo, type MappingEntry } from "@/store/session-store";

interface DocumentCardProps {
  document: DocumentInfo;
}

function groupByType(mapping: MappingEntry[]): Record<string, MappingEntry[]> {
  const groups: Record<string, MappingEntry[]> = {};
  for (const m of mapping) {
    const key = m.entity_type.toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  return groups;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  PERSON: { bg: "rgba(255, 107, 53, 0.1)", text: "#ff6b35", dot: "#ff6b35" },
  LOCATION: { bg: "rgba(59, 130, 246, 0.1)", text: "#60a5fa", dot: "#3b82f6" },
  ORGANIZATION: { bg: "rgba(168, 85, 247, 0.1)", text: "#c084fc", dot: "#a855f7" },
  DATE_TIME: { bg: "rgba(234, 179, 8, 0.1)", text: "#fbbf24", dot: "#eab308" },
  EMAIL_ADDRESS: { bg: "rgba(20, 184, 166, 0.1)", text: "#5eead4", dot: "#14b8a6" },
  EMAIL: { bg: "rgba(20, 184, 166, 0.1)", text: "#5eead4", dot: "#14b8a6" },
  PHONE: { bg: "rgba(244, 114, 182, 0.1)", text: "#f472b6", dot: "#ec4899" },
  SSN: { bg: "rgba(239, 68, 68, 0.1)", text: "#f87171", dot: "#ef4444" },
  ADDRESS: { bg: "rgba(251, 146, 60, 0.1)", text: "#fb923c", dot: "#f97316" },
  DEFAULT: { bg: "rgba(255, 255, 255, 0.05)", text: "rgba(255,255,255,0.5)", dot: "rgba(255,255,255,0.3)" },
};

function getTypeColor(type: string) {
  return TYPE_COLORS[type.toUpperCase()] || TYPE_COLORS.DEFAULT;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const [showAnonymized, setShowAnonymized] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const totalEntities = document.entitiesFound.reduce((sum, e) => sum + e.count, 0);
  const groups = groupByType(document.mapping);
  const isProcessing = document.status !== "ready" && document.status !== "error";

  return (
    <div
      style={{
        borderRadius: "14px",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255, 107, 53, 0.08)",
              border: "1px solid rgba(255, 107, 53, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FileText style={{ width: "16px", height: "16px", color: "#ff6b35" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {document.filename}
            </div>
            {document.tokenCount > 0 && (
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>
                {document.tokenCount.toLocaleString()} tokens
                {document.chunkCount ? ` \u00b7 ${document.chunkCount} chunks` : ""}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: document.status === "ready" ? "#22c55e" : document.status === "error" ? "#ef4444" : "rgba(255,255,255,0.4)",
            flexShrink: 0,
          }}
        >
          {document.status === "ready" ? (
            <CheckCircle2 style={{ width: "14px", height: "14px" }} />
          ) : document.status === "error" ? (
            <AlertCircle style={{ width: "14px", height: "14px" }} />
          ) : (
            <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />
          )}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
            {document.status === "ready" ? "Ready" : document.status === "error" ? "Error" : document.progressDetail || "Processing..."}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {isProcessing && document.progress !== undefined && (
        <div style={{ padding: "0 18px", paddingTop: "8px" }}>
          <div style={{ height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: "2px",
                background: "linear-gradient(90deg, #ff6b35, #ff3c1e)",
                width: `${Math.min(document.progress, 100)}%`,
                transition: "width 0.3s ease-out",
              }}
            />
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "right", marginTop: "4px" }}>
            {Math.round(document.progress)}%
          </div>
        </div>
      )}

      {/* Error detail */}
      {document.status === "error" && document.errorDetail && (
        <div style={{ padding: "8px 18px", fontSize: "12px", color: "rgba(239, 68, 68, 0.7)" }}>
          {document.errorDetail}
        </div>
      )}

      {/* Entity summary pills */}
      {document.entitiesFound.length > 0 && (
        <div style={{ padding: "12px 18px", display: "flex", flexWrap: "wrap", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 10px",
              borderRadius: "8px",
              background: "rgba(255, 107, 53, 0.08)",
              border: "1px solid rgba(255, 107, 53, 0.15)",
              fontSize: "11px",
              fontWeight: 500,
              color: "#ff6b35",
            }}
          >
            <Shield style={{ width: "12px", height: "12px" }} />
            {totalEntities} shielded
          </div>
          {document.entitiesFound.map((entity) => {
            const colors = getTypeColor(entity.type);
            return (
              <span
                key={entity.type}
                style={{
                  padding: "3px 10px",
                  borderRadius: "8px",
                  background: colors.bg,
                  fontSize: "11px",
                  color: colors.text,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.02em",
                }}
              >
                {entity.type}: {entity.count}
              </span>
            );
          })}
        </div>
      )}

      {/* Expandable sections */}
      {document.status === "ready" && (
        <div>
          {/* View anonymized version */}
          {document.anonymizedText && (
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <button
                onClick={() => setShowAnonymized(!showAnonymized)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 18px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "12px",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {showAnonymized ? <EyeOff style={{ width: "13px", height: "13px" }} /> : <Eye style={{ width: "13px", height: "13px" }} />}
                  <span>{showAnonymized ? "Hide" : "View"} what the AI sees</span>
                </div>
                {showAnonymized ? (
                  <ChevronUp style={{ width: "13px", height: "13px", opacity: 0.4 }} />
                ) : (
                  <ChevronDown style={{ width: "13px", height: "13px", opacity: 0.4 }} />
                )}
              </button>
              {showAnonymized && (
                <div
                  style={{
                    margin: "0 18px 12px",
                    maxHeight: "300px",
                    overflowY: "auto",
                    borderRadius: "10px",
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    padding: "14px",
                    fontSize: "12px",
                    lineHeight: "1.7",
                    color: "rgba(255,255,255,0.55)",
                    whiteSpace: "pre-wrap",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {document.anonymizedText}
                </div>
              )}
            </div>
          )}

          {/* View what was changed */}
          {document.mapping.length > 0 && (
            <div>
              <button
                onClick={() => setShowChanges(!showChanges)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 18px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "12px",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Shield style={{ width: "13px", height: "13px" }} />
                  <span>{showChanges ? "Hide" : "View"} what was changed</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
                    ({document.mapping.length} replacements)
                  </span>
                </div>
                {showChanges ? (
                  <ChevronUp style={{ width: "13px", height: "13px", opacity: 0.4 }} />
                ) : (
                  <ChevronDown style={{ width: "13px", height: "13px", opacity: 0.4 }} />
                )}
              </button>

              {showChanges && (
                <div style={{ padding: "0 18px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {Object.entries(groups).map(([type, entries]) => {
                      const colors = getTypeColor(type);
                      const isExpanded = expandedType === type;

                      return (
                        <div
                          key={type}
                          style={{
                            borderRadius: "10px",
                            background: colors.bg,
                            border: "1px solid " + colors.text + "22",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            onClick={() => setExpandedType(isExpanded ? null : type)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 12px",
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: colors.text,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: colors.dot }} />
                              <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'JetBrains Mono', monospace" }}>
                                {type}
                              </span>
                              <span style={{ fontSize: "11px", opacity: 0.6 }}>
                                {entries.length} {entries.length === 1 ? "replacement" : "replacements"}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp style={{ width: "12px", height: "12px", opacity: 0.5 }} />
                            ) : (
                              <ChevronDown style={{ width: "12px", height: "12px", opacity: 0.5 }} />
                            )}
                          </button>

                          {isExpanded && (
                            <div style={{ maxHeight: "250px", overflowY: "auto", padding: "0 12px 10px" }}>
                              {entries.map((m, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "5px 0",
                                    borderBottom: i < entries.length - 1 ? "1px solid " + colors.text + "11" : "none",
                                    fontSize: "12px",
                                  }}
                                >
                                  <span
                                    style={{
                                      color: colors.text,
                                      textDecoration: "line-through",
                                      textDecorationColor: colors.text + "44",
                                      flex: 1,
                                      minWidth: 0,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {m.original}
                                  </span>
                                  <ArrowRight style={{ width: "10px", height: "10px", color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
                                  <span
                                    style={{
                                      color: "rgba(255,255,255,0.5)",
                                      fontFamily: "'JetBrains Mono', monospace",
                                      fontSize: "11px",
                                      flex: 1,
                                      minWidth: 0,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {m.replacement}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
