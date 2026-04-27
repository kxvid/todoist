# CLAUDE.md

## What This Repo Does
Two tools for an ADHD-optimized Todoist workflow:

1. **`setup.py`** — one-shot script that scaffolds the user's full Todoist system (projects, labels, filters, seed tasks). Run once.
2. **`web/`** — Next.js app deployed to Vercel. Chat with Claude → Claude calls Todoist API tools → tasks land in the user's Todoist. Used daily from any browser or phone.

## Repo layout

```
.
├── setup.py              # one-time bulk scaffolding (Python)
├── requirements.txt
├── .env.example          # for setup.py
└── web/                  # Vercel chat app (Next.js + TypeScript)
    ├── app/api/          # auth, chat (SSE), capture
    ├── lib/              # framework-free, portable to React Native
    │   ├── todoist.ts    # Todoist REST wrappers
    │   ├── tools.ts      # Zod tool defs for Claude (betaZodTool)
    │   ├── anthropic.ts  # tool-runner loop + streaming
    │   └── systemPrompt.ts
    └── README.md         # web-specific docs
```

## Running setup.py
1. `.env` with `TODOIST_API_TOKEN=<token>`
2. `pip install -r requirements.txt`
3. `python setup.py` (live) or `python setup.py --dry-run` (preview)

## Running the web app locally
1. `cd web && cp .env.example .env.local`
2. Fill `ANTHROPIC_API_KEY`, `TODOIST_API_TOKEN`, `APP_PASSWORD`
3. `npm install && npm run dev` → `http://localhost:3000`

## Deploying the web app
`cd web && npx vercel --prod`. Set the three env vars in the Vercel dashboard.

## Key implementation notes
- Model: `claude-sonnet-4-6` (set in `web/lib/anthropic.ts`).
- Tool use loop: uses `client.beta.messages.toolRunner({stream: true, ...})` from the official `@anthropic-ai/sdk` — handles the agentic loop automatically.
- Prompt caching: `cache_control: {type: "ephemeral"}` is set top-level so the system prompt + tool definitions are cached (~10× cheaper on repeat requests).
- Auth: simple bearer token (the `APP_PASSWORD` value). Designed to be portable — same scheme works for a future React Native client.
- `lib/` is intentionally framework-free so it can be lifted into a React Native app later (Rork / Expo) for an iOS App Store build.

## Editing things
- **Add a Todoist tool**: drop a new `betaZodTool({...})` into `web/lib/tools.ts`. The tool runner picks it up automatically.
- **Change the agent's behavior**: edit `web/lib/systemPrompt.ts` (project structure, label semantics, defaults).
- **Change the project structure**: edit the `PROJECTS` / `LABELS` / `FILTERS` dicts at the top of `setup.py`, then re-run.
- **Switch model**: change `MODEL` in `web/lib/anthropic.ts`.

## Important
- `setup.py` is idempotent — safe to re-run.
- Both tools share the same Todoist token but live independently — neither requires the other to function.
- Todoist API docs: https://developer.todoist.com/rest/v2
- Anthropic SDK docs: https://github.com/anthropics/anthropic-sdk-typescript
