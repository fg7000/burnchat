"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
            inputPrice: m.input_price
              ? `$${m.input_price}/M`
              : "$0.00/M",
            outputPrice: m.output_price
              ? `$${m.output_price}/M`
              : "$0.00/M",
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

  // Determine the recommended model when documents are loaded
  useEffect(() => {
    if (hasDocuments) {
      const totalTokens = documents.reduce((sum, d) => sum + d.tokenCount, 0);
      // Simple heuristic: recommend cheaper models for smaller documents
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
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-sm text-gray-300 hover:text-gray-100"
        >
          <Sparkles className="h-3.5 w-3.5 text-teal-400" />
          <span className="max-w-[140px] truncate">{selectedModelName}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {/* Auto option */}
        <DropdownMenuItem
          onClick={() => setSelectedModel(null)}
          className={cn(
            "flex items-center gap-2 py-2",
            !selectedModel && "bg-gray-800 text-teal-400"
          )}
        >
          <Star className="h-4 w-4 text-yellow-500" />
          <div className="flex flex-1 items-center justify-between">
            <span className="font-medium">Auto (Recommended)</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Model list */}
        {models.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => setSelectedModel(model.id)}
            className={cn(
              "flex items-center gap-2 py-2",
              selectedModel === model.id && "bg-gray-800 text-teal-400"
            )}
          >
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{model.name}</span>
                {hasDocuments && recommendedModel === model.id && (
                  <span className="rounded bg-teal-900/50 px-1.5 py-0.5 text-[10px] font-medium text-teal-400">
                    Recommended
                  </span>
                )}
                {model.badge && (
                  <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
                    {model.badge}
                  </span>
                )}
              </div>
              <span className="ml-2 text-[11px] text-gray-500">
                {model.inputPrice} in / {model.outputPrice} out
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
