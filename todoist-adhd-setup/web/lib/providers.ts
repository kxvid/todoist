import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ProviderId = "anthropic" | "openai" | "openai-compatible";

export interface ProviderConfig {
  id: ProviderId;
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  defaultModel: string;
  needsBaseURL: boolean;
  defaultBaseURL?: string;
  modelExamples: string[];
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude Opus / Sonnet / Haiku via the official API.",
    defaultModel: "claude-sonnet-4-5",
    needsBaseURL: false,
    modelExamples: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-5-haiku-latest"],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT-4o, o1, o3, etc. via api.openai.com.",
    defaultModel: "gpt-4o",
    needsBaseURL: false,
    modelExamples: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible (local / OSS)",
    description:
      "Any server that speaks the OpenAI API: Ollama, LM Studio, vLLM, llama.cpp, Groq, Together, Mistral, etc. Local servers must be reachable from the deployed backend — use Tailscale or a Cloudflare Tunnel to expose localhost.",
    defaultModel: "gemma2:9b",
    needsBaseURL: true,
    defaultBaseURL: "http://localhost:11434/v1",
    modelExamples: [
      "gemma2:9b (Ollama)",
      "llama3.1:70b (Ollama)",
      "llama-3.3-70b-versatile (Groq)",
      "mistralai/Mixtral-8x7B-Instruct-v0.1 (Together)",
    ],
  },
];

export function getModel(config: ProviderConfig): LanguageModel {
  const apiKey = config.apiKey.trim();
  const model = config.model.trim();
  if (!model) throw new Error("Model name is required");

  switch (config.id) {
    case "anthropic": {
      if (!apiKey) throw new Error("Anthropic API key is required");
      return createAnthropic({ apiKey })(model);
    }
    case "openai": {
      if (!apiKey) throw new Error("OpenAI API key is required");
      return createOpenAI({ apiKey, compatibility: "strict" })(model);
    }
    case "openai-compatible": {
      const baseURL = config.baseURL?.trim();
      if (!baseURL) throw new Error("Base URL is required for OpenAI-compatible providers");
      return createOpenAI({
        apiKey: apiKey || "ollama",
        baseURL,
        compatibility: "compatible",
      })(model);
    }
  }
}

const PROVIDER_HEADER = "x-model-provider";
const KEY_HEADER = "x-model-key";
const MODEL_HEADER = "x-model-name";
const BASE_URL_HEADER = "x-model-base-url";

export function readProviderFromHeaders(headers: Headers): ProviderConfig {
  const id = headers.get(PROVIDER_HEADER) as ProviderId | null;
  const apiKey = headers.get(KEY_HEADER) ?? "";
  const model = headers.get(MODEL_HEADER) ?? "";
  const baseURL = headers.get(BASE_URL_HEADER) ?? undefined;

  if (!id || !PROVIDERS.some((p) => p.id === id)) {
    throw new Error(`Invalid or missing provider header (${PROVIDER_HEADER})`);
  }
  return { id, apiKey, model, baseURL };
}

export function buildProviderHeaders(config: ProviderConfig): Record<string, string> {
  const out: Record<string, string> = {
    [PROVIDER_HEADER]: config.id,
    [MODEL_HEADER]: config.model,
  };
  if (config.apiKey) out[KEY_HEADER] = config.apiKey;
  if (config.baseURL) out[BASE_URL_HEADER] = config.baseURL;
  return out;
}
