"use client";

import { useState } from "react";

interface Props {
  onAuth: (token: string) => void;
}

export default function Login({ onAuth }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { token } = (await res.json()) as { token: string };
      localStorage.setItem("td_token", token);
      onAuth(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="space-y-1 text-center">
          <div className="text-3xl">🧠</div>
          <h1 className="text-xl font-semibold text-zinc-100">Todoist Co-pilot</h1>
          <p className="text-sm text-zinc-500">Sign in to continue.</p>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-lg bg-zinc-100 px-4 py-3 font-medium text-zinc-950 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
