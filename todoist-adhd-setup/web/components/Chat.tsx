"use client";

import { useEffect, useRef, useState } from "react";
import { buildProviderHeaders, type ProviderConfig } from "@/lib/providers";
import type { ChatMessage, StreamEvent } from "@/lib/types";

interface ToolEvent {
  name: string;
  input: unknown;
  result?: string;
  isError?: boolean;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  tools?: ToolEvent[];
}

interface Props {
  token: string;
  provider: ProviderConfig;
}

export default function Chat({ token, provider }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || streaming) return;
    setError(null);

    const userTurn: Turn = { role: "user", content: input };
    const history = [...turns, userTurn];
    const apiMessages: ChatMessage[] = history.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    setTurns([...history, { role: "assistant", content: "", tools: [] }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...buildProviderHeaders(provider),
        },
        body: JSON.stringify({ messages: apiMessages }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const raw of events) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(json) as StreamEvent;
          } catch {
            continue;
          }
          setTurns((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") return prev;
            if (event.type === "text") {
              next[next.length - 1] = { ...last, content: last.content + event.delta };
            } else if (event.type === "tool_use") {
              next[next.length - 1] = {
                ...last,
                tools: [...(last.tools ?? []), { name: event.name, input: event.input }],
              };
            } else if (event.type === "tool_result") {
              const tools = [...(last.tools ?? [])];
              for (let i = tools.length - 1; i >= 0; i--) {
                if (tools[i].name === event.name && tools[i].result === undefined) {
                  tools[i] = { ...tools[i], result: event.output, isError: event.isError };
                  break;
                }
              }
              next[next.length - 1] = { ...last, tools };
            } else if (event.type === "error") {
              setError(event.message);
            }
            return next;
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="mt-8 text-center text-sm text-zinc-500">
            Tell me what to add, change, or organize.
            <div className="mt-2 text-xs text-zinc-600">
              Try: <em>"add 'review CMMC docs' to Compliance for Friday, deep work"</em>
            </div>
          </div>
        )}
        {turns.map((turn, i) => (
          <Bubble key={i} turn={turn} />
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
      <form onSubmit={send} className="border-t border-zinc-800 bg-zinc-950 p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a request…"
            disabled={streaming}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-zinc-100 outline-none ring-1 ring-zinc-800 focus:ring-zinc-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-zinc-100 px-4 py-3 font-medium text-zinc-950 disabled:opacity-50"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-100 px-4 py-2 text-sm text-zinc-950">
          {turn.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        {turn.tools && turn.tools.length > 0 && (
          <div className="space-y-1">
            {turn.tools.map((tool, i) => (
              <ToolPill key={i} tool={tool} />
            ))}
          </div>
        )}
        {turn.content && (
          <div className="rounded-2xl rounded-bl-sm bg-zinc-900 px-4 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 whitespace-pre-wrap">
            {turn.content}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolPill({ tool }: { tool: ToolEvent }) {
  const status = tool.result === undefined ? "running" : tool.isError ? "error" : "ok";
  const ringColor =
    status === "error"
      ? "ring-red-900"
      : status === "ok"
        ? "ring-emerald-900"
        : "ring-zinc-800";
  const icon = status === "error" ? "❌" : status === "ok" ? "✅" : "⚙️";
  const args = formatJSON(tool.input);
  const result = tool.result ?? (status === "running" ? "running…" : "");
  return (
    <details className={`rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400 ring-1 ${ringColor}`}>
      <summary className="cursor-pointer list-none">
        <span>{icon} </span>
        <span className="font-medium text-zinc-300">{tool.name}</span>
        <span className="ml-2 text-zinc-600">(tap for details)</span>
      </summary>
      <div className="mt-2 space-y-2 border-t border-zinc-800 pt-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Args</div>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-zinc-400">
            {args}
          </pre>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Result</div>
          <pre
            className={`mt-1 overflow-x-auto whitespace-pre-wrap break-all ${
              status === "error" ? "text-red-400" : "text-zinc-400"
            }`}
          >
            {result}
          </pre>
        </div>
      </div>
    </details>
  );
}

function formatJSON(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
