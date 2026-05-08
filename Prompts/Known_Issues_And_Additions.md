# GTD Workflow App — Known Issues & Planned Additions

## Known issues / remaining work
- [x] ~~Email Rules tab re-fetches on every visit~~ — **fixed** (c3fb23e): lifted `gmailLabels`/`gmailFilters` state into `EmailManagementView`; tab opens instantly after first load
- [ ] Brain Dump doesn't auto-add items to inbox — user has to copy manually (Chat mode can create tasks via `→ACTION:create`, but Brain Dump mode is not wired up)
- [ ] Weekly Review doesn't check off steps as completed
- [ ] No export or sync with Todoist
- [x] ~~Tasks only persist in localStorage~~ — **Supabase backend implemented** with real-time cross-device sync

## Suggested next features (in rough priority order)

### Code quality (Senior_Code_Engineer.md gaps — prioritised above product features)
1. ~~[CODE QUALITY] Async error handling~~ — **done** (26a709b): wrapped `doWebSearch`, `doGmailSearch`, `doGmailCompose`, `doGmailSend` call sites in `callAI` with `is_error` tool results.
2. [CODE QUALITY] Component size and single responsibility — split by file:
   - ~~2a. `calendar.jsx` (830 lines)~~ — **done** (see commit): split into CalendarSuggestionsBar, CalendarManagementSections, CalendarEventDisplay, CalendarManagementView
   - ~~2b. `SettingsPanel.jsx` (760 lines)~~ — **done** (df93c016): split into SettingsSection, UsagePanel, SettingsManagerComponents, SettingsPanel (container)
   - ~~2c. `email.jsx` (711 lines)~~ — **done** (de6e25ea): split into emailUtils.js, EmailInboxPanel.jsx, EmailCleanupPanel.jsx, EmailRulesPanel.jsx; email.jsx trimmed to ~60-line tab container
   - ~~2d. `TaskDetailPanel.jsx` (624 lines)~~ — **done** (f8772d59): split into TaskListHelpers.jsx (~160 lines) and trimmed TaskDetailPanel.jsx (~490 lines); removed unused DropLine import from App.jsx
   - ~~2e. `TaskRow.jsx` (553 lines)~~ — **done** (f7c23b3): extracted `SidebarComponents.jsx` (~66 lines — BucketItem, SidebarBtn, Btn); TaskRow.jsx trimmed to ~513 lines exporting only PRIORITIES and TaskRow
   - ~~2f. `App.jsx` first pass~~ — **done** (24c17bd): extracted ErrorBoundary, ResizeHandle, AuthGate, AppSidebar, TaskBucketView, CoachPanel; App.jsx return shrunk from ~582 lines to ~220.
   - ~~2g. `App.jsx` second pass (callback extraction)~~ — **done** (5 commits: 814ac63–2277d43): extracted useDragDrop, useSupabaseSync, useCallAI, useInboxProcessing, useTaskCrud, useSettings; App.jsx down from ~2,579 to ~995 lines; GTDManager is now a thin coordinator.
3. ~~[CODE QUALITY] Presentational/container separation~~ — **done** (275f250): extracted useTaskRowState and useTaskDetailDrafts; collectDescendantIds moved to taskUtils.
4. ~~[CODE QUALITY] Feature-based file structure~~ — **done** (85cf009): all files migrated to /features/tasks, /features/email, /features/calendar, /features/settings, /features/coach, /shared; gmailTools.js split into webSearch.js + gmailTools.js.
5. ~~[CODE QUALITY] Array index as key~~ — **done** (b8bdf8e): replaced index keys in AICoach, CalendarSuggestionsBar, CalendarEventDisplay, EmailRulesPanel with stable keys.

### Product features
6. Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)
7. Daily focus view (pick 3 Most Important Tasks from Next Actions)
8. Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
~~8a. "Add & Ask AI" single-task scope~~ — **done** (8d2bdf5): singleTaskMode ref gates auto-chaining; skip loop fixed with skippedInSessionIds; Delete button added to PendingActionBar.
9. Todoist export / two-way sync
10. Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
11. ~~Multi-device sync~~ — **done (Supabase)**
~~12. Dark-theme checkboxes~~ — **done** (d73354f): `StyledCheckbox` shared component added (hidden native input + styled visual div, COLORS tokens); all 6 native checkbox sites replaced across CalendarSuggestionsBar, AICoach, TaskDetailPanel, TaskRow; 5-test suite co-located in src/shared/
13. Remove "Process with AI" button from the left sidebar navigation panel
14. Daily Review button (replaces "Process with AI" in sidebar) — context-aware: shows "Start Day" in the morning or if the start-of-day review hasn't run yet that calendar day; shows "End Day" in the afternoon/evening or after start-of-day completes. Button label/icon changes to reflect state. Must handle incomplete/interrupted start-of-day reviews gracefully. Persist daily review state (last run date + phase) in localStorage.
