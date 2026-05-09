# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#11** · Code Quality — **CQ#10** · Feature Requests — **FR#37**

---

## Known issues / remaining work

- [ ] Issue#2 [GH#1] — Brain Dump doesn't auto-add items to inbox — user has to copy manually (Chat mode can create tasks via `→ACTION:create`, but Brain Dump mode is not wired up)
- [ ] Issue#3 [GH#2] — Weekly Review doesn't check off steps as completed
- [ ] Issue#5 — Emails pulled from Gmail are cut short (body text truncated before end of message)
- [ ] Issue#9 [GH#20] — Tasks with a due date do not appear in the Calendar view "tasks with due date, but no calendar event" section — not shown on first visit, nor after soft or hard refresh; root cause unknown (may be a filter, sort, or data-mapping bug in CalendarManagementView/calendarApi)
- [ ] Issue#10 [GH#21] — Add & Ask AI: when AI identifies a duplicate and the user confirms delete, the original inbox item is archived but a new task is still created (the confirmed action should be delete-only, not create)
- [ ] Issue#11 [GH#22] — Calendar event creation uses today's date instead of the task's due date (task detail panel shows correct due date, but the created calendar event is pinned to the current date)

---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins

- FR#13 [GH#4] — Remove "Process with AI" button from the left sidebar navigation panel

#### Daily workflow / GTD core

- FR#14 [GH#5] — Daily Review button (replaces FR#13; context-aware: shows "Start Day" in the morning or if start-of-day review hasn't run yet; shows "End Day" in the afternoon/evening or after start-of-day completes; localStorage persistence; must handle incomplete/interrupted reviews gracefully)
- FR#7 [GH#6] — Daily focus view (pick 3 Most Important Tasks from Next Actions)
- FR#15 [GH#7] — AI-assisted daily planning (new coach mode; evaluates calendar + tasks + travel time)
- FR#6 [GH#8] — Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)
- FR#33 — Search within current bucket (filter bar that narrows visible tasks by text match on title/notes; scoped to whichever bucket is active)
- FR#34 — Search across all tasks (global search spanning all buckets; results show task title, bucket, and key metadata; clicking a result opens the task detail panel)

#### Inbox / processing improvements

- FR#8 [GH#9] — Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
- FR#19 [GH#10] — Inbox History / AI exposure rethink (decide policy on what the AI sees; small code change once decided)

#### Integrations / data

- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
- FR#35 [GH#23] — Calendar sync: when a task has a parent, show only the child task in the "tasks with due date, no calendar event" list (suppress the parent to avoid adding both parent and child as separate events)
- FR#37 [GH#31] (2026-05-09) — Calendar event creation: set default notification(s) on created events (simplest: pass `useDefault: true` to Google Calendar API; stretch: configurable reminder interval in Settings)
- FR#26 — Connect Google Drive (browse, search, and attach Drive files to tasks or coach context)
- FR#27 — Connect Google Sheets and Docs (read/write Sheets for data capture; read Docs for coach context)
- FR#30 — Lazy task context — omit task list from system prompt by default; expose it as a tool the AI can call when it needs it, eliminating per-call token cost for simple interactions
- FR#32 — Include project child tasks in process-mode context — getTaskContext currently shows only the project title and metadata; child tasks (which live in the `next` bucket) are excluded by the bucket filter, so the AI can only match new inbox items against project names. Fix: when serialising a project task, inline its direct children as an indented sub-list so the AI can detect duplicates and better judge fit

#### Data model expansions

- FR#10 [GH#16] — Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)
