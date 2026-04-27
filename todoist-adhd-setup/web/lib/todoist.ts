const BASE = "https://api.todoist.com/rest/v2";

async function req<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Request-Id": crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return {} as T;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Todoist ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface Project {
  id: string;
  name: string;
  parent_id: string | null;
  color: string;
  is_favorite: boolean;
}

export interface Task {
  id: string;
  content: string;
  description: string;
  project_id: string;
  labels: string[];
  priority: number;
  due: { string: string; date: string; is_recurring: boolean } | null;
  is_completed: boolean;
  url: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export const listProjects = (token: string) => req<Project[]>(token, "GET", "/projects");
export const listLabels = (token: string) => req<Label[]>(token, "GET", "/labels");

export const listTasks = (token: string, filter?: string, projectId?: string) => {
  const qs = new URLSearchParams();
  if (filter) qs.set("filter", filter);
  if (projectId) qs.set("project_id", projectId);
  const q = qs.toString();
  return req<Task[]>(token, "GET", `/tasks${q ? `?${q}` : ""}`);
};

export const getTask = (token: string, id: string) => req<Task>(token, "GET", `/tasks/${id}`);

export interface CreateTaskInput {
  content: string;
  description?: string;
  project_id?: string;
  parent_id?: string;
  labels?: string[];
  priority?: 1 | 2 | 3 | 4;
  due_string?: string;
}

export const createTask = (token: string, input: CreateTaskInput) =>
  req<Task>(token, "POST", "/tasks", input);

export interface UpdateTaskInput {
  content?: string;
  description?: string;
  labels?: string[];
  priority?: 1 | 2 | 3 | 4;
  due_string?: string;
}

export const updateTask = (token: string, id: string, input: UpdateTaskInput) =>
  req<Task>(token, "POST", `/tasks/${id}`, input);

export const completeTask = (token: string, id: string) =>
  req<{}>(token, "POST", `/tasks/${id}/close`);

export const reopenTask = (token: string, id: string) =>
  req<{}>(token, "POST", `/tasks/${id}/reopen`);

export const deleteTask = (token: string, id: string) =>
  req<{}>(token, "DELETE", `/tasks/${id}`);

export const moveTask = (token: string, id: string, projectId: string) =>
  req<Task>(token, "POST", `/tasks/${id}`, { project_id: projectId });

export interface CreateProjectInput {
  name: string;
  parent_id?: string;
  color?: string;
  is_favorite?: boolean;
}

export const createProject = (token: string, input: CreateProjectInput) =>
  req<Project>(token, "POST", "/projects", input);

export interface CreateLabelInput {
  name: string;
  color?: string;
}

export const createLabel = (token: string, input: CreateLabelInput) =>
  req<Label>(token, "POST", "/labels", input);

export async function whoami(token: string): Promise<{ full_name: string; email: string }> {
  const res = await fetch("https://api.todoist.com/sync/v9/sync", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sync_token: "*", resource_types: '["user"]' }),
  });
  if (!res.ok) throw new Error(`Todoist whoami → ${res.status}`);
  const data = (await res.json()) as { user: { full_name: string; email: string } };
  return data.user;
}
