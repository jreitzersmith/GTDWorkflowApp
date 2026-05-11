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
| 2026-05-09 | Bug Fix      | Issue#9 | GH#20  | pendingTasks filter: show past-due + weekday-recurring tasks in Add to Calendar section | df6a17d |
| 2026-05-09 | Bug Fix      | Issue#11| GH#22  | Calendar push: use dueDate (not today) for non-weekday recurrences; refetch after recurring event creation | df6a17d |
| 2026-05-09 | Feature      | FR#33   | —      | In-bucket text filter — compact filter input in bucket header, flat filtered list bypassing tree/waterfall | 863847b |
| 2026-05-09 | Feature      | FR#34   | —      | Global search modal (Cmd+K) — SearchModal with keyboard nav, bucket badge, highlight; sidebar button | 35392d4 |
| 2026-05-09 | Feature      | FR#30   | —      | Lazy task context in chat mode — compact summary + get_task_context tool; full list for other modes | 0ce7e9b |
| 2026-05-11 | Bug Fix      | Issue#3 | GH#2   | Weekly Review step tracking — closed as no longer reproducible                                      | —       |
| 2026-05-11 | Bug Fix      | Issue#5 | —      | Email body truncated — extractGmailPlainText early-return replaced with full-part concatenation     | HEAD    |
| 2026-05-09 | Feature      | FR#39   | GH#35  | Drive file picker for tasks — DriveAttachments component, Picker API, drive_attachments DB column | 15e1b81 |
| 2026-05-11 | Bug Fix      | Issue#10| GH#21  | Add & Ask AI duplicate detection — expand process context to next+waiting; add →ACTION:delete duplicate rule | 4202163 |
| 2026-05-11 | Bug Fix      | Issue#2 | GH#1   | Brain Dump auto-add to inbox — dump prompt emits →ACTION:create; gate expanded to chat\|dump mode      | 13dd66a |
| 2026-05-11 | Bug Fix      | Issue#14| GH#43  | Process mode: question+action bypass — code-level ? guard in useCallAI; prompt hardened             | 024e5b1 |
| 2026-05-11 | Bug Fix      | Issue#15| GH#44  | Process mode: →ACTION:add type — place inbox item under existing project; full stack implementation | 3bd97ae |
| 2026-05-11 | Feature      | FR#48   | GH#46  | Project picker dropdown: collapsible tree (ProjectTreePicker) replaces flat native select in TaskDetailPanel + InboxBars | 6eab4a4 |
| 2026-05-11 | Bug Fix      | Issue#16| GH#47  | ProjectTreePicker: switch buildProjectTree from parentId to childIds to match project view structure | caafa98 |
| 2026-05-11 | Feature      | FR#50   | GH#49  | Remove hover auto-expand from project picker dropdowns; chevron-click only                          | 8fb66a0 |
| 2026-05-11 | Feature      | FR#51   | GH#50  | Fix Collapse All — recursively adds all descendants to collapsedNodes, not just L2                  | 8fb66a0 |
| 2026-05-11 | Feature      | FR#52   | GH#51  | Rename "≡ Projects Only" toolbar button to "≡ Project Categories"                                  | 8fb66a0 |
| 2026-05-11 | Feature      | FR#53   | GH#52  | Increase project tree depth guard to 6 levels in ProjectTree and CompletedTree                      | 8fb66a0 |
| 2026-05-11 | Feature      | FR#56   | GH#55  | Remove Review Projects button + loading/onStartProjectReview props from TaskBucketView              | 8fb66a0 |
| 2026-05-11 | Feature      | FR#58   | GH#57  | Project view: alpha sort L1 and L2 nodes                                                            | 8fb66a0 |
