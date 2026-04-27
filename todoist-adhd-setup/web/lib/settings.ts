"use client";

import { PROVIDERS, type ProviderConfig, type ProviderId } from "./providers";

const STORAGE_KEY = "td_provider_config";

export function loadProviderConfig(): ProviderConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProviderConfig;
    if (!PROVIDERS.some((p) => p.id === parsed.id)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProviderConfig(config: ProviderConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearProviderConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function defaultConfigFor(id: ProviderId): ProviderConfig {
  const info = PROVIDERS.find((p) => p.id === id)!;
  return {
    id,
    apiKey: "",
    model: info.defaultModel,
    baseURL: info.defaultBaseURL,
  };
}
