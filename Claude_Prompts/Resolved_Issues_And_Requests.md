# GTD Workflow App — Resolved Issues & Feature Requests

Log every resolved known issue or completed feature request here immediately after committing.
One row per item: date · type · # · name · commit hash(es).

| Date       | Type         | #       | Name                                                              | Commit(s)         |
|------------|--------------|---------|-------------------------------------------------------------------|-------------------|
| 2026-05-07 | Code Quality | CQ#1    | Async error handling (tool-use call sites in callAI)              | 26a709b, 1e4eb8d  |
| 2026-05-07 | Code Quality | CQ#2a   | calendar.jsx split (830 lines → 4 files)                          | 869e933           |
| 2026-05-07 | Code Quality | CQ#2b   | SettingsPanel.jsx split (760 lines → 4 files)                     | df93c016          |
| 2026-05-07 | Code Quality | CQ#2c   | email.jsx split (711 lines → 4 files)                             | de6e25ea          |
| 2026-05-07 | Code Quality | CQ#2d   | TaskDetailPanel.jsx split (624 lines → 2 files)                   | f8772d59          |
| 2026-05-07 | Code Quality | CQ#2e   | TaskRow.jsx split — extract SidebarComponents                     | f7c23b3           |
| 2026-05-07 | Code Quality | CQ#2f   | App.jsx first pass — extract 6 rendering components               | 24c17bd           |
| 2026-05-08 | Code Quality | CQ#2g   | App.jsx second pass — extract 6 hooks (2,579 → 995 lines)        | 814ac63 – 2277d43 |
| 2026-05-08 | Code Quality | CQ#3    | Presentational/container separation (useTaskRowState et al)       | 275f250           |
| 2026-05-08 | Code Quality | CQ#4    | Feature-based file structure (/features/*, /shared)               | 85cf009           |
| 2026-05-08 | Code Quality | CQ#5    | Array index as key — replace with stable keys                     | b8bdf8e           |
| 2026-05-07 | Feature      | FR#8a   | "Add & Ask AI" single-task scope + skip loop + delete             | 8d2bdf5           |
| 2026-05-07 | Feature      | FR#21   | Collapsible task list in Calendar view (CalendarPendingTasksSection) | 869e933        |
| 2026-05-08 | Bug Fix      | Issue#1 | Email Rules tab re-fetches on every visit                         | c3fb23e           |
| 2026-05-08 | Feature      | FR#12   | Dark-theme checkboxes (StyledCheckbox shared component)           | d73354f           |
| 2026-05-08 | Feature      | FR#24   | Inactive button visual improvements (Btn + ToolbarBtn)            | e838488           |
| 2026-05-08 | Bug Fix      | —       | Strip stray [ ] brackets from AI coach action-line parsed values  | 0b1f8f2           |
| 2026-05-08 | Bug Fix      | —       | Expose fetchModels from useCallAI (runtime ReferenceError fix)    | 2d597ac           |
| 2026-05-08 | Infra        | —       | Add Vitest test suite — 85 tests across taskUtils, useTaskRowState, useTaskDetailDrafts | ee0ce86 |
| 2026-05-08 | Polish       | —       | Unify coach mode tabs with ToolbarBtn; move to shared/            | 2ea7a8e           |
| 2026-05-08 | Feature      | FR#25   | Email rules localStorage cache (useGmailRulesCache hook)          | a2bb532           |
| 2026-05-08 | Feature      | FR#18   | Gmail rate limiting — fetchWithBackoff + batchedAll               | 51062a9           |
| 2026-05-09 | Feature      | FR#23   | Project categories Phase 1 — data layer + settings UI             | 681a46d           |
| 2026-05-09 | Feature      | FR#23   | Project categories Phase 2 — detail panel dropdown + row chip     | 0bef2c8           |
| 2026-05-09 | Feature      | FR#23   | Project categories Phase 3 — groupBy, Projects filter, AI context, child inheritance | 192683e |
| 2026-05-09 | Code Quality | CQ#6    | Task detail panel dropdown dark text (color: undefined override + colorScheme: dark)  | 34acae2, 59968bb |
| 2026-05-09 | Code Quality | CQ#7    | Task detail panel field order (Move to, Orig Due, Defer, Category positions)          | 13873e1, c1316aa |
| 2026-05-09 | Feature      | FR#28   | Mode-aware task context filtering (MODE_CONTEXT_BUCKETS; allowedBuckets param)        | 5e91b81           |
| 2026-05-09 | Feature      | FR#31   | Last-call inspector in Usage panel (lastInputLog; system prompt + tokens)             | 5e91b81           |
| 2026-05-09 | Feature      | FR#29   | Per-bucket AI context caps + parentId + hierarchical project order                    | e8df369           |
| 2026-05-09 | Feature      | FR#22   | Linked tasks panel in Calendar event detail                       | 4c78c0b           |
| 2026-05-09 | Bug Fix      | Issue#6 | calendarEventId persisted to Supabase (taskToDb/dbToTask + ALTER TABLE) | 4c78c0b     |
| 2026-05-09 | Bug Fix      | Issue#7 | extractAction positional capture bug — due date + recurrence lost for non-project types | 5b6f0bc |
| 2026-05-09 | Bug Fix      | Issue#8 | Calendar month view header/cell column misalignment (unified grid) | 8bdb90e          |
| 2026-05-09 | Feature      | FR#36   | Calendar month view equal column widths + event chip 3-line clamp | 8bdb90e          |
| 2026-05-09 | Code Quality | CQ#8    | Task detail panel: "Base on" moved to first sub-field below Repeat toggle | 98f94f5 |
| 2026-05-09 | Code Quality | CQ#9    | Task detail panel field label color → COLORS.text2 (matches inactive sidebar buckets) | 98f94f5 |
| 2026-05-09 | Code Quality | CQ#10   | Task detail panel inactive location button color → #81807a (mid-tier between labels and muted) | 98f94f5 |
