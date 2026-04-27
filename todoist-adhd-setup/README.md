# 🧠 Todoist Co-pilot + ADHD Setup

Two complementary tools for an ADHD-optimized Todoist:

| Tool | When to use |
|---|---|
| **`setup.py`** | One-time bulk scaffolding — projects, labels, filters, seed tasks. Run once. |
| **`web/`** | Day-to-day chat-driven Todoist. Deploy to Vercel, use from any browser/phone. |

## Quick paths

### 1. Initial setup (one-time, local)

```bash
cp .env.example .env
# Add your TODOIST_API_TOKEN
pip install -r requirements.txt
python setup.py --dry-run    # preview
python setup.py              # create projects, labels, filters, seed tasks
```

Creates 3 parent projects (Airborne / Business / Personal), 10 sub-projects, 8 labels, 7 dashboard filters, and 13 recurring seed tasks.

### 2. Daily use — chat → tasks (Vercel app)

```bash
cd web
cp .env.example .env.local
# Fill ANTHROPIC_API_KEY, TODOIST_API_TOKEN, APP_PASSWORD
npm install && npm run dev   # local
# or:
npx vercel --prod            # deploy
```

Open the URL on your phone → chat or quick-capture → tasks land in Todoist. You only check things off.

See [`web/README.md`](web/README.md) for the architecture and porting notes (the API is structured to drop into a React Native shell for App Store later).

## Why both?

`setup.py` builds the *system* — the project tree, label vocabulary, filter views. You only need to run it once (or after a reset).

The web app is the *interface* — instead of opening Todoist to add a task, you tell Claude "add 'review CMMC docs' to Compliance for Friday with @deep" and it lands. The model knows your project structure (described in `web/lib/systemPrompt.ts`) so it picks the right project and labels automatically.

## Design Principles

1. **5-second capture rule** — if adding a task takes longer, you won't do it
2. **Energy-based filtering** — `@deep`, `@shallow`, `@quick`
3. **Domain separation** — Work / Business / Personal never mix
4. **Minimal structure** — 3 parents, 10 subs, no 4th nesting level
5. **Idempotent setup** — `setup.py` is safe to re-run

## License

MIT.
