"use client";

import { useState } from "react";

interface Props {
  token: string;
}

export default function QuickCapture({ token }: Props) {
  const [text, setText] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { reply: r } = (await res.json()) as { reply: string };
      setReply(r);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Brain dump… 'pay rent friday' / 'plan workouts for next week' / 'call mom'"
        rows={3}
        className="w-full resize-none rounded-lg bg-zinc-900 px-4 py-3 text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-zinc-950 disabled:opacity-50"
      >
        {loading ? "Capturing…" : "⚡ Quick capture"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {reply && (
        <div className="rounded-lg bg-zinc-900 p-3 text-sm text-zinc-300 ring-1 ring-zinc-800 whitespace-pre-wrap">
          {reply}
        </div>
      )}
    </form>
  );
}
