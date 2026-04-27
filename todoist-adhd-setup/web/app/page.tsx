"use client";

import { useEffect, useState } from "react";
import Chat from "@/components/Chat";
import Login from "@/components/Login";
import QuickCapture from "@/components/QuickCapture";
import Settings from "@/components/Settings";
import type { ProviderConfig } from "@/lib/providers";
import { loadProviderConfig } from "@/lib/settings";

type Mode = "chat" | "capture";

export default function Page() {
  const [token, setToken] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("capture");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("td_token");
    if (stored) setToken(stored);
    setProvider(loadProviderConfig());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token) return <Login onAuth={setToken} />;

  function logout() {
    localStorage.removeItem("td_token");
    setToken(null);
  }

  // Force settings open on first run after login
  const mustConfigure = !provider;

  return (
    <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex gap-1 rounded-lg bg-zinc-900 p-1 ring-1 ring-zinc-800">
          <button
            onClick={() => setMode("capture")}
            className={`rounded-md px-3 py-1 text-sm ${
              mode === "capture" ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"
            }`}
          >
            ⚡ Capture
          </button>
          <button
            onClick={() => setMode("chat")}
            className={`rounded-md px-3 py-1 text-sm ${
              mode === "chat" ? "bg-zinc-100 text-zinc-950" : "text-zinc-400"
            }`}
          >
            💬 Chat
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="text-xs text-zinc-400 hover:text-zinc-200"
            title={provider ? `${provider.id} · ${provider.model}` : "Configure model"}
          >
            ⚙️ {provider ? provider.model : "Configure"}
          </button>
          <button onClick={logout} className="text-xs text-zinc-500 hover:text-zinc-300">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {!provider ? (
          <div className="mx-auto max-w-md p-6 text-center text-sm text-zinc-400">
            Pick a model provider and paste your API key to get started.
          </div>
        ) : mode === "chat" ? (
          <Chat token={token} provider={provider} />
        ) : (
          <div className="mx-auto max-w-xl p-4">
            <QuickCapture token={token} provider={provider} />
          </div>
        )}
      </main>
      {(showSettings || mustConfigure) && (
        <Settings
          initial={provider}
          onSaved={(c) => {
            setProvider(c);
            setShowSettings(false);
          }}
          onCancel={() => {
            if (provider) setShowSettings(false);
          }}
        />
      )}
    </div>
  );
}
