"use client";

import { ArrowRight } from "lucide-react";
import { type MappingEntry } from "@/store/session-store";

interface AnonymizationDiffProps {
  mapping: MappingEntry[];
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
        {mapping.map((entry, index) => (
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
            <span className="min-w-0 shrink truncate text-sm text-white">
              {entry.replacement}
            </span>

            {/* Entity type badge */}
            <span className="ml-auto shrink-0 rounded-full border border-gray-600 bg-gray-700 px-2 py-0.5 text-[10px] font-medium leading-tight text-gray-300">
              {entry.entity_type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
