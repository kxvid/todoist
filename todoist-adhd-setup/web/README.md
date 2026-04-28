# Todoist Co-pilot — web app

Chat with any LLM → tasks land in your Todoist. Mobile-first PWA, deploys to Vercel free tier. **Bring-your-own-key** model auth — supports Anthropic, OpenAI, Google Gemini, and any OpenAI-compatible server (Ollama, LM Studio, vLLM, llama.cpp, Groq, Together, Mistral).

## Architecture

**The orchestration logic is in code, not the LLM.** The model's only job is parsing the user's natural-language request into a structured `Plan` (a list of typed operations). A deterministic engine then executes the plan against Todoist. This makes small/cheap models (Gemini Flash, GPT-4o-mini, OSS like Gemma) fully reliable for this app — there is no multi-step tool-calling loop for them to get lost in.

```
                ┌──────────────────┐
   user ───────▶│  intent.ts       │   parseIntent()
                │  (LLM parser)    │   Single generateObject() call.
                └────────┬─────────┘   Output: Plan = { operations: [...] }
                         │
                         ▼
                ┌──────────────────┐
                │  engine.ts       │   executePlan()
                │  (no LLM)        │   Resolves project hints to IDs,
                │                  │   matches task queries, calls
                │                  │   the Todoist API, collects
                │                  │   per-op results.
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  agent.ts        │   Streams tool_use → tool_result →
                │  (orchestrator)  │   templated text summary back to UI.
                └──────────────────┘
```

```
web/
  app/
    api/
      auth/route.ts       POST password → bearer token
      chat/route.ts       POST messages + provider headers → SSE stream
      capture/route.ts    POST text + provider headers → one-shot reply
    page.tsx              Login / Capture / Chat / Settings shell
    layout.tsx, globals.css, manifest.ts
  components/
    Login.tsx, Chat.tsx, QuickCapture.tsx, Settings.tsx
  lib/                    Pure, framework-free (port these to RN as-is)
    todoist.ts            Todoist API v1 wrappers
    intent.ts             Plan schema + parseIntent() — the only LLM call
    engine.ts             Pure operation executors against Todoist
    agent.ts              parse → execute → emit, streaming pipeline
    providers.ts          Provider registry (Anthropic / OpenAI / Google / OpenAI-compat)
    settings.ts           localStorage helpers (client-only)
    auth.ts               Bearer token check
    types.ts              Shared types
```

## The Plan format

Every user request becomes a list of operations from this discriminated union (defined in `lib/intent.ts`):

| `type` | Purpose |
|---|---|
| `add_task` | Create a task with content, project_hint, labels, priority, due_string |
| `update_task` | Modify an existing task matched by query phrase |
| `complete_task` | Close a task by query phrase |
| `delete_task` | Delete a task by query phrase |
| `move_task` | Move a task to a different project |
| `list_tasks` | Read tasks by Todoist filter or project |
| `list_projects` | Show project tree |
| `create_project` / `create_label` | Catalog management |
| `clarify` | Ask the user; only when truly ambiguous |
| `chat` | Plain conversational reply, no Todoist op |

The engine resolves `project_hint` strings like `"Personal/Health"` to real IDs, so the LLM never has to deal with UUIDs.

## Adding a new operation

1. Add a new variant to `OperationSchema` in `lib/intent.ts`
2. Add a corresponding `case` to the switch in `lib/engine.ts`'s `executeOne`
3. Done — the parser will pick it up automatically because the LLM sees the schema

## How BYOK works

1. User signs in with `APP_PASSWORD`.
2. User opens **Settings**, picks a provider, pastes API key + model name (and base URL for OpenAI-compatible providers).
3. Settings live in `localStorage` only — never persisted server-side.
4. Each request to `/api/chat` or `/api/capture` sends the credentials as headers (`x-model-provider`, `x-model-key`, `x-model-name`, `x-model-base-url`).
5. The server reads them, instantiates the provider via the AI SDK, runs the tool-using agent loop, streams events back. Keys are discarded at the end of the request.

## Local dev

```bash
cd web
cp .env.example .env.local
# Fill in TODOIST_API_TOKEN and APP_PASSWORD only
npm install
npm run dev
# → http://localhost:3000
```

You'll be prompted to configure a model on first sign-in.

## Deploy to Vercel

```bash
cd web
npx vercel
# Set TODOIST_API_TOKEN and APP_PASSWORD in the dashboard
npx vercel --prod
```

Add `your-app.vercel.app` to your phone's home screen → it installs as a PWA.

## Using a local OSS model (Gemma, Llama, etc.)

Vercel's serverless functions can't reach `localhost:11434` on your laptop. Two options:

- **Tailscale**: install on both your laptop and use a Tailscale Funnel to expose `http://100.x.x.x:11434` publicly. Paste that URL in Settings → Base URL.
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:11434` gives you an `https://*.trycloudflare.com` URL. Paste that.

Then in Settings:
- Provider: **OpenAI-compatible (local / OSS)**
- Base URL: your tunnel URL + `/v1` (e.g. `https://abc.trycloudflare.com/v1`)
- Model: e.g. `gemma2:9b`
- API key: leave blank or any string (Ollama doesn't check)

## Endpoints

| Method | Path           | Body                        | Response                        |
| ------ | -------------- | --------------------------- | ------------------------------- |
| POST   | `/api/auth`    | `{ password }`              | `{ token }` or `401`            |
| POST   | `/api/chat`    | `{ messages: ChatMessage[]}`| SSE stream of `StreamEvent`     |
| POST   | `/api/capture` | `{ text }`                  | `{ reply }`                     |

All routes except `/api/auth` require:
- `Authorization: Bearer <token>` (gates the app)
- `x-model-provider` (`anthropic` | `openai` | `google` | `openai-compatible`)
- `x-model-key` (the user's API key)
- `x-model-name` (model identifier)
- `x-model-base-url` (only for `openai-compatible`)

## Adding a new provider

Edit `lib/providers.ts`:

```ts
import { createMistral } from "@ai-sdk/mistral";

export const PROVIDERS = [
  // ... existing
  {
    id: "mistral",
    label: "Mistral",
    description: "...",
    defaultModel: "mistral-large-latest",
    needsBaseURL: false,
    modelExamples: ["mistral-large-latest"],
  },
];

// In getModel switch:
case "mistral":
  return createMistral({ apiKey })(model);
```

Update `ProviderId` union, install `@ai-sdk/mistral`, done.

## Porting to React Native (Rork / Expo)

`lib/` has no Next.js or Node-specific imports outside the auth helper — it's pure TS using `fetch`, the AI SDK, and Zod. The provider abstraction means a React Native client can either:

- Hit the same `/api/*` endpoints from a hosted backend (BYOK headers travel the same way), or
- Run the AI SDK directly on-device — `lib/agent.ts`, `lib/providers.ts`, `lib/tools.ts`, `lib/todoist.ts` all run in any JS runtime.

For App Store distribution, the BYOK pattern means each user supplies their own model credentials at install time — no shared API key, no TOS issues.

## Costs

- **Vercel free tier**: handles single-user load.
- **Model**: depends on provider. Anthropic Sonnet 4.5 ≈ $3/$15 per 1M tokens. Local Ollama is free.
- **Todoist API**: free.
