# Todoist Setup Guide — ADHD-Optimized

> **The #1 rule:** If adding a task takes more than 5 seconds, you won't do it.
> Everything below is designed around that reality.

---

## Step 1: Create Your Three Worlds (Projects)

Set these up as **top-level projects** with the colors shown. Color = instant domain recognition without reading.

### 🔴 Airborne (Red)
| Sub-Project | What Goes Here |
|---|---|
| `Helpdesk` | Tickets, user requests, break-fix |
| `Infrastructure` | SCCM, AD, Exchange, FortiClient, SOTI |
| `Compliance` | CMMC audits, SSP evidence, PreVeil |
| `Documentation` | Training guides, SOPs, runbooks |

### 🟣 Business (Purple)
| Sub-Project | What Goes Here |
|---|---|
| `MAHAKALA` | Client projects, proposals, dev tasks |
| `MeasureJoy` | Inventory, site updates, orders |
| `Career` | Job apps, interview prep, LinkedIn, certs |

### 🟢 Personal (Green)
| Sub-Project | What Goes Here |
|---|---|
| `Health` | Gym sessions, meal prep, peptide protocol |
| `Finance` | Debt payoff milestones, 401k, LLC filings |
| `Learning` | Security+, CCNA, AZ-900 study blocks |

> **That's it. 3 projects, 10 sub-projects.** Resist the urge to create more.
> If you can't decide where something goes in under 2 seconds, throw it in the parent project and sort later.

---

## Step 2: Create Labels (Context Tags)

Labels answer: **"Where am I / what energy do I have right now?"**

### Location Labels
- `@office` — At the Santa Ana office
- `@home` — At San Dimas
- `@anywhere` — Laptop/phone, no location needed

### Energy Labels
- `@deep` — Needs focus (compliance writing, code, architecture)
- `@shallow` — Can do on autopilot (emails, ticket updates, orders)
- `@quick` — Under 5 minutes, just knock it out

### Waiting Labels
- `@waiting` — Blocked on someone else (Gary, Scott, SOTI support, etc.)
- `@followup` — You did your part, need to chase

> **ADHD hack:** When your brain is fried at 3pm, filter by `@shallow` and just clear the queue. Momentum builds motivation.

---

## Step 3: Build These Filters (Your Dashboard)

Copy-paste these filter strings directly into Todoist.

### 🔥 "Right Now" — Your daily driver
```
(today | overdue) & !@waiting
```
*Shows everything due today or past due, minus stuff you're blocked on.*

### 🦅 "Bird's Eye" — Weekly overview across all domains
```
(today | overdue | 7 days) & !@waiting
```
*Your helicopter view. Check this Sunday night or Monday morning.*

### 🏢 "Airborne Today"
```
(today | overdue) & ##Airborne
```
*Just work. Open this when you sit down at the office.*

### 🟣 "Business Today"
```
(today | overdue) & ##Business
```
*MAHAKALA + MeasureJoy + career moves.*

### ⏳ "Waiting On"
```
@waiting | @followup
```
*Review weekly. Chase people. Close loops.*

### ⚡ "Quick Wins"
```
@quick & (today | overdue | no date)
```
*ADHD gold. Low friction dopamine hits when you can't focus on deep work.*

### 🧠 "Deep Work"
```
@deep & (today | 7 days)
```
*Block 2-hour chunks for these. Morning only if possible.*

---

## Step 4: Set Up Outlook Integration

1. Open Outlook → Get Add-ins → Search "Todoist"
2. Install the Todoist for Outlook add-in
3. Now when you get an email from Gary about a SOTI issue:
   - Click the Todoist icon in the email toolbar
   - It pre-fills the task with the email subject
   - Pick project: `Airborne > Infrastructure`
   - Add label: `@office`
   - Set due date
   - Done. Email → task in 10 seconds.

---

## Step 5: The ADHD Daily System

This only works if it's dead simple. Here's the entire routine:

### Morning (5 min at your desk)
1. Open Todoist → "Airborne Today" filter
2. Star the 1-3 things that MUST happen today
3. Move anything unrealistic to tomorrow (be honest)

### Throughout the day
- Email comes in that needs action? → Todoist add-in → 10 seconds → done
- Finish a task? → Check it off (the dopamine hit is real)
- Remember something random? → Quick Add (keyboard shortcut: `Q` on desktop) → throw it in the right project → forget about it

### End of day (2 min)
1. Check off what you did
2. Reschedule what you didn't (no guilt — just move the date)
3. Glance at tomorrow

### Sunday night (10 min)
1. Open "Bird's Eye" filter
2. Review the week ahead across all three domains
3. Flag anything that needs prep work
4. Check "Waiting On" filter — send follow-up messages

---

## Quick Add Syntax Cheat Sheet

Todoist's natural language parsing means you can type everything in one line:

| You type | Todoist creates |
|---|---|
| `Fix SOTI console ERROR(6) tomorrow p1 #Airborne/Infrastructure @office @deep` | Priority 1 task, due tomorrow, in Infrastructure, tagged office + deep work |
| `Invoice MeasureJoy orders Friday #Business/MeasureJoy @home @quick` | Due Friday, in MeasureJoy, home + quick task |
| `Costco grocery run Sunday #Personal/Health @home` | Due Sunday, in Health, at home |
| `Follow up Danny Nishiyama TA Aerospace next Monday #Business/Career @anywhere @followup` | Due next Monday, in Career, follow-up tag |
| `Study Security+ Ch.4 every weekday #Personal/Learning @anywhere @deep` | Recurring daily weekday task |
| `Pay credit card every month 15 #Personal/Finance @anywhere @quick` | Recurring monthly task |

> **The key insight:** You never have to navigate menus. Just type the whole thing in Quick Add and let the parser do the work. This is why Todoist beats TickTick for ADHD — fewer clicks, fewer decisions.

---

## Rules to Prevent System Collapse

These are non-negotiable if you want this to stick:

1. **Inbox Zero Daily** — Every task in your Todoist Inbox gets sorted into a project before bed. Unsorted tasks = abandoned system within 2 weeks.

2. **If it takes under 2 minutes, do it now.** Don't add it to Todoist. Just do it.

3. **Don't over-organize.** You have 10 sub-projects. That's enough. If you catch yourself creating a 4th nesting level, stop.

4. **Reschedule, don't delete.** Deleting overdue tasks feels like relief but kills trust in your system. Move it forward or decide it doesn't matter and archive it.

5. **Use "Waiting" religiously.** Half of ADHD overwhelm is carrying mental load for things you literally can't act on. Tag it `@waiting`, write who you're waiting on in the task notes, and stop thinking about it until your weekly review.

6. **Sunday review is sacred.** 10 minutes. Non-negotiable. This is the glue that holds everything together. Without it, the three domains blur together and you lose the bird's eye view.

---

## Accountability Tie-in

For your current commitments (week of March 23):

- [ ] `Sign up Paradise Gym Saturday Mar 22 #Personal/Health @home p1`
- [ ] `First Costco grocery run Sunday Mar 23 #Personal/Health @home p1`
- [ ] `5:30am gym session Monday Mar 24 #Personal/Health @office p1`
- [ ] `Start GHK-Cu 1mg/day Monday Mar 24 #Personal/Health @home`
- [ ] `Track: 3x/week gym for 4 consecutive weeks before retatrutide #Personal/Health`

*Add these right now while you're thinking about it.*
