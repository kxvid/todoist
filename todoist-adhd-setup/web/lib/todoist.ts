const BASE = "https://api.todoist.com/api/v1";

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

// v1 paginated list responses can come back as either a flat array (REST-v2-style)
// or wrapped in { results: [...], next_cursor: "..." }. Tolerate both.
async function reqList<T>(token: string, path: string): Promise<T[]> {
  const data = await req<T[] | { results?: T[]; items?: T[] }>(token, "GET", path);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { results?: T[] }).results))
    return (data as { results: T[] }).results;
  if (data && Array.isArray((data as { items?: T[] }).items))
    return (data as { items: T[] }).items;
  return [];
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

export const listProjects = (token: string) => reqList<Project>(token, "/projects");
export const listLabels = (token: string) => reqList<Label>(token, "/labels");

export async function listTasks(
  token: string,
  filter?: string,
  projectId?: string,
): Promise<Task[]> {
  // v1 splits filtering: plain GET /tasks for project/global lists,
  // GET /tasks/filter?query=... for Todoist filter expressions.
  if (filter) {
    const qs = new URLSearchParams({ query: filter });
    return reqList<Task>(token, `/tasks/filter?${qs.toString()}`);
  }
  const qs = new URLSearchParams();
  if (projectId) qs.set("project_id", projectId);
  const q = qs.toString();
  return reqList<Task>(token, `/tasks${q ? `?${q}` : ""}`);
}

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
