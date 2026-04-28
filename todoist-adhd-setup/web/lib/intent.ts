import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ProviderConfig } from "./providers";
import type { Project, Label } from "./todoist";

// ---------------------------------------------------------------------------
// Operation schema — a discriminated union of every action the engine knows
// how to execute. The LLM's only job is to translate the user's natural
// language into a list of these. The engine handles all sequencing, lookups,
// and error handling deterministically.
//
// Conventions:
// - Use `nullable()` instead of `optional()` so providers that strip
//   undefined-vs-missing distinctions (Gemini in particular) still produce
//   valid JSON.
// - `project_hint` and similar fuzzy-match fields are resolved to IDs by the
//   engine — the LLM never needs to know the actual UUIDs.
// ---------------------------------------------------------------------------

export const OperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add_task"),
    content: z.string().describe("Task title"),
    project_hint: z
      .string()
      .nullable()
      .describe(
        "Project name like 'Personal' or path 'Personal/Health'. Null routes to Inbox.",
      ),
    labels: z
      .array(z.string())
      .describe("Label names without @ prefix, like ['deep','home']. Empty array if none."),
    priority: z
      .number()
      .int()
      .min(1)
      .max(4)
      .describe("1=normal (default), 2=medium, 3=high, 4=urgent"),
    due_string: z
      .string()
      .nullable()
      .describe(
        "Natural-language due like 'tomorrow', 'every monday', 'every weekday at 7am'. Null if no due date.",
      ),
    description: z.string().nullable().describe("Longer notes/details. Null if none."),
  }),
  z.object({
    type: z.literal("update_task"),
    task_query: z
      .string()
      .describe("Substring or phrase that matches the existing task title (case-insensitive)"),
    content: z.string().nullable(),
    labels: z.array(z.string()).nullable(),
    priority: z.number().int().min(1).max(4).nullable(),
    due_string: z.string().nullable(),
  }),
  z.object({
    type: z.literal("complete_task"),
    task_query: z.string(),
  }),
  z.object({
    type: z.literal("delete_task"),
    task_query: z.string(),
  }),
  z.object({
    type: z.literal("move_task"),
    task_query: z.string(),
    project_hint: z.string(),
  }),
  z.object({
    type: z.literal("list_tasks"),
    filter: z
      .string()
      .nullable()
      .describe("Todoist filter expression like 'today', 'overdue', '@deep & 7 days'"),
    project_hint: z.string().nullable(),
  }),
  z.object({
    type: z.literal("list_projects"),
  }),
  z.object({
    type: z.literal("create_project"),
    name: z.string(),
    parent_hint: z.string().nullable(),
    color: z.string().nullable(),
  }),
  z.object({
    type: z.literal("create_label"),
    name: z.string(),
    color: z.string().nullable(),
  }),
  z.object({
    type: z.literal("clarify"),
    question: z
      .string()
      .describe(
        "Ask the user for missing info. Only use when the request is genuinely ambiguous — default to action with sensible inferred defaults.",
      ),
  }),
  z.object({
    type: z.literal("chat"),
    text: z
      .string()
      .describe(
        "Plain conversational reply when no Todoist action is needed (greetings, meta-questions, etc.)",
      ),
  }),
]);

export type Operation = z.infer<typeof OperationSchema>;

export const PlanSchema = z.object({
  operations: z
    .array(OperationSchema)
    .describe("One or more operations to execute, in order."),
});

export type Plan = z.infer<typeof PlanSchema>;

// ---------------------------------------------------------------------------
// Parse a user request (with chat history + current Todoist catalog) into a
// Plan. This is the only LLM call in the agent loop — small models can do it
// reliably because it's a single structured-output task, not multi-step
// orchestration.
// ---------------------------------------------------------------------------

const PARSE_SYSTEM = `You are a parser. Translate the user's request into a structured Plan of operations.

You DO NOT execute anything. You DO NOT narrate as if anything happened. Your only job is to produce the Plan — the engine will execute it.

# The user's Todoist setup

Three life domains as parent projects:
- **Airborne** (work) — sub-projects: Helpdesk, Infrastructure, Compliance, Documentation
- **Business** — sub-projects: MAHAKALA, MeasureJoy, Career
- **Personal** — sub-projects: Health, Finance, Learning

(The actual catalog is provided below — use the names you see there. If a project doesn't exist, use create_project before referencing it, or pick the closest existing one.)

Labels (no @ prefix in the operation):
- Location: office, home, anywhere
- Energy: deep, shallow, quick
- Status: waiting, followup

Priority: 1=normal, 2=medium, 3=high, 4=urgent.

# Inferring defaults aggressively

When the user doesn't specify, infer:
- "Read article" → labels=['shallow']
- "Write report", "design system", "review docs" → labels=['deep']
- "Pay bill", "schedule X", "send email" → labels=['quick']
- "Call vendor", "wait on response" → labels=['waiting']
- Work-sounding tasks → Airborne sub-project that fits, default to Inbox if unclear
- Health/fitness/sleep → Personal/Health
- Money → Personal/Finance
- Studying/courses → Personal/Learning

# Decomposition

A single user message often becomes multiple operations. Examples:
- "add task X to Personal/Health and another to Personal/Finance" → 2 add_task operations
- "move all my deep work from this week to next week" → list_tasks then update_task per result (note: for now produce list_tasks; the engine will surface them)
- "what's on my plate today?" → 1 list_tasks with filter='today'
- "plan my week with these 5 things" → 5 add_task operations

# When in doubt

- Genuinely ambiguous → emit a clarify operation. But err on the side of action.
- Just chatting (no Todoist action) → emit a chat operation with the reply text.
- Multiple things in one message → emit multiple operations in order.

NEVER produce a plan with zero operations. If nothing else fits, use chat.`;

function buildCatalog(projects: Project[], labels: Label[]): string {
  const projById = new Map(projects.map((p) => [p.id, p]));
  const lines: string[] = ["# Current Todoist catalog", "", "## Projects"];
  const roots = projects.filter((p) => !p.parent_id);
  for (const root of roots) {
    lines.push(`- ${root.name}`);
    const children = projects.filter((p) => p.parent_id === root.id);
    for (const child of children) {
      lines.push(`  - ${root.name}/${child.name}`);
      const grandchildren = projects.filter((p) => p.parent_id === child.id);
      for (const gc of grandchildren) {
        lines.push(`    - ${root.name}/${child.name}/${gc.name}`);
      }
    }
  }
  // Orphans (parent not in list)
  for (const p of projects) {
    if (p.parent_id && !projById.has(p.parent_id)) {
      lines.push(`- ${p.name}`);
    }
  }
  lines.push("", "## Labels");
  if (labels.length === 0) lines.push("(none)");
  else lines.push(labels.map((l) => l.name).join(", "));
  return lines.join("\n");
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function parseIntent(
  provider: ProviderConfig,
  messages: ChatMessage[],
  projects: Project[],
  labels: Label[],
): Promise<Plan> {
  const catalog = buildCatalog(projects, labels);
  const systemWithCatalog = `${PARSE_SYSTEM}\n\n${catalog}`;

  const result = await generateObject({
    model: getModel(provider),
    schema: PlanSchema,
    schemaName: "TodoistPlan",
    schemaDescription:
      "A list of Todoist operations to execute, parsed from the user's request.",
    system: systemWithCatalog,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  return result.object;
}
