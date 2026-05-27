# GTD Workflow App — Resolved Issues & Feature Requests

Log every resolved known issue or completed feature request here immediately after committing.
One row per item: date · type · # · GH# · name · commit hash(es).

When an item is resolved, **remove** it from `Backlog.md` and add a full row here. Close the corresponding GitHub issue via the GitHub MCP.

| Date       | Type         | #       | GH#   | Name                                                              | Commit(s)         |
| 2026-05-22 | Feature      | FR#116  | GH#132 | Process inbox: emit action immediately, remove OK confirmation step | f21eb22 |
| 2026-05-22 | Feature/Fix  | —       | —     | Coach mode improvements: action alignment (next/someday/waiting), weekly review auto-apply + batch capture, metadata parsing, MITPicker two-phase UI, SoD urgency note hidden from bubble | 6b0bb21, ce93de2 |
| 2026-05-22 | Bug Fix      | —       | —     | MITPicker — remove up/down reorder feature, add 32px bottom padding so Continue button is always visible | 1cbfa0a |
| 2026-05-23 | Feature      | FR#120  | GH#139 | Analytics: task throughput 8-week trend with prior/current 4-week callout tiles | 0ec5e74 |
| 2026-05-23 | Feature      | FR#121  | GH#140 | Analytics: project health signals (stalled, all-waiting, inactive) | 0ec5e74 |
| 2026-05-23 | Feature      | FR#123  | GH#142 | Analytics: effort accuracy by month (6-period) and by project | 0ec5e74 |
| 2026-05-23 | Feature      | FR#124  | GH#143 | Analytics: context/location utilization chart | 0ec5e74 |
| 2026-05-23 | Feature      | FR#125  | GH#144 | Analytics: Someday/Maybe decay detection with live threshold input | 0ec5e74 |
| 2026-05-23 | Feature      | FR#127  | GH#146 | Analytics layout configurability — reorder, collapse, hide sections; localStorage persistence | a8ffe4a |
| 2026-05-23 | Feature      | FR#122  | GH#141 | Bucket aging — age badge on Waiting For/Someday/Deferred tasks, sort-by-age, oldest-task summary bar | de9dd10 |
| 2026-05-23 | Feature      | FR#126  | GH#145 | Defer patterns — chronic-deferred badge on task rows (≥3 defers), top-deferrers list in analytics | 5ca9d8e |
| 2026-05-26 | Feature      | FR#117  | GH#133 | Allow combined task+calendar actions in one coach reply; hoist workingTasks; replace setTasks(prev=>) in calendar block; relax system prompt + duplicate-guard note | ed40ccc |
|------------|--------------|---------|-------|-------------------------------------------------------------------|-------------------|
| 2026-05-21 | Bug Fix | Issue#32 | GH#131 | Daily Review non-functional — nav away, blank chat, no focus-view post-MIT | e9f370e3 |
| 2026-05-20 | Bug Fix | Issue#31 | GH#130 | Multiple →ACTION:create lines in one reply — only first task created; regex lookahead fix | ec641b9a |
| 2026-05-20 | Bug Fix | Issue#30 | GH#128 | Coach/user names not reflected in chat avatars or exports — threaded coachName/userName through ChatBubble and exportUtils | 3db965b9 |
| 2026-05-20 | Bug Fix | Issue#29 | GH#126 | PendingActionBar missing Effort for project-type actions — added 'project' to showEffort list | f1c1baec |
| 2026-05-20 | Feature | FR#114 | GH#127 | PendingActionBar category — collapsible dropdown matching ProjectSelector pattern | f1c1baec |
| 2026-05-19 | Bug Fix | Issue#26 | GH#123 | Process mode category not re-derived when user corrects routing — prompt rule added to Step 4 | 37017f54 |
| 2026-05-19 | Bug Fix | Issue#27 | GH#124 | Group suggestion fires for add-type tasks already under parent projects — removed push from add branch | 37017f54 |
| 2026-05-19 | Bug Fix | Issue#28 | GH#125 | PendingActionBar category only showed pre-filled option — replaced input+datalist with select | 37017f54 |
| 2026-05-19 | Feature | FR#111 | GH#119 | Task ID visible in TaskDetailPanel — monospace id: display above footer, userSelect:all | a0e9a016 |
| 2026-05-19 | Feature | FR#112 | GH#120 | Global search by task ID — SearchModal matches t.id.startsWith(q) | a0e9a016 |
| 2026-05-19 | Bug Fix | Issue#25 | GH#121 | →ACTION:add silently dropped in process mode — extractAddAction wired as 3rd fallback in non-streaming dispatch; priority: field parsing added | a0e9a016 |
| 2026-05-19 | Feature | FR#113 | — | Process mode OK quick-reply button — sendChatWithText bypasses chatInput closure; OK button in CoachPanel visible when awaiting Step 3a | a0e9a016 |
| 2026-05-19 | Bug Fix | Issue#24 | — | Process mode routing ambiguity freeze — coach now proceeds to Step 3a with best-guess; pre-3a questions only for truly uninterpretable items | a0e9a016 |
| 2026-05-19 | Bug Fix | — | — | location: field missing from →ACTION:add and →ACTION:next format lines — parser supported it, prompt didn't document it; both lines updated | a0e9a016 |
| 2026-05-18 | Bug Fix | Issue#22 | GH#102 | Weekly Review question guard + update action support — guard narrowed to last line only; extractUpdateAction wired for review mode; getTaskContext someday/waiting flag filters fixed; inbox archiving side-effect removed; chatHistory seeded on review start | 80a2abb3 |
| 2026-05-18 | Feature | FR#23 | GH#15 | Categories filter dropdown on all main views — shared select in TaskBucketView; replaces Projects-only control; includes "No category assigned" option | ae1d47a8 |
| 2026-05-18 | Feature | FR#106 | GH#114 | Location filter dropdown on all main views — alongside Categories; filter logic task.location?.includes(); includes "No location assigned" option | ae1d47a8 |
| 2026-05-18 | Feature | FR#107 | GH#115 | Next Actions groupBy condensed to single select dropdown — replaces ToolbarBtn row; no logic change | ae1d47a8 |
| 2026-05-18 | Feature | FR#108 | GH#116 | Waiting For filter controls — text search always visible on main views; Category + Location dropdowns added | ae1d47a8 |
| 2026-05-18 | Feature | FR#96 | GH#101 | Drive folder settings per action type — DriveFolderPicker (custom modal browser, path labels, backup folder), Backup to Drive button, Conversation Export destination display | 91a61fbf |
| 2026-05-18 | Feature | FR#59 | GH#58 | AI coach drive_search tool — DRIVE_SEARCH_TOOL in useCallAI.js; plain-text query normalisation | 91a61fbf |
| 2026-05-18 | Feature | FR#99 | GH#105 | AI coach get_drive_file tool — GET_DRIVE_FILE_TOOL; exports Docs/Sheets/Slides content as text for chat context | 91a61fbf |
| 2026-05-18 | Feature | FR#104 | GH#112 | User location settings — city/home/work in Settings; [User Location] injected into all AI system prompts | 131675e3 |
| 2026-05-18 | Feature | FR#110 | GH#118 | deferCount field — tracks times deferred; badge in TaskDetailPanel; Deferral frequency chart in Analytics; Supabase migration applied | 551f4c4d |
| 2026-05-18 | Feature | FR#100 | GH#107 | Task analytics charts — bucket bar chart, 12-week completions, effort accuracy (under/on/over) | c340b001 |
| 2026-05-18 | Feature | FR#102 | GH#109 | Raw API tool call export as JSON — rawApiThread state, buildJsonExport, 2×2 format grid in ExportPopover | c84a80377 |
| 2026-05-17 | Feature | FR#90 | GH#95 | Notes field append — notes_append: action field in extractUpdateAction + useCallAI.js | d056665f |
| 2026-05-17 | Feature | FR#95 | GH#100 | create-sheet column selector — columns: param in parseSheetTabs + buildSheetData | d056665f |
| 2026-05-15 | Bug Fix | — | — | Magic link hash (#access_token) not processed in useSupabaseAuth — session silently dropped on redirect | c703b1f |
| 2026-05-15 | Bug Fix | — | — | Gmail rules race condition — Rules panel fetched from Gmail before Supabase read settled | c8e49051 |
| 2026-05-15 | Feature | FR#25 | GH#11 | Gmail rules persistence — user_settings.gmail_rules JSONB, Supabase read/write in useGmailRulesCache | 7bde4dc |
| 2026-05-15 | Feature | FR#88 | GH#93 | Notes field propagated through all action parsers (add/create/next/process) | 846f1c4 |
| 2026-05-15 | Feature | FR#10 | GH#16 | Recurring tasks — direct UI (RecurrenceEditor in TaskDetailPanel) | already implemented, verified live |
| 2026-05-15 | Feature | FR#18 | GH#13 | Gmail rate limiting / backoff (fetchWithBackoff + batchedAll in gmailTools.js) | already implemented, verified in code |
| 2026-05-15 | Feature | FR#22 | GH#14 | Show linked tasks in Calendar event detail (LinkedTasksSection in EventDetailPanel) | already implemented, verified live |
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
| 2026-05-12 | Feature      | FR#40   | GH#36  | Gmail email → task linking: attach email to task via link-to-task picker | ec0cd31 |
| 2026-05-13 | Feature      | FR#78   | GH#79  | Link to Task picker uses ProjectTreePicker collapsible tree (EmailInboxPanel)    | 55a7b1a           |
| 2026-05-13 | Bug Fix      | Issue#18| GH#80  | Remove stale setTaskFilter call in handleLinkToTask; bump confirm timeout 4000ms | b135446           |
| 2026-05-13 | Feature      | FR#79   | GH#81  | Link to Task picker: Waiting For and Someday/Maybe as collapsible sections       | b135446           |
| 2026-05-13 | Feature      | FR#80   | GH#82  | Link to Task picker: include empty containers regardless of done status          | b135446           |
| 2026-05-13 | Bug Fix      | Issue#19| GH#83  | Link to Task picker: containers missing when bucket not next/project             | b0d106e           |
| 2026-05-13 | Feature      | FR#81   | GH#84  | Link to Task picker: alphabetical sort (sorted prop on ProjectTreePicker)        | b0d106e           |
| 2026-05-13 | Bug Fix      | Issue#20| GH#85  | buildProjectTree: sorted param missing from signature (ReferenceError on picker load) | 22b8219           |
| 2026-05-13 | Bug Fix      | Issue#21| GH#86  | Email picker: project-type tasks in Waiting/Someday not visible                       | e2c620b           |
| 2026-05-13 | Feature      | FR#82   | GH#87  | Type field in Waiting For / Someday/Maybe / Deferred task detail panel                | 8d8c3a3           |
| 2026-05-13 | Feature      | FR#83   | GH#88  | Email link-to-task picker opens upward (maxHeight 320px)                              | 8d8c3a3           |
| 2026-05-13 | Feature      | FR#84   | GH#89  | Convert Waiting For / Someday/Maybe to flag-based filter views with full hierarchy | 62404ec           |
| 2026-05-13 | Feature      | FR#85   | GH#90  | Deferred view — full parent hierarchy via ProjectTree + visibilitySet             | 676a1ba           |
| 2026-05-13 | Feature      | FR#87   | GH#92  | Next Actions as filter view (isNextAction flag) + Projects toolbar Sort/Display popovers | 109c29b           |
| 2026-05-13 | Feature      | FR#88a  | GH#93  | Email processing: change completion message from "Inbox is clear" to "All items processed" | ec0cd31 |
| 2026-05-13 | Bug Fix      | —       | —      | handleConfirmMove: chat pending actions (→ACTION from coach) failed silently when inbox was empty | d29826b |
| 2026-05-13 | Feature      | FR#88b  | GH#93  | Sidebar: Projects moved before Next Actions; coach mode dropdown; Today's Focus collapsible tiers + tag display; effort group dedup | ec0cd31 |
| 2026-05-13 | Feature      | FR#77   | GH#78  | Process mode: editable metadata panel in pending action bar | 73e77fb           |
| 2026-05-14 | Feature      | FR#86   | GH#91  | Keyboard navigation: ↑↓/jk focus, Enter opens detail, ←→ collapse/expand, Escape clears | 568db30 |
| 2026-05-14 | Feature      | FR#89   | GH#94  | Global keyboard shortcuts (17 shortcuts, configurable modifier, shortcut map, Archived rename, emoji alignment) | 9fdf9fd |
| 2026-05-16 | Feature      | FR#45   | GH#41  | Drive full-text search bar in TaskDetailPanel DriveAttachments section | ec3c80a |
| 2026-05-16 | Feature      | FR#42   | GH#38  | Weekly Review Save to Drive button; reviewDriveFolderId setting in SettingsPanel + useAppSettings | ec3c80a |
| 2026-05-16 | Feature      | FR#41   | GH#37  | →ACTION:create-doc handler in useCallAI; creates Google Doc from coach output, links to task | ec3c80a |
| 2026-05-16 | Feature      | FR#43   | GH#39  | →ACTION:create-sheet and →ACTION:create-slides handlers in useCallAI; coach prompt updated | ec3c80a |
| 2026-05-16 | Feature      | FR#44   | GH#40  | SlidesGenerator component in TaskDetailPanel: slides briefing button on project tasks | ec3c80a |
| 2026-05-17 | Feature      | —       | —      | pptxApi.js: dark slate theme (DARK_BG/TITLE_BAR palette, cover + content slide builders) | 5b74ede |
| 2026-05-17 | Feature      | —       | —      | docsApi.js: docsAppendMarkdown — native Docs formatting (headings, bullets, bold/italic via batchUpdate) | 5b74ede |
| 2026-05-17 | Bug Fix      | Issue#23| GH#108 | create-sheet: AI listed tasks instead of emitting ACTION when date range specified; add applyTaskFilters shared utility with 11 filter params | 14b2a01 |
| 2026-05-18 | Feature | FR#103 | GH#111 | ExportPopover inline format selector; 'User messages' label unification | 6083b8c9 |
| 2026-05-18 | Feature      | FR#98   | GH#104 | Configurable AI coach name and user display name — threaded into all system prompts | 4588ad5 |
| 2026-05-18 | Feature      | FR#105  | GH#113 | AI coach get_weather tool (OpenWeatherMap) — current + forecast, userCity default   | f0ec825 |
| 2026-05-21 | Feature      | FR#116  | GH#132 | Process inbox: emit action immediately, remove OK confirmation step | f21eb22 |
| 2026-05-22 | Code Quality | CQ#13   | GH#135 | constants.jsx: add STORAGE_BUCKETS / VIRTUAL_VIEWS exports to document storage vs virtual view distinction | 69cc156 |
| 2026-05-22 | Code Quality | CQ#12   | GH#134 | exportUtils.js: fix task list grouping — flag-based TASK_VIEW_FILTERS replace bucket-value matching | c08c9ef |
| 2026-05-22 | Code Quality | CQ#14   | GH#136 | taskUtils.jsx: fix waterfallFilter (isNextAction); remove dead bucket=next drag-drop branch | cd46d13 |
| 2026-05-22 | Feature | FR#118 | GH#137 | Hierarchical export — section checkboxes in export popover, per-view default sections, buildHierarchicalExportContent | 782677f |
| 2026-05-23 | Bug Fix      | Issue#33 | GH#147 | Analytics task counter double-count fixed in buildBucketStats | 3e88e3b |
| 2026-05-23 | Code Quality | CQ#15    | GH#148 | Hide done-circle on category/subcategory rows in project list | eaa52d6 |
| 2026-05-26 | Feature      | FR#115  | GH#129 | Google Contacts integration — peopleApi.js wrapper, contacts.readonly scope, Settings toggle, contacts_lookup coach tool | f8cd96a |
| 2026-05-26 | Feature      | FR#128  | GH#149 | Coach gmail_send: expand scope gate to modify/compose/send; confirmation step via PendingActionBar before sending | 0ebf197 |
