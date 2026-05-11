# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#16** · Code Quality — **CQ#10** · Feature Requests — **FR#61**

---

## Known issues / remaining work

- [ ] Issue#12 [GH#32] (2026-05-09) — Process mode: AI does not assign due date when user corrects a deferral assumption mid-conversation (task filed without dueDate after user overrides AI's proposed defer date)
- [ ] Issue#13 [GH#33] (2026-05-09) — AI sets incorrect deferUntil on weekday-recurring tasks (defers to day after first calendar occurrence instead of next recurrence date)

---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins

- FR#13 [GH#4] — Remove "Process with AI" button from the left sidebar navigation panel
- FR#47 [GH#45] (2026-05-11) — Project view: toggle to show/hide completed subtasks
- FR#60 [GH#59] (2026-05-11) — Task detail panel: subproject/task bucket toggle (visible in Projects view only); warn/block demotion of nodes with project-bucket children
- FR#61 [GH#60] (2026-05-11) — Project view add bar: auto-select the currently selected project-bucket item as default parent in ProjectTreePicker; revert to __new__ when selection is cleared or is bucket:next

#### Daily workflow / GTD core

- FR#14 [GH#5] — Daily Review button (replaces FR#13; context-aware: shows "Start Day" in the morning or if start-of-day review hasn't run yet; shows "End Day" in the afternoon/evening or after start-of-day completes; localStorage persistence; must handle incomplete/interrupted reviews gracefully)
- FR#7 [GH#6] — Daily focus view (pick 3 Most Important Tasks from Next Actions)
- FR#15 [GH#7] — AI-assisted daily planning (new coach mode; evaluates calendar + tasks + travel time)
- FR#6 [GH#8] — Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)

#### Inbox / processing improvements

- FR#8 [GH#9] — Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
- FR#19 [GH#10] — Inbox History / AI exposure rethink (decide policy on what the AI sees; small code change once decided)

#### Integrations / data

- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
- FR#35 [GH#23] — Calendar sync: when a task has a parent, show only the child task in the "tasks with due date, no calendar event" list (suppress the parent to avoid adding both parent and child as separate events)
- FR#37 [GH#31] (2026-05-09) — Calendar event creation: set default notification(s) on created events (simplest: pass `useDefault: true` to Google Calendar API; stretch: configurable reminder interval in Settings)
- FR#32 — Include project child tasks in process-mode context — getTaskContext currently shows only the project title and metadata; child tasks (which live in the `next` bucket) are excluded by the bucket filter, so the AI can only match new inbox items against project names. Fix: when serialising a project task, inline its direct children as an indented sub-list so the AI can detect duplicates and better judge fit
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#40 [GH#36] (2026-05-09) — Gmail attachment linking — in EmailManagementView, let user attach a Gmail message or its attachments to a task as a Drive reference
- FR#41 [GH#37] (2026-05-09) — Doc capture from coach — coach action `→ACTION:create-doc` creates a Google Doc from coach output and links it back to a task or project
- FR#42 [GH#38] (2026-05-09) — Weekly Review auto-doc — at end of Weekly Review, offer to save the full review transcript as a dated Google Doc in a configurable Drive folder
- FR#43 [GH#39] (2026-05-09) — AI Coach creates Docs/Sheets/Slides — coach actions `→ACTION:create-sheet` and `→ACTION:create-slides` scaffold new files from coach conversation
- FR#44 [GH#40] (2026-05-09) — Slides briefing from tasks — generate a Google Slides briefing deck from a selected project or set of Next Actions; one slide per task or milestone
- FR#45 [GH#41] (2026-05-09) — Unified Drive/Docs/Sheets search — search bar in coach or task panel that queries Drive full-text and returns matching files as context or task attachments
- FR#46 [GH#42] (2026-05-09) — Receipt-to-Sheets pipeline — forward a receipt email to the app; AI extracts vendor/amount/date and appends a row to a designated Google Sheet
- FR#59 [GH#58] (2026-05-11) — AI coach Drive search tool — `search_drive` tool in useCallAI.js using Drive API `files.list` full-text search; coach can surface Drive files in conversation and offer to attach them to tasks; relates to FR#45 (UI search bar) but is AI tool-use access

#### Data model expansions

- FR#49 [GH#48] (2026-05-11) — 5-level project hierarchy: general categories (L1, bucket:project) → project categories (L2, bucket:project) → projects (L3, bucket:project) → tasks (L4, bucket:next) → subtasks (L5, bucket:next); requires moveTaskInTree bucket preservation, addProjectTask childBucket param, Projects add bar tree picker, groupByField nearest-project walk
- FR#10 [GH#16] — Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)
