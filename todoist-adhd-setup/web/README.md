# Todoist Co-pilot — web app

Chat with Claude → tasks land in your Todoist. Mobile-first PWA, deploys to Vercel free tier.

## Architecture

The codebase is structured so the **API surface is portable** — wrap a React Native shell around the same `/api/*` endpoints to ship to the App Store later.

```
web/
  app/
    api/
      auth/route.ts       POST password → bearer token
      chat/route.ts       POST messages → SSE stream
      capture/route.ts    POST text → one-shot reply
    page.tsx              Login / Capture / Chat shell
    layout.tsx, globals.css, manifest.ts
  components/
    Login.tsx, Chat.tsx, QuickCapture.tsx
  lib/                    Pure, framework-free (port these to RN as-is)
    todoist.ts            Todoist REST API wrappers
    tools.ts              Zod tool definitions for Claude
    anthropic.ts          Tool-runner loop + streaming
    systemPrompt.ts       ADHD-tuned system prompt
    auth.ts               Bearer token check
    types.ts              Shared types
```

## Local dev

```bash
cd web
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY, TODOIST_API_TOKEN, APP_PASSWORD
npm install
npm run dev
# → http://localhost:3000
```

## Deploy to Vercel

```bash
cd web
npx vercel
# Set the same three env vars in the Vercel dashboard
npx vercel --prod
```

Add `your-app.vercel.app` to your phone's home screen → it installs as a PWA.

## Endpoints

| Method | Path           | Body                        | Response                        |
| ------ | -------------- | --------------------------- | ------------------------------- |
| POST   | `/api/auth`    | `{ password }`              | `{ token }` or `401`            |
| POST   | `/api/chat`    | `{ messages: ChatMessage[]}`| SSE stream of `StreamEvent`     |
| POST   | `/api/capture` | `{ text }`                  | `{ reply }`                     |

All routes except `/api/auth` require `Authorization: Bearer <token>`.

## Porting to React Native (Rork / Expo)

`lib/` has no Next.js or Node-specific imports outside the auth helper — it's all pure TS using `fetch` and the official Anthropic SDK. To ship a native app:

1. Run the API as-is on Vercel (or any Node host).
2. Build a React Native client that hits the same `/api/auth`, `/api/chat`, `/api/capture` endpoints.
3. Replace `localStorage` with `expo-secure-store` for the bearer token.
4. Replace the `fetch` SSE reader in `Chat.tsx` with `react-native-sse` or similar.

Or run the model server-side and the tool-runner on-device — the `lib/tools.ts` and `lib/todoist.ts` files run in any JS runtime.

## Costs

- **Vercel free tier**: hobby plan handles single-user load easily.
- **Anthropic API**: Sonnet 4.6 is ~$3/$15 per 1M input/output tokens. Personal use is pennies/day. System prompt + tool defs are cached (~10× cheaper on repeat).
- **Todoist API**: free.

## Customization

- **System prompt**: edit `lib/systemPrompt.ts` — describe your projects/labels so Claude infers correctly.
- **Add a tool**: drop a new `betaZodTool({...})` into `lib/tools.ts`. The tool runner picks it up automatically.
- **Switch model**: change `MODEL` in `lib/anthropic.ts` (e.g., `claude-opus-4-7` for max smarts at ~5× the cost).
