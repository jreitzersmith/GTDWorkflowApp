# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#11** · Code Quality — **CQ#10** · Feature Requests — **FR#36**

---

## Known issues / remaining work

- [x] ~~Issue#1 — Email Rules tab re-fetches on every visit~~ — **fixed** (c3fb23e): lifted `gmailLabels`/`gmailFilters` state into `EmailManagementView`; tab opens instantly after first load
- [ ] Issue#2 [GH#1] — Brain Dump doesn't auto-add items to inbox — user has to copy manually (Chat mode can create tasks via `→ACTION:create`, but Brain Dump mode is not wired up)
- [ ] Issue#3 [GH#2] — Weekly Review doesn't check off steps as completed
- ~~Issue#4 [GH#3] — No export or sync with Todoist~~ — **moved to FR#9**
- [ ] Issue#5 — Emails pulled from Gmail are cut short (body text truncated before end of message)
- [ ] Issue#8 — Calendar month view: day-header columns don't align with the day-cell columns below them (header and grid are separate grid containers; a scrollbar or border width difference causes them to drift out of sync)
- [ ] Issue#7 — Add & Ask AI: AI correctly parses due date and recurrence from the task text but the created task has neither field set (confirmed: AI identified next recurrence date correctly but the task was saved without dueDate or recurrence)
- [ ] Issue#11 — Calendar event creation uses today's date instead of the task's due date (task detail panel shows correct due date, but the created calendar event is pinned to the current date)
- [ ] Issue#10 — Add & Ask AI: when AI identifies a duplicate and the user confirms delete, the original inbox item is archived but a new task is still created (the confirmed action should be delete-only, not create)
- [ ] Issue#9 — Tasks with a due date do not appear in the Calendar view "tasks with due date, but no calendar event" section — not shown on first visit, nor after soft or hard refresh; root cause unknown (may be a filter, sort, or data-mapping bug in CalendarManagementView/calendarApi)
- [ ] Issue#6 — `calendarEventId` is never persisted to Supabase: missing from `taskToDb`, `dbToTask`, and the `tasks` table schema. After any Supabase sync the field is lost, so calendar-linked events immediately re-appear as unlinked in the "Calendar events without tasks" section

---

## Suggested next features (in rough priority order)

### Code quality (Senior_Code_Engineer.md gaps — prioritised above feature requests)

1. ~~CQ#1 — Async error handling~~ — **done** (26a709b): wrapped `doWebSearch`, `doGmailSearch`, `doGmailCompose`, `doGmailSend` call sites in `callAI` with `is_error` tool results.
2. CQ#2 — Component size and single responsibility — split by file:
   - ~~CQ#2a — `calendar.jsx` (830 lines)~~ — **done** (869e933): split into CalendarSuggestionsBar, CalendarManagementSections, CalendarEventDisplay, CalendarManagementView
   - ~~CQ#2b — `SettingsPanel.jsx` (760 lines)~~ — **done** (df93c016): split into SettingsSection, UsagePanel, SettingsManagerComponents, SettingsPanel (container)
   - ~~CQ#2c — `email.jsx` (711 lines)~~ — **done** (de6e25ea): split into emailUtils.js, EmailInboxPanel.jsx, EmailCleanupPanel.jsx, EmailRulesPanel.jsx; email.jsx trimmed to ~60-line tab container
   - ~~CQ#2d — `TaskDetailPanel.jsx` (624 lines)~~ — **done** (f8772d59): split into TaskListHelpers.jsx (~160 lines) and trimmed TaskDetailPanel.jsx (~490 lines); removed unused DropLine import from App.jsx
   - ~~CQ#2e — `TaskRow.jsx` (553 lines)~~ — **done** (f7c23b3): extracted `SidebarComponents.jsx` (~66 lines — BucketItem, SidebarBtn, Btn); TaskRow.jsx trimmed to ~513 lines exporting only PRIORITIES and TaskRow
   - ~~CQ#2f — `App.jsx` first pass~~ — **done** (24c17bd): extracted ErrorBoundary, ResizeHandle, AuthGate, AppSidebar, TaskBucketView, CoachPanel; App.jsx return shrunk from ~582 lines to ~220
   - ~~CQ#2g — `App.jsx` second pass (callback extraction)~~ — **done** (5 commits: 814ac63–2277d43): extracted useDragDrop, useSupabaseSync, useCallAI, useInboxProcessing, useTaskCrud, useSettings; App.jsx down from ~2,579 to ~995 lines; GTDManager is now a thin coordinator
3. ~~CQ#3 — Presentational/container separation~~ — **done** (275f250): extracted useTaskRowState and useTaskDetailDrafts; collectDescendantIds moved to taskUtils
4. ~~CQ#4 — Feature-based file structure~~ — **done** (85cf009): all files migrated to /features/tasks, /features/email, /features/calendar, /features/settings, /features/coach, /shared; gmailTools.js split into webSearch.js + gmailTools.js
5. ~~CQ#5 — Array index as key~~ — **done** (b8bdf8e): replaced index keys in AICoach, CalendarSuggestionsBar, CalendarEventDisplay, EmailRulesPanel with stable keys
6. ~~CQ#6 — Task detail panel dropdown dark text~~ — **done** (34acae2, 59968bb): `color: undefined` in Actual Effort and Category selects was overriding `fieldInput`'s `COLORS.text`, letting the browser fall back to the OS dark text; fixed to `COLORS.text` for empty state; added `colorScheme: 'dark'` to both selects
10. CQ#10 — Task detail panel location button color — inactive location buttons should be slightly lighter than their current color, but still darker than the field label color defined in CQ#9 (three-tier: field labels > inactive locations > current muted)
9. CQ#9 — Task detail panel field label color — field headers should use the same color as inactive bucket labels in the left navigation bar (currently inconsistent)
8. CQ#8 — Task detail panel field order (cont.) — move the "Based on" dropdown to just below the Orig. Due field
7. ~~CQ#7 — Task detail panel field order~~ — **done** (13873e1, c1316aa): Move to relocated below Bucket; Orig Due moved above Due; Defer moved directly below Due; Category moved above Location

### Feature requests

#### UI polish / quick wins

- FR#13 [GH#4] — Remove "Process with AI" button from the left sidebar navigation panel
- ~~FR#21 — Collapsible task list in Calendar view~~ — **done** (869e933): CalendarPendingTasksSection uses same `[open, setOpen]` toggle pattern as CalendarNewEventsSection
- ~~FR#24 — Lighten inactive buttons~~ — **done** (e838488): raised Btn idle bg surface2→surface3; added ToolbarBtn component with active/hover states; raised idle text from muted→text2
- ~~FR#12 — Dark-theme checkboxes~~ — **done** (d73354f): `StyledCheckbox` shared component added (hidden native input + styled visual div, COLORS tokens); all 6 native checkbox sites replaced; 5-test suite co-located in src/shared/

#### Daily workflow / GTD core

- FR#14 [GH#5] — Daily Review button (replaces FR#13; context-aware: shows "Start Day" in the morning or if start-of-day review hasn't run yet; shows "End Day" in the afternoon/evening or after start-of-day completes; localStorage persistence; must handle incomplete/interrupted reviews gracefully)
- FR#7 [GH#6] — Daily focus view (pick 3 Most Important Tasks from Next Actions)
- FR#15 [GH#7] — AI-assisted daily planning (new coach mode; evaluates calendar + tasks + travel time)
- FR#6 [GH#8] — Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)
- FR#33 — Search within current bucket (filter bar that narrows visible tasks by text match on title/notes; scoped to whichever bucket is active)
- FR#34 — Search across all tasks (global search spanning all buckets; results show task title, bucket, and key metadata; clicking a result opens the task detail panel)

#### Inbox / processing improvements

- FR#8 [GH#9] — Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
- ~~FR#8a — "Add & Ask AI" single-task scope~~ — **done** (8d2bdf5): singleTaskMode ref gates auto-chaining; skip loop fixed with skippedInSessionIds; Delete button added to PendingActionBar
- FR#19 [GH#10] — Inbox History / AI exposure rethink (decide policy on what the AI sees; small code change once decided)

#### Integrations / data

- ~~FR#25 [GH#11] — Email rules persistence (Supabase + localStorage optimistic cache; well-scoped)~~ — **done** (a2bb532): `useGmailRulesCache` hook; labels + filters cached in localStorage; instant load on reload
- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
- ~~FR#18 [GH#13] — Gmail rate limiting / backoff~~ — **done** (51062a9): `fetchWithBackoff` + `batchedAll`; inbox/search now fire 10 requests per chunk with 429 retry
- FR#36 — Calendar month view: day column min/max width + event title wrapping — columns without events are narrower than those with events (fix: equal column widths via minmax); event tiles should have a minimum display width (~"Vet - Teeth Cleaning") and a maximum (~"Resume study of database class"); titles exceeding max wrap to new lines (max 3 lines, no mid-word splits, ellipsis after last complete word on line 3)
- FR#35 — Calendar sync: when a task has a parent, show only the child task in the "tasks with due date, no calendar event" list (suppress the parent to avoid adding both parent and child as separate events)
- FR#22 [GH#14] — Show linked tasks in Calendar event detail
- FR#26 — Connect Google Drive (browse, search, and attach Drive files to tasks or coach context)
- FR#27 — Connect Google Sheets and Docs (read/write Sheets for data capture; read Docs for coach context)
- ~~FR#28 — Mode-aware task context filtering~~ — **done** (5e91b81): MODE_CONTEXT_BUCKETS map in useCallAI; process→inbox+project, projectReview/projectMetadata→project only, calendarEvent→next+project; getTaskContext accepts allowedBuckets param; chat/review/dump unchanged (all buckets)
- ~~FR#29 — Per-bucket task context caps~~ — **done** (e8df369): Next Actions capped at 75 (due-within-14-days first, then most-recent fill); Someday/Maybe capped at 40 most-recent; omitted count shown; parentId added to all task meta; Projects reordered depth-first with indentation
- FR#30 — Lazy task context — omit task list from system prompt by default; expose it as a tool the AI can call when it needs it, eliminating per-call token cost for simple interactions
- ~~FR#31 — Last-call inspector in Usage panel~~ — **done** (5e91b81): lastInputLog state in useCallAI captures system prompt text, user message, input token count, mode, and timestamp on each call; collapsible "Last Call" section in UsagePanel shows all fields with expandable panes and a copy button
- FR#32 — Include project child tasks in process-mode context — getTaskContext currently shows only the project title and metadata; child tasks (which live in the `next` bucket) are excluded by the bucket filter, so the AI can only match new inbox items against project names. Fix: when serialising a project task, inline its direct children as an indented sub-list so the AI can detect duplicates and better judge fit

#### Data model expansions

- ~~FR#23 [GH#15] — Project categories~~ — **done** (681a46d, 0bef2c8, 192683e):
  - ~~Phase 1 — data layer + settings UI~~ — **done** (681a46d): SQL migrations, supabase.js mappers, useAppSettings/useSettings category CRUD, CategoryManager component, Settings panel section, Supabase sync
  - ~~Phase 2 — TaskDetailPanel category dropdown + TaskRow category chip~~ — **done** (0bef2c8): category select in detail panel (hidden until categories exist); amber ◆ chip in both below/inline tag modes
  - ~~Phase 3 — Projects filter, Next Actions groupBy, AI context inclusion, child task inheritance~~ — **done** (192683e): getTaskContext adds category:X; groupByField + GROUP_OPTS get Category option; Projects toolbar gets amber filter select; ProjectTree filters at depth=0 via context; child tasks inherit parent category in useCallAI/useTaskCrud/useInboxProcessing
- FR#10 [GH#16] — Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- ~~FR#11 — Multi-device sync~~ — **done (Supabase)**
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)
