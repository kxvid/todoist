#!/usr/bin/env python3
"""
Todoist ADHD-Optimized Setup Script
====================================
Creates your entire project structure, labels, filters, and seed tasks
in one run using the Todoist REST API.

USAGE:
  1. Copy .env.example → .env and paste your API token
  2. pip install -r requirements.txt
  3. python setup.py              (live run)
     python setup.py --dry-run    (preview without creating)

  Or pass token directly:
     python setup.py YOUR_API_TOKEN
     python setup.py YOUR_API_TOKEN --dry-run

CLAUDE CODE:
  Just tell Claude Code: "run the setup" from this directory.
  It will read .env automatically.
"""

import requests
import sys
import os
import time
import json
import uuid

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not required if passing token as arg

# ============================================================
# CONFIGURATION — Edit these to customize your setup
# ============================================================

# Top-level projects with colors
# Todoist color names: https://developer.todoist.com/guides/#colors
PROJECTS = {
    "Airborne": {
        "color": "red",
        "sub_projects": ["Helpdesk", "Infrastructure", "Compliance", "Documentation"]
    },
    "Business": {
        "color": "grape",
        "sub_projects": ["MAHAKALA", "MeasureJoy", "Career"]
    },
    "Personal": {
        "color": "green",
        "sub_projects": ["Health", "Finance", "Learning"]
    }
}

# Labels (context tags for ADHD-friendly filtering)
LABELS = [
    # Location
    {"name": "office",   "color": "blue"},
    {"name": "home",     "color": "teal"},
    {"name": "anywhere", "color": "sky_blue"},
    # Energy level
    {"name": "deep",     "color": "red"},
    {"name": "shallow",  "color": "yellow"},
    {"name": "quick",    "color": "lime_green"},
    # Status
    {"name": "waiting",  "color": "grey"},
    {"name": "followup", "color": "orange"},
]

# Filters (your dashboard views)
FILTERS = [
    {
        "name": "🔥 Right Now",
        "query": "(today | overdue) & !@waiting",
        "color": "red",
        "is_favorite": True,
    },
    {
        "name": "🦅 Bird's Eye",
        "query": "(today | overdue | 7 days) & !@waiting",
        "color": "blue",
        "is_favorite": True,
    },
    {
        "name": "🏢 Airborne Today",
        "query": "(today | overdue) & ##Airborne",
        "color": "red",
        "is_favorite": True,
    },
    {
        "name": "🟣 Business Today",
        "query": "(today | overdue) & ##Business",
        "color": "grape",
        "is_favorite": False,
    },
    {
        "name": "⏳ Waiting On",
        "query": "@waiting | @followup",
        "color": "grey",
        "is_favorite": False,
    },
    {
        "name": "⚡ Quick Wins",
        "query": "@quick & (today | overdue | no date)",
        "color": "lime_green",
        "is_favorite": True,
    },
    {
        "name": "🧠 Deep Work",
        "query": "@deep & (today | 7 days)",
        "color": "red",
        "is_favorite": False,
    },
]

# Seed tasks — pre-loaded starter tasks
# (content, project_path, labels, priority, due_string, description)
# priority: 1=normal, 2=medium, 3=high, 4=urgent (API inverts display)
SEED_TASKS = [
    # === AIRBORNE ===
    (
        "Process Helpdesk ticket queue",
        "Airborne/Helpdesk",
        ["office", "shallow"],
        1,
        "every weekday",
        "Morning triage — check Autotask, prioritize, respond"
    ),
    (
        "Weekly infrastructure health check",
        "Airborne/Infrastructure",
        ["office", "deep"],
        2,
        "every monday",
        "AD replication, Exchange hybrid sync, SCCM patching status, FortiClient VPN"
    ),
    (
        "CMMC evidence review",
        "Airborne/Compliance",
        ["office", "deep"],
        2,
        "every friday",
        "Review SSP evidence docs, check PreVeil sync, update compliance tracker"
    ),

    # === BUSINESS ===
    (
        "MAHAKALA weekly pipeline review",
        "Business/MAHAKALA",
        ["anywhere", "deep"],
        2,
        "every monday",
        "Review leads, proposals in progress, active client projects"
    ),
    (
        "MeasureJoy — check orders & inventory",
        "Business/MeasureJoy",
        ["anywhere", "shallow"],
        1,
        "every wednesday",
        "Pending orders, stock levels, shipping status"
    ),
    (
        "Job search — apply to 3 roles",
        "Business/Career",
        ["home", "deep"],
        3,
        "every sunday",
        "Target: CMMC/GCC High roles $95K+. Check LinkedIn, Indeed, ClearanceJobs"
    ),
    (
        "Update LinkedIn with latest project wins",
        "Business/Career",
        ["anywhere", "shallow"],
        1,
        "every other friday",
        "Post about PreVeil deployment, CMMC audit work, M365 GCC High experience"
    ),

    # === PERSONAL ===
    (
        "Camp Transformation boot camp class",
        "Personal/Health",
        ["anywhere"],
        4,
        "every weekday",
        "1-hour daily class. NON-NEGOTIABLE. No excuses. 6-week program starting Apr 13."
    ),
    (
        "GHK-Cu 1mg subQ injection",
        "Personal/Health",
        ["home"],
        3,
        "every day",
        "Daily peptide protocol — morning, subcutaneous"
    ),
    (
        "Weekly meal prep check",
        "Personal/Health",
        ["home", "shallow"],
        1,
        "every sunday",
        "Costco run if needed. Stock: cottage cheese, Siggi's, edamame, Greek yogurt, ON whey"
    ),
    (
        "Security+ study session",
        "Personal/Learning",
        ["anywhere", "deep"],
        2,
        "every weekday",
        "Minimum 30 min. Use CompTIA CertMaster or Professor Messer"
    ),
    (
        "Sunday weekly review",
        "Personal",
        ["home", "deep"],
        4,
        "every sunday at 7pm",
        "10 min. Open Bird's Eye filter. Review all 3 domains. Check Waiting On. Plan the week."
    ),
    (
        "Pay credit card bills",
        "Personal/Finance",
        ["anywhere", "quick"],
        3,
        "every month 15",
        "Check all cards, pay minimum or full balance"
    ),
]


# ============================================================
# API CLIENT
# ============================================================

class TodoistSetup:
    BASE_URL = "https://api.todoist.com/rest/v2"

    def __init__(self, token, dry_run=False):
        self.token = token
        self.dry_run = dry_run
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Request-Id": "",
        }
        self.project_map = {}
        self.label_map = {}
        self.created = {"projects": 0, "labels": 0, "filters": 0, "tasks": 0}

    def _request(self, method, endpoint, **kwargs):
        self.headers["X-Request-Id"] = str(uuid.uuid4())
        url = f"{self.BASE_URL}/{endpoint}"

        if self.dry_run:
            print(f"  [DRY RUN] {method} {endpoint} → {json.dumps(kwargs.get('json', {}), indent=2)}")
            return {"id": f"dry-{uuid.uuid4().hex[:8]}"}

        for attempt in range(5):
            resp = requests.request(method, url, headers=self.headers, **kwargs)

            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 5))
                print(f"  ⏳ Rate limited. Waiting {wait}s...")
                time.sleep(wait)
                continue

            if resp.status_code == 204:
                return {}

            if not resp.ok:
                print(f"  ❌ Error {resp.status_code}: {resp.text}")
                return None

            return resp.json() if resp.text else {}

        print("  ❌ Max retries hit.")
        return None

    def create_labels(self):
        print("\n📌 Creating labels...")
        existing = self._request("GET", "labels") or []
        existing_names = {l["name"]: l["id"] for l in existing} if not self.dry_run else {}

        for label in LABELS:
            name = label["name"]
            if name in existing_names:
                print(f"  ✓ @{name} already exists")
                self.label_map[name] = existing_names[name]
                continue

            result = self._request("POST", "labels", json={
                "name": name,
                "color": label.get("color", "charcoal"),
            })
            if result:
                self.label_map[name] = result.get("id", "")
                self.created["labels"] += 1
                print(f"  ✅ @{name}")
            time.sleep(0.3)

    def create_projects(self):
        print("\n📁 Creating projects...")
        existing = self._request("GET", "projects") or []
        existing_names = {p["name"]: p for p in existing} if not self.dry_run else {}

        for proj_name, config in PROJECTS.items():
            if proj_name in existing_names:
                parent_id = existing_names[proj_name]["id"]
                print(f"  ✓ {proj_name} already exists")
            else:
                result = self._request("POST", "projects", json={
                    "name": proj_name,
                    "color": config["color"],
                    "is_favorite": True,
                })
                if not result:
                    continue
                parent_id = result.get("id", "")
                self.created["projects"] += 1
                print(f"  ✅ {proj_name}")

            self.project_map[proj_name] = parent_id
            time.sleep(0.3)

            for sub_name in config["sub_projects"]:
                full_path = f"{proj_name}/{sub_name}"
                if sub_name in existing_names:
                    existing_parent = existing_names[sub_name].get("parent_id")
                    if existing_parent == parent_id:
                        self.project_map[full_path] = existing_names[sub_name]["id"]
                        print(f"  ✓ └── {sub_name} already exists")
                        continue

                result = self._request("POST", "projects", json={
                    "name": sub_name,
                    "parent_id": parent_id,
                    "color": config["color"],
                })
                if result:
                    self.project_map[full_path] = result.get("id", "")
                    self.created["projects"] += 1
                    print(f"  ✅ └── {sub_name}")
                time.sleep(0.3)

    def create_filters(self):
        print("\n🔍 Creating filters...")
        existing = self._request("GET", "filters") or []
        existing_names = {f["name"] for f in existing} if not self.dry_run else set()

        for f in FILTERS:
            if f["name"] in existing_names:
                print(f"  ✓ {f['name']} already exists")
                continue

            result = self._request("POST", "filters", json={
                "name": f["name"],
                "query": f["query"],
                "color": f.get("color", "charcoal"),
                "is_favorite": f.get("is_favorite", False),
            })
            if result:
                self.created["filters"] += 1
                print(f"  ✅ {f['name']}")
            time.sleep(0.3)

    def create_seed_tasks(self):
        print("\n📝 Creating seed tasks...")
        for content, proj_path, labels, priority, due, desc in SEED_TASKS:
            project_id = self.project_map.get(proj_path)
            if not project_id and not self.dry_run:
                print(f"  ⚠️  '{proj_path}' not found, using Inbox")
                project_id = None

            task_data = {
                "content": content,
                "priority": priority,
                "labels": labels,
            }
            if project_id:
                task_data["project_id"] = project_id
            if due:
                task_data["due_string"] = due
            if desc:
                task_data["description"] = desc

            result = self._request("POST", "tasks", json=task_data)
            if result:
                self.created["tasks"] += 1
                flag = "🔴" if priority == 4 else "🟡" if priority >= 2 else "⚪"
                print(f"  {flag} {content}")
            time.sleep(0.3)

    def run(self):
        mode = "DRY RUN" if self.dry_run else "LIVE"
        print(f"""
╔══════════════════════════════════════════════════════╗
║  Todoist ADHD-Optimized Setup — [{mode}]
║  3 Domains · 10 Sub-projects · 8 Labels
║  7 Filters · {len(SEED_TASKS)} Seed Tasks
╚══════════════════════════════════════════════════════╝""")

        if not self.dry_run:
            print("\n🔑 Validating API token...")
            resp = requests.get(
                "https://api.todoist.com/sync/v9/sync",
                headers={"Authorization": f"Bearer {self.token}"},
                params={"sync_token": "*", "resource_types": '["user"]'}
            )
            if resp.status_code != 200:
                print("❌ Invalid API token.")
                print("   Get it: Todoist → Settings → Integrations → Developer")
                sys.exit(1)
            user = resp.json().get("user", {})
            print(f"✅ Authenticated as: {user.get('full_name', 'Unknown')} ({user.get('email', '')})\n")

        self.create_labels()
        self.create_projects()
        self.create_filters()
        self.create_seed_tasks()

        print(f"""
╔══════════════════════════════════════════════════════╗
║  ✅ SETUP COMPLETE
║  Projects: {self.created['projects']:>3} created
║  Labels:   {self.created['labels']:>3} created
║  Filters:  {self.created['filters']:>3} created
║  Tasks:    {self.created['tasks']:>3} created
╚══════════════════════════════════════════════════════╝

Next steps:
  1. Open Todoist — sidebar shows Airborne / Business / Personal
  2. Star your most-used filters (🔥 Right Now, 🦅 Bird's Eye)
  3. Install Todoist Outlook add-in
  4. Download Todoist mobile app
  5. Keyboard shortcut Q = Quick Add from anywhere
""")


# ============================================================
# ENTRY POINT
# ============================================================
if __name__ == "__main__":
    # Token priority: CLI arg > .env > prompt
    token = None
    dry_run = "--dry-run" in sys.argv

    # Check CLI args (skip flags)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args:
        token = args[0]

    # Check .env
    if not token:
        token = os.environ.get("TODOIST_API_TOKEN")

    # Prompt
    if not token:
        print("No API token found.")
        print("  Option 1: python setup.py YOUR_TOKEN")
        print("  Option 2: Copy .env.example → .env and add your token")
        print("  Option 3: export TODOIST_API_TOKEN=your_token")
        print()
        print("Get your token: Todoist → Settings → Integrations → Developer")
        sys.exit(1)

    setup = TodoistSetup(token, dry_run=dry_run)
    setup.run()
