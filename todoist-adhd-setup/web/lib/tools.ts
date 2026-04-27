import { tool } from "ai";
import { z } from "zod";
import * as t from "./todoist";

export function makeTools(token: string) {
  return {
    list_projects: tool({
      description:
        "List all Todoist projects with their IDs, names, and parent IDs. Call this first when you need to find a project_id to add tasks to.",
      parameters: z.object({}),
      execute: async () => {
        const projects = await t.listProjects(token);
        return projects.map((p) => ({ id: p.id, name: p.name, parent_id: p.parent_id }));
      },
    }),

    list_labels: tool({
      description: "List all available Todoist labels.",
      parameters: z.object({}),
      execute: async () => {
        const labels = await t.listLabels(token);
        return labels.map((l) => l.name);
      },
    }),

    list_tasks: tool({
      description:
        "List tasks. Optionally filter by Todoist filter query (e.g. 'today', 'overdue', '@quick', '##Personal') or project_id. Returns up to ~100 tasks.",
      parameters: z.object({
        filter: z
          .string()
          .optional()
          .describe("Todoist filter query like 'today', 'overdue', '@deep', '##Airborne'"),
        project_id: z.string().optional().describe("Project ID to filter by"),
      }),
      execute: async ({ filter, project_id }) => {
        const tasks = await t.listTasks(token, filter, project_id);
        return tasks.map((task) => ({
          id: task.id,
          content: task.content,
          project_id: task.project_id,
          labels: task.labels,
          priority: task.priority,
          due: task.due?.string ?? null,
          url: task.url,
        }));
      },
    }),

    add_task: tool({
      description:
        "Create a new Todoist task. Priority: 1=normal, 2=medium, 3=high, 4=urgent. due_string accepts natural language like 'today', 'tomorrow at 3pm', 'every weekday', 'next monday'.",
      parameters: z.object({
        content: z.string().describe("Task title"),
        description: z.string().optional().describe("Longer notes/details"),
        project_id: z
          .string()
          .optional()
          .describe("Project ID. Omit for Inbox. Use list_projects to find IDs."),
        labels: z
          .array(z.string())
          .optional()
          .describe("Label names like 'deep', 'quick', 'home'"),
        priority: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("1=normal, 2=medium, 3=high, 4=urgent"),
        due_string: z.string().optional().describe("Natural-language due date"),
      }),
      execute: async (input) => {
        const task = await t.createTask(token, input as t.CreateTaskInput);
        return { id: task.id, content: task.content, url: task.url };
      },
    }),

    update_task: tool({
      description: "Update an existing task's content, labels, priority, or due date.",
      parameters: z.object({
        id: z.string(),
        content: z.string().optional(),
        description: z.string().optional(),
        labels: z.array(z.string()).optional(),
        priority: z.number().int().min(1).max(4).optional(),
        due_string: z.string().optional(),
      }),
      execute: async ({ id, ...rest }) => {
        const task = await t.updateTask(token, id, rest as t.UpdateTaskInput);
        return { id: task.id, content: task.content };
      },
    }),

    complete_task: tool({
      description:
        "Mark a task as completed. The user usually does this themselves in Todoist — only call when explicitly asked.",
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        await t.completeTask(token, id);
        return `Completed task ${id}`;
      },
    }),

    delete_task: tool({
      description: "Permanently delete a task. Confirm with the user before calling.",
      parameters: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        await t.deleteTask(token, id);
        return `Deleted task ${id}`;
      },
    }),

    move_task: tool({
      description: "Move a task to a different project.",
      parameters: z.object({ id: z.string(), project_id: z.string() }),
      execute: async ({ id, project_id }) => {
        const task = await t.moveTask(token, id, project_id);
        return { id: task.id, project_id: task.project_id };
      },
    }),

    create_project: tool({
      description: "Create a new Todoist project. Optionally nested under a parent project.",
      parameters: z.object({
        name: z.string(),
        parent_id: z.string().optional(),
        color: z.string().optional().describe("Color name e.g. red, grape, green, blue"),
        is_favorite: z.boolean().optional(),
      }),
      execute: async (input) => {
        const project = await t.createProject(token, input as t.CreateProjectInput);
        return { id: project.id, name: project.name };
      },
    }),

    create_label: tool({
      description: "Create a new label.",
      parameters: z.object({
        name: z.string(),
        color: z.string().optional(),
      }),
      execute: async (input) => {
        const label = await t.createLabel(token, input as t.CreateLabelInput);
        return { id: label.id, name: label.name };
      },
    }),

    bulk_add_tasks: tool({
      description:
        "Add multiple tasks in one call. Use when the user asks to plan a week, batch-create tasks from a list, or seed a project. Each task uses the same fields as add_task.",
      parameters: z.object({
        tasks: z.array(
          z.object({
            content: z.string(),
            description: z.string().optional(),
            project_id: z.string().optional(),
            labels: z.array(z.string()).optional(),
            priority: z.number().int().min(1).max(4).optional(),
            due_string: z.string().optional(),
          }),
        ),
      }),
      execute: async ({ tasks }) => {
        const created: Array<{ id: string; content: string }> = [];
        for (const task of tasks) {
          const out = await t.createTask(token, task as t.CreateTaskInput);
          created.push({ id: out.id, content: out.content });
        }
        return { created_count: created.length, tasks: created };
      },
    }),
  };
}
