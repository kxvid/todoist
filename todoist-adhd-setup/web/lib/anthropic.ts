import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { makeTools } from "./tools";
import type { ChatMessage, StreamEvent } from "./types";

const MODEL = "claude-sonnet-4-6";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY env var is not set");
  _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

function todoistToken(): string {
  const t = process.env.TODOIST_API_TOKEN;
  if (!t) throw new Error("TODOIST_API_TOKEN env var is not set");
  return t;
}

export async function* runChat(messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
  const tools = makeTools(todoistToken());

  try {
    const runner = client().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });

    let finalUsage: { input_tokens: number; output_tokens: number } | undefined;

    for await (const messageStream of runner) {
      const pendingTools = new Map<number, { name: string; jsonAcc: string }>();

      for await (const event of messageStream) {
        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "tool_use") {
            pendingTools.set(event.index, { name: block.name, jsonAcc: "" });
          }
        } else if (event.type === "content_block_delta") {
          if (event.delta.type === "text_delta") {
            yield { type: "text", delta: event.delta.text };
          } else if (event.delta.type === "input_json_delta") {
            const pending = pendingTools.get(event.index);
            if (pending) pending.jsonAcc += event.delta.partial_json;
          }
        } else if (event.type === "content_block_stop") {
          const pending = pendingTools.get(event.index);
          if (pending) {
            let parsed: unknown = {};
            try {
              parsed = pending.jsonAcc ? JSON.parse(pending.jsonAcc) : {};
            } catch {
              parsed = { _raw: pending.jsonAcc };
            }
            yield { type: "tool_use", name: pending.name, input: parsed };
            pendingTools.delete(event.index);
          }
        } else if (event.type === "message_delta" && event.usage) {
          finalUsage = {
            input_tokens: event.usage.input_tokens ?? 0,
            output_tokens: event.usage.output_tokens ?? 0,
          };
        }
      }
    }

    yield { type: "done", usage: finalUsage };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: "error", message };
  }
}

export async function runCapture(text: string): Promise<string> {
  const tools = makeTools(todoistToken());

  const captureSystem =
    SYSTEM_PROMPT +
    `\n\n# Quick capture mode\nThis is a one-shot quick-capture. The user fired a single thought at you. Add the task(s) immediately with sensible inferred defaults. Reply with one short confirmation line per task added. Do not ask follow-up questions.`;

  const finalMessage = await client().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 1024,
    system: [
      { type: "text", text: captureSystem, cache_control: { type: "ephemeral" } },
    ],
    tools,
    messages: [{ role: "user", content: text }],
  });

  const textBlock = finalMessage.content.find(
    (b): b is Anthropic.Beta.BetaTextBlock => b.type === "text",
  );
  return textBlock?.text ?? "Done.";
}
