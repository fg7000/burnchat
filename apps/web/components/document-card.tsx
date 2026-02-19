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
import { cn } from "@/lib/utils";
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
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "text-yellow-400",
  },
  anonymizing: {
    label: "Anonymizing content...",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "text-teal-400",
  },
  embedding: {
    label: "Creating embeddings...",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    color: "text-blue-400",
  },
  ready: {
    label: "Ready",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-green-400",
  },
  error: {
    label: "Error",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: "text-red-400",
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
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate text-sm font-medium text-gray-200">
            {document.filename}
          </span>
        </div>
        <div className={cn("flex items-center gap-1 text-xs shrink-0", status.color)}>
          {status.icon}
          <span>{status.label}</span>
        </div>
      </div>

      {/* Progress bar */}
      {document.progress !== undefined &&
        document.status !== "ready" &&
        document.status !== "error" && (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out",
                  document.status === "parsing" && "bg-yellow-400",
                  document.status === "anonymizing" && "bg-teal-400",
                  document.status === "embedding" && "bg-blue-400"
                )}
                style={{ width: `${Math.min(document.progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>{document.progressDetail ?? ""}</span>
              <span>{Math.round(document.progress)}%</span>
            </div>
          </div>
        )}

      {/* Entity summary */}
      {document.entitiesFound.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="flex items-center gap-1 rounded bg-teal-600/20 px-2 py-0.5 text-xs text-teal-300">
            <Shield className="h-3 w-3" />
            {totalEntities} entities found
          </div>
          {document.entitiesFound.map((entity) => (
            <span
              key={entity.type}
              className="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-400"
            >
              {entity.type}: {entity.count}
            </span>
          ))}
        </div>
      )}

      {/* Token info */}
      {document.tokenCount > 0 && (
        <p className="mt-1.5 text-xs text-gray-500">
          {document.tokenCount.toLocaleString()} tokens
          {document.chunkCount ? ` \u00b7 ${document.chunkCount} chunks` : ""}
        </p>
      )}

      {/* Expandable sections */}
      {document.status === "ready" && (
        <div className="mt-3 space-y-2">
          {/* View anonymized version */}
          {document.anonymizedText && (
            <div>
              <button
                onClick={() => setShowAnonymized(!showAnonymized)}
                className="flex w-full items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-200"
              >
                {showAnonymized ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                View anonymized version
              </button>
              {showAnonymized && (
                <div className="mt-1.5 max-h-48 overflow-y-auto rounded border border-gray-700 bg-gray-900 p-2 text-xs text-gray-300 whitespace-pre-wrap">
                  {document.anonymizedText.length > 500
                    ? document.anonymizedText.slice(0, 500) + "\u2026"
                    : document.anonymizedText}
                </div>
              )}
            </div>
          )}

          {/* View what was changed */}
          {document.mapping.length > 0 && (
            <div>
              <button
                onClick={() => setShowChanges(!showChanges)}
                className="flex w-full items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-200"
              >
                {showChanges ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                View what was changed ({document.mapping.length} replacements)
              </button>
              {showChanges && (
                <div className="mt-1.5">
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
