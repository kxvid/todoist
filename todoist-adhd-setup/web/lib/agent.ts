import { streamText, generateText } from "ai";
import { SYSTEM_PROMPT } from "./systemPrompt";
import { makeTools } from "./tools";
import { getModel, type ProviderConfig } from "./providers";
import type { ChatMessage, StreamEvent } from "./types";

const MAX_STEPS = 8;

function todoistToken(): string {
  const tok = process.env.TODOIST_API_TOKEN;
  if (!tok) throw new Error("TODOIST_API_TOKEN env var is not set");
  return tok;
}

export async function* runChat(
  provider: ProviderConfig,
  messages: ChatMessage[],
): AsyncGenerator<StreamEvent> {
  try {
    const tools = makeTools(todoistToken());

    const result = streamText({
      model: getModel(provider),
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools,
      maxSteps: MAX_STEPS,
    });

    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta":
          yield { type: "text", delta: part.textDelta };
          break;
        case "tool-call":
          yield { type: "tool_use", name: part.toolName, input: part.args };
          break;
        case "tool-result":
          yield {
            type: "tool_result",
            name: part.toolName,
            output:
              typeof part.result === "string" ? part.result : JSON.stringify(part.result),
            isError: false,
          };
          break;
        case "error": {
          const err = part.error;
          const message = err instanceof Error ? err.message : String(err);
          yield { type: "error", message };
          return;
        }
        case "finish":
          inputTokens = part.usage?.promptTokens;
          outputTokens = part.usage?.completionTokens;
          break;
      }
    }

    yield {
      type: "done",
      usage:
        inputTokens != null && outputTokens != null
          ? { input_tokens: inputTokens, output_tokens: outputTokens }
          : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: "error", message };
  }
}

export async function runCapture(
  provider: ProviderConfig,
  text: string,
): Promise<string> {
  const tools = makeTools(todoistToken());

  const captureSystem =
    SYSTEM_PROMPT +
    `\n\n# Quick capture mode\nThis is a one-shot quick-capture. The user fired a single thought at you. Add the task(s) immediately with sensible inferred defaults. Reply with one short confirmation line per task added. Do not ask follow-up questions.`;

  const result = await generateText({
    model: getModel(provider),
    system: captureSystem,
    messages: [{ role: "user", content: text }],
    tools,
    maxSteps: MAX_STEPS,
  });

  return result.text || "Done.";
}
