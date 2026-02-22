"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ModelOption {
  id: string;
  name: string;
  inputPrice: string;
  outputPrice: string;
  badge?: string;
}

const DEFAULT_MODELS: ModelOption[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", inputPrice: "$0.23/M", outputPrice: "$0.90/M" },
  { id: "openai/gpt-4o", name: "GPT-4o", inputPrice: "$3.75/M", outputPrice: "$15.00/M" },
  { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", inputPrice: "$4.50/M", outputPrice: "$22.50/M" },
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", inputPrice: "$22.50/M", outputPrice: "$112.50/M" },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", inputPrice: "$0.15/M", outputPrice: "$0.60/M" },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", inputPrice: "$1.88/M", outputPrice: "$15.00/M" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", inputPrice: "$0.59/M", outputPrice: "$0.59/M" },
];

export default function ModelSelector() {
  const { selectedModel, setSelectedModel, token, documents } = useSessionStore();
  const [models, setModels] = useState<ModelOption[]>(DEFAULT_MODELS);
  const [recommendedModel, setRecommendedModel] = useState<string | null>(null);

  const hasDocuments = documents.length > 0;

  useEffect(() => {
    async function fetchModels() {
      try {
        const data = await apiClient.getModels(token);
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fetched: ModelOption[] = data.models.map((m: Record<string, any>) => ({
            id: m.id,
            name: m.name || m.id,
            inputPrice: m.input_price ? `$${m.input_price}/M` : "$0.00/M",
            outputPrice: m.output_price ? `$${m.output_price}/M` : "$0.00/M",
            badge: m.badge,
          }));
          setModels(fetched);
        }
      } catch {
        // Keep default models on failure
      }
    }
    fetchModels();
  }, [token]);

  useEffect(() => {
    if (hasDocuments) {
      const totalTokens = documents.reduce((sum, d) => sum + d.tokenCount, 0);
      if (totalTokens < 2000) {
        setRecommendedModel("openai/gpt-4o-mini");
      } else if (totalTokens < 10000) {
        setRecommendedModel("openai/gpt-4o");
      } else {
        setRecommendedModel("anthropic/claude-sonnet-4-5");
      }
    } else {
      setRecommendedModel(null);
    }
  }, [hasDocuments, documents]);

  const selectedModelName = selectedModel
    ? models.find((m) => m.id === selectedModel)?.name || selectedModel
    : "Auto";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 font-mono"
          style={{
            height: 30,
            padding: "0 10px",
            borderRadius: "var(--radius-md)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          <span className="max-w-[120px] truncate">{selectedModelName}</span>
          <ChevronDown style={{ width: 12, height: 12, opacity: 0.5 }} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuItem
          onClick={() => setSelectedModel(null)}
          className={cn(!selectedModel && "font-medium")}
        >
          <div className="flex flex-1 items-center justify-between">
            <span style={{ fontFamily: "var(--font-primary)", fontSize: 13 }}>
              Auto (Recommended)
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => setSelectedModel(model.id)}
            className={cn(selectedModel === model.id && "font-medium")}
          >
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "var(--font-primary)", fontSize: 13 }}>
                  {model.name}
                </span>
                {hasDocuments && recommendedModel === model.id && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: "var(--accent-subtle-bg)",
                      color: "var(--accent)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Recommended
                  </span>
                )}
                {model.badge && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {model.badge}
                  </span>
                )}
              </div>
              <span
                className="font-mono"
                style={{ fontSize: 10, color: "var(--text-muted)" }}
              >
                {model.inputPrice} / {model.outputPrice}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
