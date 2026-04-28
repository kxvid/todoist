import * as t from "./todoist";
import type { ProviderConfig } from "./providers";
import { parseIntent, type ChatMessage } from "./intent";
import { executePlan, type OperationResult } from "./engine";
import type { StreamEvent } from "./types";

// ---------------------------------------------------------------------------
// The agent loop in this app does NOT delegate orchestration to the LLM.
// The LLM (any provider, any size — Gemini Flash, Claude, GPT, OSS) does
// exactly one job: parse the user's natural-language request into a
// structured Plan. The deterministic engine then executes the Plan against
// Todoist. The user always sees what was planned (each operation streams
// out as a tool_use event) and the actual result (tool_result event).
//
// This eliminates the multi-step tool-calling reliability problems that
// plague smaller models — there's no "step 2" to forget.
// ---------------------------------------------------------------------------

function todoistToken(): string {
  const tok = process.env.TODOIST_API_TOKEN;
  if (!tok) throw new Error("TODOIST_API_TOKEN env var is not set");
  return tok;
}

export async function* runChat(
  provider: ProviderConfig,
  messages: ChatMessage[],
): AsyncGenerator<StreamEvent> {
  const token = todoistToken();

  // 1. Pre-fetch the catalog. The parser sees real project + label names
  // (no LLM call to discover them; one cheap REST call.)
  let projects: t.Project[];
  let labels: t.Label[];
  try {
    [projects, labels] = await Promise.all([t.listProjects(token), t.listLabels(token)]);
  } catch (err) {
    yield {
      type: "error",
      message: `Couldn't fetch your Todoist catalog: ${err instanceof Error ? err.message : err}`,
    };
    return;
  }

  // 2. Parse intent — single LLM call. This is the only place the model
  // gets to make decisions.
  let plan;
  try {
    plan = await parseIntent(provider, messages, projects, labels);
  } catch (err) {
    yield {
      type: "error",
      message: `Couldn't parse your request: ${err instanceof Error ? err.message : err}`,
    };
    return;
  }

  if (plan.operations.length === 0) {
    yield { type: "text", delta: "(no operation produced — try rephrasing)" };
    yield { type: "done" };
    return;
  }

  // 3. Stream the plan to the UI as tool_use events so the user sees what
  // is about to happen before it does. Pure-conversational ops (chat /
  // clarify) skip the pill since they have nothing to "do".
  for (const op of plan.operations) {
    if (op.type === "chat" || op.type === "clarify") continue;
    yield { type: "tool_use", name: op.type, input: op };
  }

  // 4. Execute deterministically. The engine context is mutable so that
  // ops produced earlier in the plan (e.g. create_project) become
  // resolvable for ops later in the same plan (e.g. add_task referencing
  // the new project).
  const ctx = { projects: [...projects], labels: [...labels] };
  const results: OperationResult[] = await executePlan(token, plan, ctx);

  // 5. Surface each result. Conversational ops collapse straight into the
  // text reply — no pill clutter.
  const textParts: string[] = [];
  for (const r of results) {
    if (r.type === "chat" || r.type === "clarify") {
      textParts.push(r.summary);
      continue;
    }
    yield {
      type: "tool_result",
      name: r.type,
      output: JSON.stringify(r.detail),
      isError: !r.ok,
    };
    textParts.push(r.summary);
  }

  // 6. Render the user-facing summary line(s). Always templated, never
  // LLM-generated, so it cannot hallucinate.
  yield { type: "text", delta: textParts.join("\n\n") };
  yield { type: "done" };
}

export async function runCapture(provider: ProviderConfig, text: string): Promise<string> {
  const events: StreamEvent[] = [];
  for await (const event of runChat(provider, [{ role: "user", content: text }])) {
    events.push(event);
  }
  // For capture we only need the final text — concatenate all text deltas.
  const reply = events
    .filter((e): e is { type: "text"; delta: string } => e.type === "text")
    .map((e) => e.delta)
    .join("");
  return reply || "Done.";
}
