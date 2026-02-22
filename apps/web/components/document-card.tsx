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
} from "lucide-react";
import { type DocumentInfo } from "@/store/session-store";
import { AnonymizationDiff } from "@/components/anonymization-diff";

interface DocumentCardProps {
  document: DocumentInfo;
}

const statusConfig: Record<
  DocumentInfo["status"],
  { label: string; icon: React.ReactNode; color: string }
> = {
  parsing: {
    label: "Parsing document...",
    icon: <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />,
    color: "var(--text-secondary)",
  },
  anonymizing: {
    label: "Anonymizing content...",
    icon: <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />,
    color: "var(--text-secondary)",
  },
  embedding: {
    label: "Creating embeddings...",
    icon: <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />,
    color: "var(--text-secondary)",
  },
  ready: {
    label: "Ready",
    icon: <CheckCircle2 style={{ width: 14, height: 14 }} />,
    color: "var(--accent)",
  },
  error: {
    label: "Error",
    icon: <AlertCircle style={{ width: 14, height: 14 }} />,
    color: "var(--text-secondary)",
  },
};

export function DocumentCard({ document }: DocumentCardProps) {
  const [showAnonymized, setShowAnonymized] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  const status = statusConfig[document.status];
  const totalEntities = document.entitiesFound.reduce(
    (sum, e) => sum + e.count,
    0
  );

  return (
    <div
      style={{
        width: "100%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-sm)",
              background: "var(--accent-subtle-bg)",
              flexShrink: 0,
            }}
          >
            <FileText style={{ width: 16, height: 16, color: "var(--accent)" }} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-primary" style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 400 }}>
              {document.filename}
            </p>
            <p className="font-mono" style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {status.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" style={{ color: status.color }}>
          {status.icon}
        </div>
      </div>

      {/* Error detail */}
      {document.status === "error" && document.errorDetail && (
        <p className="font-primary" style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          {document.errorDetail}
        </p>
      )}

      {/* Progress bar */}
      {document.progress !== undefined &&
        document.status !== "ready" &&
        document.status !== "error" && (
          <div style={{ marginTop: 12 }}>
            <div
              style={{
                height: 2,
                width: "100%",
                borderRadius: 1,
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                className="accent-gradient-bg"
                style={{
                  height: "100%",
                  borderRadius: 1,
                  width: `${Math.min(document.progress, 100)}%`,
                  transition: "width 0.3s ease-out",
                }}
              />
            </div>
            <div className="flex items-center justify-between font-mono" style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>
              <span>{document.progressDetail ?? ""}</span>
              <span>{Math.round(document.progress)}%</span>
            </div>
          </div>
        )}

      {/* Entity summary */}
      {document.entitiesFound.length > 0 && (
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: 12 }}>
          <div
            className="flex items-center gap-1 font-mono"
            style={{
              padding: "2px 8px",
              borderRadius: "var(--radius-sm)",
              background: "var(--accent-subtle-bg)",
              fontSize: 11,
              color: "var(--accent)",
            }}
          >
            <Shield style={{ width: 12, height: 12 }} />
            {totalEntities} entities found
          </div>
          {document.entitiesFound.map((entity) => (
            <span
              key={entity.type}
              className="font-mono"
              style={{
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                fontSize: 11,
                color: "var(--text-secondary)",
              }}
            >
              {entity.type}: {entity.count}
            </span>
          ))}
        </div>
      )}

      {/* Token info */}
      {document.tokenCount > 0 && (
        <p className="font-mono" style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
          {document.tokenCount.toLocaleString()} tokens
          {document.chunkCount ? ` \u00b7 ${document.chunkCount} chunks` : ""}
        </p>
      )}

      {/* Expandable sections */}
      {document.status === "ready" && (
        <div style={{ marginTop: 12 }} className="space-y-2">
          {document.anonymizedText && (
            <div>
              <button
                onClick={() => setShowAnonymized(!showAnonymized)}
                className="flex w-full items-center gap-1 font-primary"
                style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {showAnonymized ? (
                  <ChevronUp style={{ width: 14, height: 14 }} />
                ) : (
                  <ChevronDown style={{ width: 14, height: 14 }} />
                )}
                View anonymized version
              </button>
              {showAnonymized && (
                <div
                  className="font-mono"
                  style={{
                    marginTop: 6,
                    maxHeight: 192,
                    overflowY: "auto",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    padding: 8,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {document.anonymizedText.length > 500
                    ? document.anonymizedText.slice(0, 500) + "\u2026"
                    : document.anonymizedText}
                </div>
              )}
            </div>
          )}

          {document.mapping.length > 0 && (
            <div>
              <button
                onClick={() => setShowChanges(!showChanges)}
                className="flex w-full items-center gap-1 font-primary"
                style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                {showChanges ? (
                  <ChevronUp style={{ width: 14, height: 14 }} />
                ) : (
                  <ChevronDown style={{ width: 14, height: 14 }} />
                )}
                View what was changed ({document.mapping.length} replacements)
              </button>
              {showChanges && (
                <div style={{ marginTop: 6 }}>
                  <AnonymizationDiff mapping={document.mapping} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
