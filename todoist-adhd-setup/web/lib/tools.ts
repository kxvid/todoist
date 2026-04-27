import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as t from "./todoist";

export function makeTools(token: string) {
  return [
    betaZodTool({
      name: "list_projects",
      description:
        "List all Todoist projects with their IDs, names, and parent IDs. Call this first when you need to find a project_id to add tasks to.",
      inputSchema: z.object({}),
      run: async () => {
        const projects = await t.listProjects(token);
        return JSON.stringify(
          projects.map((p) => ({ id: p.id, name: p.name, parent_id: p.parent_id })),
        );
      },
    }),

    betaZodTool({
      name: "list_labels",
      description: "List all available Todoist labels.",
      inputSchema: z.object({}),
      run: async () => {
        const labels = await t.listLabels(token);
        return JSON.stringify(labels.map((l) => l.name));
      },
    }),

    betaZodTool({
      name: "list_tasks",
      description:
        "List tasks. Optionally filter by Todoist filter query (e.g. 'today', 'overdue', '@quick', '##Personal') or project_id. Returns up to ~100 tasks.",
      inputSchema: z.object({
        filter: z
          .string()
          .optional()
          .describe("Todoist filter query like 'today', 'overdue', '@deep', '##Airborne'"),
        project_id: z.string().optional().describe("Project ID to filter by"),
      }),
      run: async ({ filter, project_id }) => {
        const tasks = await t.listTasks(token, filter, project_id);
        return JSON.stringify(
          tasks.map((task) => ({
            id: task.id,
            content: task.content,
            project_id: task.project_id,
            labels: task.labels,
            priority: task.priority,
            due: task.due?.string ?? null,
            url: task.url,
          })),
        );
      },
    }),

    betaZodTool({
      name: "add_task",
      description:
        "Create a new Todoist task. Priority: 1=normal, 2=medium, 3=high, 4=urgent. due_string accepts natural language like 'today', 'tomorrow at 3pm', 'every weekday', 'next monday'.",
      inputSchema: z.object({
        content: z.string().describe("Task title"),
        description: z.string().optional().describe("Longer notes/details"),
        project_id: z
          .string()
          .optional()
          .describe("Project ID. Omit for Inbox. Use list_projects to find IDs."),
        labels: z.array(z.string()).optional().describe("Label names like 'deep', 'quick', 'home'"),
        priority: z
          .number()
          .int()
          .min(1)
          .max(4)
          .optional()
          .describe("1=normal, 2=medium, 3=high, 4=urgent"),
        due_string: z.string().optional().describe("Natural-language due date"),
      }),
      run: async (input) => {
        const task = await t.createTask(token, input as t.CreateTaskInput);
        return JSON.stringify({ id: task.id, content: task.content, url: task.url });
      },
    }),

    betaZodTool({
      name: "update_task",
      description: "Update an existing task's content, labels, priority, or due date.",
      inputSchema: z.object({
        id: z.string(),
        content: z.string().optional(),
        description: z.string().optional(),
        labels: z.array(z.string()).optional(),
        priority: z.number().int().min(1).max(4).optional(),
        due_string: z.string().optional(),
      }),
      run: async ({ id, ...rest }) => {
        const task = await t.updateTask(token, id, rest as t.UpdateTaskInput);
        return JSON.stringify({ id: task.id, content: task.content });
      },
    }),

    betaZodTool({
      name: "complete_task",
      description:
        "Mark a task as completed. The user usually does this themselves in Todoist — only call when explicitly asked.",
      inputSchema: z.object({ id: z.string() }),
      run: async ({ id }) => {
        await t.completeTask(token, id);
        return `Completed task ${id}`;
      },
    }),

    betaZodTool({
      name: "delete_task",
      description: "Permanently delete a task. Confirm with the user before calling.",
      inputSchema: z.object({ id: z.string() }),
      run: async ({ id }) => {
        await t.deleteTask(token, id);
        return `Deleted task ${id}`;
      },
    }),

    betaZodTool({
      name: "move_task",
      description: "Move a task to a different project.",
      inputSchema: z.object({ id: z.string(), project_id: z.string() }),
      run: async ({ id, project_id }) => {
        const task = await t.moveTask(token, id, project_id);
        return JSON.stringify({ id: task.id, project_id: task.project_id });
      },
    }),

    betaZodTool({
      name: "create_project",
      description: "Create a new Todoist project. Optionally nested under a parent project.",
      inputSchema: z.object({
        name: z.string(),
        parent_id: z.string().optional(),
        color: z.string().optional().describe("Color name e.g. red, grape, green, blue"),
        is_favorite: z.boolean().optional(),
      }),
      run: async (input) => {
        const project = await t.createProject(token, input as t.CreateProjectInput);
        return JSON.stringify({ id: project.id, name: project.name });
      },
    }),

    betaZodTool({
      name: "create_label",
      description: "Create a new label.",
      inputSchema: z.object({
        name: z.string(),
        color: z.string().optional(),
      }),
      run: async (input) => {
        const label = await t.createLabel(token, input as t.CreateLabelInput);
        return JSON.stringify({ id: label.id, name: label.name });
      },
    }),

    betaZodTool({
      name: "bulk_add_tasks",
      description:
        "Add multiple tasks in one call. Use when the user asks to plan a week, batch-create tasks from a list, or seed a project. Each task uses the same fields as add_task.",
      inputSchema: z.object({
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
      run: async ({ tasks }) => {
        const created: Array<{ id: string; content: string }> = [];
        for (const task of tasks) {
          const out = await t.createTask(token, task as t.CreateTaskInput);
          created.push({ id: out.id, content: out.content });
        }
        return JSON.stringify({ created_count: created.length, tasks: created });
      },
    }),
  ];
}
