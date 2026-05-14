# GTD Workflow App — Resolved Issues & Feature Requests

Log every resolved known issue or completed feature request here immediately after committing.
One row per item: date · type · # · GH# · name · commit hash(es).

When an item is resolved, **remove** it from `Known_Issues_And_Requests.md` and add a full row here. Close the corresponding GitHub issue via the GitHub MCP.

| Date       | Type         | #       | GH#   | Name                                                              | Commit(s)         |
|------------|--------------|---------|-------|-------------------------------------------------------------------|-------------------|
| 2026-05-07 | Code Quality | CQ#1    | —      | Async error handling (tool-use call sites in callAI)              | 26a709b, 1e4eb8d  |
| 2026-05-07 | Code Quality | CQ#2a   | —      | calendar.jsx split (830 lines → 4 files)                          | 869e933           |
| 2026-05-07 | Code Quality | CQ#2b   | —      | SettingsPanel.jsx split (760 lines → 4 files)                     | df93c016          |
| 2026-05-07 | Code Quality | CQ#2c   | —      | email.jsx split (711 lines → 4 files)                             | de6e25ea          |
| 2026-05-07 | Code Quality | CQ#2d   | —      | TaskDetailPanel.jsx split (624 lines → 2 files)                   | f8772d59          |
| 2026-05-07 | Code Quality | CQ#2e   | —      | TaskRow.jsx split — extract SidebarComponents                     | f7c23b3           |
| 2026-05-07 | Code Quality | CQ#2f   | —      | App.jsx first pass — extract 6 rendering components               | 24c17bd           |
| 2026-05-08 | Code Quality | CQ#2g   | —      | App.jsx second pass — extract 6 hooks (2,579 → 995 lines)        | 814ac63 – 2277d43 |
| 2026-05-08 | Code Quality | CQ#3    | —      | Presentational/container separation (useTaskRowState et al)       | 275f250           |
| 2026-05-08 | Code Quality | CQ#4    | —      | Feature-based file structure (/features/*, /shared)               | 85cf009           |
| 2026-05-08 | Code Quality | CQ#5    | —      | Array index as key — replace with stable keys                     | b8bdf8e           |
| 2026-05-07 | Feature      | FR#11   | —      | Multi-device sync via Supabase (tasks + user_settings tables)     | —                 |
| 2026-05-07 | Feature      | FR#8a   | —      | "Add & Ask AI" single-task scope + skip loop + delete             | 8d2bdf5           |
| 2026-05-07 | Feature      | FR#21   | —      | Collapsible task list in Calendar view (CalendarPendingTasksSection) | 869e933        |
| 2026-05-08 | Bug Fix      | Issue#1 | —      | Email Rules tab re-fetches on every visit                         | c3fb23e           |
| 2026-05-08 | Feature      | FR#12   | —      | Dark-theme checkboxes (StyledCheckbox shared component)           | d73354f           |
| 2026-05-08 | Feature      | FR#24   | —      | Inactive button visual improvements (Btn + ToolbarBtn)            | e838488           |
| 2026-05-08 | Bug Fix      | —       | —      | Strip stray [ ] brackets from AI coach action-line parsed values  | 0b1f8f2           |
| 2026-05-08 | Bug Fix      | —       | —      | Expose fetchModels from useCallAI (runtime ReferenceError fix)    | 2d597ac           |
| 2026-05-08 | Infra        | —       | —      | Add Vitest test suite — 85 tests across taskUtils, useTaskRowState, useTaskDetailDrafts | ee0ce86 |
| 2026-05-08 | Polish       | —       | —      | Unify coach mode tabs with ToolbarBtn; move to shared/            | 2ea7a8e           |
| 2026-05-08 | Feature      | FR#25   | GH#11  | Email rules localStorage cache (useGmailRulesCache hook)          | a2bb532           |
| 2026-05-08 | Feature      | FR#18   | GH#13  | Gmail rate limiting — fetchWithBackoff + batchedAll               | 51062a9           |
| 2026-05-09 | Feature      | FR#23   | GH#15  | Project categories Phase 1 — data layer + settings UI             | 681a46d           |
| 2026-05-09 | Feature      | FR#23   | GH#15  | Project categories Phase 2 — detail panel dropdown + row chip     | 0bef2c8           |
| 2026-05-09 | Feature      | FR#23   | GH#15  | Project categories Phase 3 — groupBy, Projects filter, AI context, child inheritance | 192683e |
| 2026-05-09 | Code Quality | CQ#6    | —      | Task detail panel dropdown dark text (color: undefined override + colorScheme: dark)  | 34acae2, 59968bb |
| 2026-05-09 | Code Quality | CQ#7    | —      | Task detail panel field order (Move to, Orig Due, Defer, Category positions)          | 13873e1, c1316aa |
| 2026-05-09 | Feature      | FR#28   | —      | Mode-aware task context filtering (MODE_CONTEXT_BUCKETS; allowedBuckets param)        | 5e91b81           |
| 2026-05-09 | Feature      | FR#31   | —      | Last-call inspector in Usage panel (lastInputLog; system prompt + tokens)             | 5e91b81           |
| 2026-05-09 | Feature      | FR#29   | —      | Per-bucket AI context caps + parentId + hierarchical project order                    | e8df369           |
| 2026-05-09 | Feature      | FR#22   | GH#14  | Linked tasks panel in Calendar event detail                       | 4c78c0b           |
| 2026-05-09 | Bug Fix      | Issue#6 | GH#24  | calendarEventId persisted to Supabase (taskToDb/dbToTask + ALTER TABLE) | 4c78c0b     |
| 2026-05-09 | Bug Fix      | Issue#7 | GH#25  | extractAction positional capture bug — due date + recurrence lost for non-project types | 5b6f0bc |
| 2026-05-09 | Bug Fix      | Issue#8 | GH#26  | Calendar month view header/cell column misalignment (unified grid) | 8bdb90e          |
| 2026-05-09 | Feature      | FR#36   | GH#27  | Calendar month view equal column widths + event chip 3-line clamp | 8bdb90e          |
| 2026-05-09 | Code Quality | CQ#8    | GH#28  | Task detail panel: "Base on" moved to first sub-field below Repeat toggle | 98f94f5 |
| 2026-05-09 | Code Quality | CQ#9    | GH#29  | Task detail panel field label color → COLORS.text2 (matches inactive sidebar buckets) | 98f94f5 |
| 2026-05-09 | Code Quality | CQ#10   | GH#30  | Task detail panel inactive location button color → #81807a (mid-tier between labels and muted) | 98f94f5 |
| 2026-05-11 | Feature      | FR#49   | GH#48  | 5-level project hierarchy — implemented via FR#48, FR#53, FR#54, FR#57                              | —                 |
| 2026-05-11 | Feature      | FR#61   | GH#60  | Project view add bar: auto-select selected project-bucket item as parent                            | 40731df           |
| 2026-05-11 | Feature      | FR#6    | GH#8   | Brain Dump auto-capture (already implemented via →ACTION:create lines)                              | —                 |
| 2026-05-11 | Feature      | FR#13   | GH#4   | Remove "Process with AI" sidebar button (folded into FR#14)                                         | —                 |
| 2026-05-11 | Feature      | FR#62   | GH#61  | Projects view: re-click selected task row to deselect / close detail panel                          | 263b3bd           |
| 2026-05-11 | Feature      | FR#47   | GH#45  | Project view: show/hide completed subtasks toggle                                                   | 788cc78           |
| 2026-05-11 | Feature      | FR#60   | GH#59  | Task detail panel: project/task type toggle with demotion guard                                     | d2af3fd           |
| 2026-05-11 | Feature      | FR#14   | GH#5   | Daily Review button (Start Day / End Day) replacing Process Inbox                                   | 5ab7681           |
| 2026-05-11 | Feature      | FR#63   | GH#62  | processed flag on tasks for metadata tracking                                                        | ce93604           |
| 2026-05-11 | Feature      | FR#64   | GH#63  | SoD/EoD structured daily review workflow                                                             | a63e173           |
| 2026-05-11 | Feature      | FR#65   | GH#64  | Today's Focus sidebar view                                                                           | 7be7535           |
| 2026-05-11 | Feature      | FR#66   | GH#65  | Calendar-aware tasks in Today's Focus (no-calendar-event tier)                                       | 7be7535           |
| 2026-05-11 | Feature      | FR#67   | GH#66  | dueTime field on tasks with UI time input in TaskDetailPanel                                         | 368d0a4           |
| 2026-05-11 | Issue        | Issue#17| GH#68  | Process mode: effort and category silently dropped from ACTION lines                                  | 4408b89           |
| 2026-05-12 | Feature      | FR#7    | GH#6   | Daily focus view — Today's Focus sidebar with tier grouping and focusCount badge | 0baaeff           |
| 2026-05-12 | Feature      | FR#15   | GH#7   | AI-assisted daily planning — SoD/EoD coach mode with MIT picker                  | 0baaeff           |
| 2026-05-12 | Bug fix      | —       | —      | standaloneProjectId not passed to useSupabaseSync → TypeError on hard refresh    | 045af85           |
| 2026-05-12 | Bug fix      | —       | —      | Daily review called switchCoachMode (static msg) instead of callAI → no MIT step | e4455be           |
| 2026-05-12 | Bug fix      | —       | —      | MIT picker alreadySet guard blocked picker on same-day re-runs                   | c7888a8           |
| 2026-05-12 | Bug fix      | —       | —      | effortToMinutes not imported in App.jsx → startDailyReview silently crashed      | 14eb862           |
| 2026-05-12 | Bug fix      | —       | —      | setCurrentView missing from SoD branch of startDailyReview                       | 649f3f9           |
| 2026-05-12 | Bug fix      | —       | —      | Process mode effort/category absent from ACTION format examples                  | ac0768d           |
| 2026-05-12 | Bug fix      | —       | —      | AI re-emit instruction for effort/fields on second turn answers                  | 99cbca7           |
| 2026-05-12 | Bug fix      | —       | —      | Effort label normalization + always emit label list in calibration context        | e6094ba           |
| 2026-05-12 | Feature      | FR#69   | GH#69  | Process mode sibling category inference — confirmed working, prompt already had instruction | ac0768d           |
| 2026-05-12 | Feature      | FR#19   | GH#10  | Inbox History AI exposure — policy decided: inboxHistory excluded from all AI context       | —                 |
| 2026-05-12 | Feature      | FR#32   | GH#71  | Inline next/waiting children under project tasks in process-mode AI context      | f0f8f3d           |
| 2026-05-12 | Feature      | FR#35   | GH#23  | Suppress due-date parents from no-cal-event list when children have due dates    | f0f8f3d           |
| 2026-05-12 | Feature      | FR#37   | GH#31  | Configurable calendar reminder interval in Settings; threaded to API create call  | f0f8f3d           |
| 2026-05-12 | Feature      | FR#71   | GH#72  | Expand metadata review to 8 fields + extractMetadata indexOf fix                 | 4d7a01b           |
| 2026-05-12 | Feature      | FR#73   | GH#73  | Enrich project routing context with sample child task titles                     | 4d7a01b           |
| 2026-05-12 | Bug fix      | —       | —      | Metadata review AI uses task names in prose, not IDs                             | 63b8fd1           |
| 2026-05-12 | Feature      | FR#74   | GH#74  | Constrain metadata review location suggestions to configured locations list      | b3f93c9           |
| 2026-05-12 | Feature      | FR#75   | GH#75  | Rename Processed label to Reviewed for all task types in TaskDetailPanel         | b35009f           |
| 2026-05-12 | Feature      | FR#76   | GH#76  | Review Configuration settings — control which nodeTypes appear in Project Review | 7ec9bfa           |
| 2026-05-12 | Code Quality | CQ#11   | GH#77  | Rename `processed` field → `reviewed` throughout codebase (DB col, mappers, contexts, handlers) | d773f4a           |
| 2026-05-12 | Bug fix      | Issue#12| GH#32  | Process mode: swap defer→due when user overrides AI deferral assumption                          | a0a3a13           |
| 2026-05-12 | Bug fix      | Issue#13| GH#33  | Clear stale deferUntil in buildNextOccurrence; prompt omits defer for recurring tasks             | a0a3a13           |
| 2026-05-12 | Feature      | FR#8    | GH#9   | Inbox group suggestion: fire suggestProjectGroup after session creates 2+ action tasks            | 6a227d3           |
| 2026-05-12 | Feature      | FR#40   | GH#36  | Gmail email → task linking: attach email as driveAttachments entry with 📧 rendering             | 6a227d3           |
