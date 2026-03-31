# CLAUDE.md

## What This Repo Does
This is a one-shot setup script for Todoist that creates an ADHD-optimized task management system across three life domains: Work (Airborne Systems), Business (MAHAKALA/MeasureJoy), and Personal.

## How to Run
1. Ensure `.env` exists with `TODOIST_API_TOKEN=<token>`
2. `pip install -r requirements.txt`
3. `python setup.py` (live) or `python setup.py --dry-run` (preview)

## What Gets Created
- **3 parent projects** (Airborne 🔴, Business 🟣, Personal 🟢)
- **10 sub-projects** nested under parents
- **8 labels** for context filtering (@office, @home, @anywhere, @deep, @shallow, @quick, @waiting, @followup)
- **7 filters** for dashboard views (Right Now, Bird's Eye, Airborne Today, etc.)
- **13 recurring seed tasks** across all domains

## Editing the Configuration
All configuration is in the top section of `setup.py` — the PROJECTS, LABELS, FILTERS, and SEED_TASKS dictionaries. Edit these before running to customize.

## Important Notes
- Script is idempotent — skips anything that already exists
- Rate limiting is handled automatically
- Token can come from: CLI arg, .env file, or TODOIST_API_TOKEN env var
- Todoist API docs: https://developer.todoist.com/rest/v2
