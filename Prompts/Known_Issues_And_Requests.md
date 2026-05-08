# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#4** · Code Quality — **CQ#5** · Feature Requests — **FR#25**

---

## Known issues / remaining work

- [x] ~~Issue#1 — Email Rules tab re-fetches on every visit~~ — **fixed** (c3fb23e): lifted `gmailLabels`/`gmailFilters` state into `EmailManagementView`; tab opens instantly after first load
- [ ] Issue#2 [GH#1] — Brain Dump doesn't auto-add items to inbox — user has to copy manually (Chat mode can create tasks via `→ACTION:create`, but Brain Dump mode is not wired up)
- [ ] Issue#3 [GH#2] — Weekly Review doesn't check off steps as completed
- [ ] Issue#4 [GH#3] — No export or sync with Todoist

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

#### Inbox / processing improvements

- FR#8 [GH#9] — Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
- ~~FR#8a — "Add & Ask AI" single-task scope~~ — **done** (8d2bdf5): singleTaskMode ref gates auto-chaining; skip loop fixed with skippedInSessionIds; Delete button added to PendingActionBar
- FR#19 [GH#10] — Inbox History / AI exposure rethink (decide policy on what the AI sees; small code change once decided)

#### Integrations / data

- FR#25 [GH#11] — Email rules persistence (Supabase + localStorage optimistic cache; well-scoped)
- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
- FR#18 [GH#13] — Gmail rate limiting / backoff
- FR#22 [GH#14] — Show linked tasks in Calendar event detail

#### Data model expansions

- FR#23 [GH#15] — Project categories (user-defined; filtering/grouping across buckets; Settings UI)
- FR#10 [GH#16] — Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- FR#9 [GH#18] — Todoist export / two-way sync
- ~~FR#11 — Multi-device sync~~ — **done (Supabase)**
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)
