"use client";

import { useState } from "react";
import { PROVIDERS, type ProviderConfig, type ProviderId } from "@/lib/providers";
import { defaultConfigFor, saveProviderConfig } from "@/lib/settings";

interface Props {
  initial: ProviderConfig | null;
  onSaved: (config: ProviderConfig) => void;
  onCancel: () => void;
}

export default function Settings({ initial, onSaved, onCancel }: Props) {
  const [config, setConfig] = useState<ProviderConfig>(
    initial ?? defaultConfigFor("anthropic"),
  );
  const info = PROVIDERS.find((p) => p.id === config.id)!;

  function pick(id: ProviderId) {
    setConfig(defaultConfigFor(id));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    saveProviderConfig(config);
    onSaved(config);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/80 sm:items-center">
      <form
        onSubmit={save}
        className="w-full max-w-lg space-y-5 rounded-t-2xl bg-zinc-900 p-5 ring-1 ring-zinc-800 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Model settings</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wide text-zinc-500">Provider</label>
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <label
                key={p.id}
                className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 ring-1 transition ${
                  config.id === p.id
                    ? "bg-zinc-800 ring-zinc-600"
                    : "bg-zinc-950 ring-zinc-800 hover:ring-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  checked={config.id === p.id}
                  onChange={() => pick(p.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-100">{p.label}</div>
                  <div className="text-xs text-zinc-500">{p.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Field label="Model">
          <input
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            placeholder={info.defaultModel}
            className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
          <p className="mt-1 text-xs text-zinc-600">
            Examples: {info.modelExamples.join(", ")}
          </p>
        </Field>

        <Field label="API key">
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            placeholder={
              config.id === "anthropic"
                ? "sk-ant-..."
                : config.id === "openai"
                  ? "sk-..."
                  : "any token (or leave blank for local)"
            }
            className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
          />
          <p className="mt-1 text-xs text-zinc-600">
            Stored in your browser only. Sent as a header on each request, never persisted server-side.
          </p>
        </Field>

        {info.needsBaseURL && (
          <Field label="Base URL">
            <input
              value={config.baseURL ?? ""}
              onChange={(e) => setConfig({ ...config, baseURL: e.target.value })}
              placeholder={info.defaultBaseURL}
              className="w-full rounded-lg bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
            />
            <p className="mt-1 text-xs text-zinc-600">
              The deployed backend must be able to reach this URL. For a local Ollama / LM Studio
              server, expose it via Tailscale or a Cloudflare Tunnel and paste the public URL here.
            </p>
          </Field>
        )}

        <button
          type="submit"
          disabled={!config.model || (info.needsBaseURL && !config.baseURL)}
          className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-zinc-950 disabled:opacity-50"
        >
          Save
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-zinc-500">{label}</label>
      {children}
    </div>
  );
}
