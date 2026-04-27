"use client";

import { useEffect, useState } from "react";
import Chat from "@/components/Chat";
import Login from "@/components/Login";
import QuickCapture from "@/components/QuickCapture";

type Mode = "chat" | "capture";

export default function Page() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("capture");

  useEffect(() => {
    const stored = localStorage.getItem("td_token");
    if (stored) setToken(stored);
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token) return <Login onAuth={setToken} />;

  function logout() {
    localStorage.removeItem("td_token");
    setToken(null);
  }

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
        <button
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 overflow-hidden">
        {mode === "chat" ? (
          <Chat token={token} />
        ) : (
          <div className="mx-auto max-w-xl p-4">
            <QuickCapture token={token} />
          </div>
        )}
      </main>
    </div>
  );
}
