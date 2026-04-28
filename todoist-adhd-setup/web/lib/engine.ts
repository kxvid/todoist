import * as t from "./todoist";
import type { Operation, Plan } from "./intent";

// ---------------------------------------------------------------------------
// Pure execution layer. Takes a Plan from the LLM and runs each operation
// against the Todoist API. No model calls. All sequencing, project/task
// resolution, and error handling is deterministic.
// ---------------------------------------------------------------------------

export interface OperationResult {
  type: Operation["type"];
  ok: boolean;
  /** Render-friendly summary line for the chat UI. */
  summary: string;
  /** Raw structured detail — shown in the expandable tool pill. */
  detail: Record<string, unknown>;
  error?: string;
}

export interface ExecutionContext {
  projects: t.Project[];
  labels: t.Label[];
}

// Walk a slash-separated project path ("Personal" or "Personal/Health")
// against the catalog. Case-insensitive, prefers exact name match at each
// level, falls back to substring match. Returns undefined if any segment
// fails to match.
export function resolveProject(
  projects: t.Project[],
  hint: string | null,
): { id: string; displayPath: string } | null {
  if (!hint) return null;
  const segments = hint
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return null;

  let parentId: string | null = null;
  let resolvedId: string | undefined;
  const displaySegments: string[] = [];

  for (const segment of segments) {
    const lc = segment.toLowerCase();
    const candidates = projects.filter(
      (p) => (p.parent_id ?? null) === parentId,
    );
    const exact = candidates.find((p) => p.name.toLowerCase() === lc);
    const substring = candidates.find((p) => p.name.toLowerCase().includes(lc));
    const chosen = exact ?? substring;
    if (!chosen) return null;
    resolvedId = chosen.id;
    parentId = chosen.id;
    displaySegments.push(chosen.name);
  }

  return resolvedId ? { id: resolvedId, displayPath: displaySegments.join("/") } : null;
}

// Resolve a task by user-provided phrase. Hits the API to search across the
// user's tasks (or within a project hint) and returns matches.
async function findTasks(
  token: string,
  query: string,
  ctx: ExecutionContext,
  projectHint?: string | null,
): Promise<t.Task[]> {
  const project = projectHint ? resolveProject(ctx.projects, projectHint) : null;
  const all = await t.listTasks(token, undefined, project?.id);
  const lc = query.toLowerCase();
  return all.filter((task) => task.content.toLowerCase().includes(lc));
}

async function executeOne(
  token: string,
  op: Operation,
  ctx: ExecutionContext,
): Promise<OperationResult> {
  switch (op.type) {
    case "add_task": {
      try {
        const project = resolveProject(ctx.projects, op.project_hint);
        const projectMissing = op.project_hint && !project;
        const task = await t.createTask(token, {
          content: op.content,
          project_id: project?.id,
          labels: op.labels.length ? op.labels : undefined,
          priority: op.priority as 1 | 2 | 3 | 4,
          due_string: op.due_string ?? undefined,
          description: op.description ?? undefined,
        });
        const where = project ? project.displayPath : "Inbox";
        const due = op.due_string ? `, due ${op.due_string}` : "";
        const labelStr = op.labels.length ? `, @${op.labels.join(" @")}` : "";
        const noteIfMissing = projectMissing
          ? ` (couldn't find project '${op.project_hint}', added to Inbox)`
          : "";
        return {
          type: "add_task",
          ok: true,
          summary: `✅ Added '${task.content}' to ${where}${due}${labelStr}${noteIfMissing}`,
          detail: { id: task.id, project_id: task.project_id, url: task.url, sent: op },
        };
      } catch (err) {
        return failure("add_task", op, err);
      }
    }

    case "update_task": {
      try {
        const matches = await findTasks(token, op.task_query, ctx);
        if (matches.length === 0) {
          return {
            type: "update_task",
            ok: false,
            summary: `❌ No task found matching '${op.task_query}'`,
            detail: { sent: op },
            error: "no match",
          };
        }
        if (matches.length > 1) {
          return {
            type: "update_task",
            ok: false,
            summary: `❓ Multiple tasks match '${op.task_query}': ${matches
              .slice(0, 5)
              .map((t) => `'${t.content}'`)
              .join(", ")}. Be more specific.`,
            detail: { matches: matches.map((t) => ({ id: t.id, content: t.content })), sent: op },
            error: "ambiguous",
          };
        }
        const task = matches[0];
        const update: t.UpdateTaskInput = {};
        if (op.content !== null) update.content = op.content;
        if (op.labels !== null) update.labels = op.labels;
        if (op.priority !== null) update.priority = op.priority as 1 | 2 | 3 | 4;
        if (op.due_string !== null) update.due_string = op.due_string;
        const updated = await t.updateTask(token, task.id, update);
        return {
          type: "update_task",
          ok: true,
          summary: `✅ Updated '${updated.content}'`,
          detail: { id: task.id, applied: update },
        };
      } catch (err) {
        return failure("update_task", op, err);
      }
    }

    case "complete_task": {
      try {
        const matches = await findTasks(token, op.task_query, ctx);
        if (matches.length === 0) {
          return {
            type: "complete_task",
            ok: false,
            summary: `❌ No task found matching '${op.task_query}'`,
            detail: { sent: op },
            error: "no match",
          };
        }
        if (matches.length > 1) {
          return {
            type: "complete_task",
            ok: false,
            summary: `❓ Multiple tasks match '${op.task_query}'. Be more specific.`,
            detail: { matches: matches.map((t) => t.content), sent: op },
            error: "ambiguous",
          };
        }
        await t.completeTask(token, matches[0].id);
        return {
          type: "complete_task",
          ok: true,
          summary: `✅ Completed '${matches[0].content}'`,
          detail: { id: matches[0].id },
        };
      } catch (err) {
        return failure("complete_task", op, err);
      }
    }

    case "delete_task": {
      try {
        const matches = await findTasks(token, op.task_query, ctx);
        if (matches.length === 0) {
          return {
            type: "delete_task",
            ok: false,
            summary: `❌ No task found matching '${op.task_query}'`,
            detail: { sent: op },
            error: "no match",
          };
        }
        if (matches.length > 1) {
          return {
            type: "delete_task",
            ok: false,
            summary: `❓ Multiple tasks match '${op.task_query}'. Be more specific.`,
            detail: { matches: matches.map((t) => t.content), sent: op },
            error: "ambiguous",
          };
        }
        await t.deleteTask(token, matches[0].id);
        return {
          type: "delete_task",
          ok: true,
          summary: `🗑️ Deleted '${matches[0].content}'`,
          detail: { id: matches[0].id },
        };
      } catch (err) {
        return failure("delete_task", op, err);
      }
    }

    case "move_task": {
      try {
        const project = resolveProject(ctx.projects, op.project_hint);
        if (!project) {
          return {
            type: "move_task",
            ok: false,
            summary: `❌ Project '${op.project_hint}' not found`,
            detail: { sent: op },
            error: "no project",
          };
        }
        const matches = await findTasks(token, op.task_query, ctx);
        if (matches.length === 0) {
          return {
            type: "move_task",
            ok: false,
            summary: `❌ No task found matching '${op.task_query}'`,
            detail: { sent: op },
            error: "no match",
          };
        }
        if (matches.length > 1) {
          return {
            type: "move_task",
            ok: false,
            summary: `❓ Multiple tasks match '${op.task_query}'. Be more specific.`,
            detail: { matches: matches.map((t) => t.content), sent: op },
            error: "ambiguous",
          };
        }
        await t.moveTask(token, matches[0].id, project.id);
        return {
          type: "move_task",
          ok: true,
          summary: `✅ Moved '${matches[0].content}' to ${project.displayPath}`,
          detail: { id: matches[0].id, project_id: project.id },
        };
      } catch (err) {
        return failure("move_task", op, err);
      }
    }

    case "list_tasks": {
      try {
        const project = op.project_hint ? resolveProject(ctx.projects, op.project_hint) : null;
        const tasks = await t.listTasks(token, op.filter ?? undefined, project?.id);
        const lines = tasks.slice(0, 25).map((task) => {
          const due = task.due?.string ? ` — ${task.due.string}` : "";
          const labels = task.labels.length ? ` @${task.labels.join(" @")}` : "";
          return `• ${task.content}${due}${labels}`;
        });
        const summary =
          tasks.length === 0
            ? `(no tasks match)`
            : `Found ${tasks.length} task${tasks.length === 1 ? "" : "s"}:\n${lines.join(
                "\n",
              )}${tasks.length > 25 ? `\n…and ${tasks.length - 25} more` : ""}`;
        return {
          type: "list_tasks",
          ok: true,
          summary,
          detail: { count: tasks.length, ids: tasks.map((t) => t.id) },
        };
      } catch (err) {
        return failure("list_tasks", op, err);
      }
    }

    case "list_projects": {
      const lines = ctx.projects.map((p) => {
        const parent = p.parent_id ? ctx.projects.find((q) => q.id === p.parent_id) : null;
        return parent ? `• ${parent.name}/${p.name}` : `• ${p.name}`;
      });
      return {
        type: "list_projects",
        ok: true,
        summary: `Projects:\n${lines.join("\n")}`,
        detail: { count: ctx.projects.length },
      };
    }

    case "create_project": {
      try {
        const parent = resolveProject(ctx.projects, op.parent_hint);
        const project = await t.createProject(token, {
          name: op.name,
          parent_id: parent?.id,
          color: op.color ?? undefined,
        });
        const where = parent ? `under ${parent.displayPath}` : "(top-level)";
        // Mutate context so subsequent ops in the same plan can resolve it
        ctx.projects.push(project);
        return {
          type: "create_project",
          ok: true,
          summary: `✅ Created project '${project.name}' ${where}`,
          detail: { id: project.id },
        };
      } catch (err) {
        return failure("create_project", op, err);
      }
    }

    case "create_label": {
      try {
        const label = await t.createLabel(token, {
          name: op.name,
          color: op.color ?? undefined,
        });
        ctx.labels.push(label);
        return {
          type: "create_label",
          ok: true,
          summary: `✅ Created label @${label.name}`,
          detail: { id: label.id },
        };
      } catch (err) {
        return failure("create_label", op, err);
      }
    }

    case "clarify": {
      return {
        type: "clarify",
        ok: true,
        summary: op.question,
        detail: { question: op.question },
      };
    }

    case "chat": {
      return {
        type: "chat",
        ok: true,
        summary: op.text,
        detail: { text: op.text },
      };
    }
  }
}

function failure(type: Operation["type"], op: unknown, err: unknown): OperationResult {
  const message = err instanceof Error ? err.message : String(err);
  return {
    type,
    ok: false,
    summary: `❌ ${type}: ${message}`,
    detail: { sent: op },
    error: message,
  };
}

export async function executePlan(
  token: string,
  plan: Plan,
  ctx: ExecutionContext,
): Promise<OperationResult[]> {
  const results: OperationResult[] = [];
  for (const op of plan.operations) {
    results.push(await executeOne(token, op, ctx));
  }
  return results;
}
