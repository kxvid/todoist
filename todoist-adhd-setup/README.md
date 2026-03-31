# 🧠 Todoist ADHD-Optimized Setup

One command. Three life domains. Zero decision fatigue.

This script configures a complete Todoist system designed for ADHD brains — low-friction capture, energy-based filtering, and birds-eye views across Work, Business, and Personal domains.

## What It Creates

| Category | Count | Details |
|----------|-------|---------|
| Projects | 13 | 3 color-coded parents + 10 sub-projects |
| Labels | 8 | Location (@office, @home, @anywhere) · Energy (@deep, @shallow, @quick) · Status (@waiting, @followup) |
| Filters | 7 | 🔥 Right Now · 🦅 Bird's Eye · 🏢 Airborne Today · 🟣 Business Today · ⏳ Waiting On · ⚡ Quick Wins · 🧠 Deep Work |
| Seed Tasks | 13 | Recurring tasks across all domains |

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/todoist-adhd-setup.git
cd todoist-adhd-setup
cp .env.example .env
# Edit .env → paste your Todoist API token
pip install -r requirements.txt
python setup.py --dry-run   # preview first
python setup.py             # deploy everything
```

### Get Your API Token
Todoist → Settings → Integrations → Developer → API token

## Using with Claude Code

```bash
cd todoist-adhd-setup
claude
# Then just say: "run the setup" or "add a new project for Freelance"
```

The `CLAUDE.md` file gives Claude Code full context on the repo structure, so it can modify configs, add tasks, or re-run the setup for you conversationally.

## Customization

Edit the config dictionaries at the top of `setup.py`:

- **PROJECTS** — Add/remove/rename domains and sub-projects
- **LABELS** — Change context tags and colors
- **FILTERS** — Modify filter queries (uses [Todoist filter syntax](https://todoist.com/help/articles/introduction-to-filters-V98wIH))
- **SEED_TASKS** — Pre-loaded recurring tasks

## Design Principles

1. **5-second capture rule** — If adding a task takes longer, you won't do it
2. **Energy-based filtering** — Brain fried? Filter `@shallow`. In the zone? Filter `@deep`
3. **Domain separation** — Work / Business / Personal never bleed into each other
4. **Minimal structure** — 3 parents, 10 subs. No 4th nesting level. Ever.
5. **Idempotent** — Run it twice, nothing breaks. Existing items are skipped.

## License

MIT — do whatever you want with it.
