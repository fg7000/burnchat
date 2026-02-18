"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type MappingEntry } from "@/store/session-store";

interface AnonymizationDiffProps {
  mapping: MappingEntry[];
}

const entityTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  PERSON: {
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    border: "border-blue-500/30",
  },
  ORGANIZATION: {
    bg: "bg-purple-500/15",
    text: "text-purple-400",
    border: "border-purple-500/30",
  },
  LOCATION: {
    bg: "bg-green-500/15",
    text: "text-green-400",
    border: "border-green-500/30",
  },
  PHONE_NUMBER: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/30",
  },
  EMAIL_ADDRESS: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
  },
  US_SSN: {
    bg: "bg-red-500/15",
    text: "text-red-400",
    border: "border-red-500/30",
  },
  DATE_TIME: {
    bg: "bg-cyan-500/15",
    text: "text-cyan-400",
    border: "border-cyan-500/30",
  },
};

const defaultColor = {
  bg: "bg-gray-500/15",
  text: "text-gray-400",
  border: "border-gray-500/30",
};

function getEntityColor(entityType: string) {
  return entityTypeColors[entityType] || defaultColor;
}

export function AnonymizationDiff({ mapping }: AnonymizationDiffProps) {
  if (!mapping || mapping.length === 0) {
    return (
      <div className="rounded border border-gray-700 bg-gray-800 p-3 text-xs text-gray-500">
        No anonymization mappings to display.
      </div>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded border border-gray-700 bg-gray-800">
      <div className="divide-y divide-gray-700/50">
        {mapping.map((entry, index) => {
          const color = getEntityColor(entry.entity_type);

          return (
            <div
              key={`${entry.original}-${entry.replacement}-${index}`}
              className="flex items-center gap-2 px-3 py-2"
            >
              {/* Original value */}
              <span className="min-w-0 shrink truncate text-sm text-gray-300">
                {entry.original}
              </span>

              {/* Arrow */}
              <ArrowRight className="h-3 w-3 shrink-0 text-gray-600" />

              {/* Replacement value */}
              <span className="min-w-0 shrink truncate text-sm text-teal-400">
                {entry.replacement}
              </span>

              {/* Entity type badge */}
              <span
                className={cn(
                  "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight",
                  color.bg,
                  color.text,
                  color.border
                )}
              >
                {entry.entity_type}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
