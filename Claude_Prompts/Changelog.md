# GTD Workflow App — Resolved Issues & Feature Requests

Log every resolved known issue or completed feature request here immediately after committing.
One row per item: date · type · # · GH# · name · commit hash(es).

When an item is resolved, **remove** it from `Backlog.md` and add a full row here. Close the corresponding GitHub issue via the GitHub MCP.

| Date       | Type         | #       | GH#   | Name                                                              | Commit(s)         |
| 2026-06-01 | Bug Fix | Issue#42 | GH#210 | AI subcategory creation — extractAddAction nodeType parser + useCallAI handler + Chat/Process prompt guidance for nodeType:subcategory | 4f6c496 |
| 2026-05-31 | Feature | FR#175 | GH#206 | Email inbox server-side Gmail search on Enter — doGmailFetchInbox searchQuery param; serverSearchActive state; Enter triggers API call; hint, toolbar result count, ↻/✕ reset | 00063ce |
| 2026-05-31 | Feature | FR#171 | GH#202 | Contact list row: ✉ email count badge + hover enrichment expansion (open promises, gift ideas, linked tasks, last email date) | 2620897 |
| 2026-05-31 | Feature | FR#172 | GH#203 | Email inbox search/filter — client-side filter over loaded emails by from/subject/snippet; clear button; empty state | 2620897 |
| 2026-05-31 | Feature | FR#173 | GH#204 | Contact favorites — is_favorite BOOLEAN column; ★ toggle on ContactRow; Favorites section at top of contact list; toggleFavorite in useContacts | 2620897, 7e01f80 |
| 2026-05-31 | Feature | FR#174 | GH#205 | Email pane: manual link-to-contact button; ContactPickerInline component; calls addContactEmail; confirmation flash; dedup by messageId | 2620897, 7e01f80 |
| 2026-05-31 | Feature | FR#159 | GH#190 | Contact email history: schema + data layer (email_history JSONB column, supabase.js, contactsUtils.js mappers, addContactEmail with dedup) | 538f41d |
| 2026-05-31 | Feature | FR#160 | GH#191 | Contact email history: EmailHistorySection in ContactDetail — direction badge, subject, date, snippet, click opens Gmail thread | 538f41d |
| 2026-05-31 | Feature | FR#161 | GH#192 | Contact email history: auto-link on processEmailWithAI — sender matched to contact by email address, silent background operation | 97ffd1f |
| 2026-05-31 | Feature | FR#162 | GH#193 | Contact email history: passive auto-link on EmailInboxPanel inbox load | 97ffd1f |
| 2026-05-31 | Feature | FR#163 | GH#194 | Contact email linking mode setting — radio group (both/onProcess/onLoad/off) in Settings > Contacts via useAppSettings + SettingsManagerComponents | 538f41d |
| 2026-05-31 | Feature | FR#164 | GH#195 | Contact Drive file attachments — drive_attachments JSONB column, DriveFilesSection with Google Picker; multi-file batch fix | 538f41d, 31a8174 |
| 2026-05-31 | Feature | FR#165 | GH#196 | Contact analytics: AnalyticsArea tab bar (Tasks/Contacts); ContactAnalyticsView scaffold; contactAnalyticsConfig; contactAnalyticsUtils | 97ffd1f |
| 2026-05-31 | Feature | FR#166 | GH#197 | Contact analytics: Network Overview section — contact count, tag distribution bars, enrichment coverage chips | 97ffd1f |
| 2026-05-31 | Feature | FR#167 | GH#198 | Contact analytics: Promise Health section — open/overdue cross-contact promises, configurable threshold | 97ffd1f |
| 2026-05-31 | Feature | FR#168 | GH#199 | Contact analytics: Promise Completion Rate section — made/received bars, you-owe/they-owe top-5 lists | 97ffd1f |
| 2026-05-31 | Feature | FR#169 | GH#200 | Contact analytics: Interaction Recency section — at-risk contacts, recently active, volume chart; empty state pre-email-history | 97ffd1f |
| 2026-05-31 | Feature | FR#170 | GH#201 | Contact analytics: Gift Pipeline section — ungiven gifts grouped by contact, navigate-to-contact; 16 unit tests for all analytics util functions | 97ffd1f |
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
| 2026-05-27 | Feature      | FR#119  | GH#138 | User-editable export templates — {{variable}} substitution; ExportTemplateEditor with formatting toolbar, variable chips, live format-aware preview; localStorage + Supabase persistence | fee84a3 |
| 2026-05-27 | Bug Fix      | Issue#34 | GH#150 | RTF export unicode encoding — escRtf now encodes non-ASCII chars as \\uN? RTF Unicode escapes; strips emoji surrogates as ?; adds \\ansicpg1252 to RTF header | 23d563f |
| 2026-05-27 | Code Quality | CQ#16    | GH#152 | waterfallFilter test mock data corrected — bucket:'next' replaced with bucket:'project'+isNextAction:true; 1 failing test now passes for the right reason | 0824601 |
| 2026-05-29 | Bug Fix      | Issue#35 | GH#169 | ContactsPanel crash — mergeOrphanIntoContact and deleteOrphanContact missing from props destructure; added to ContactsPanel.jsx | fb5e29e |
| 2026-05-29 | Feature      | FR#146   | GH#171 | Received promise auto-task: routes to Inbox (not Projects) with isWaitingFor flag (Part 1); createInboxTask bucket changed from 'project' to 'inbox' in App.jsx | e557a83 |
| 2026-05-29 | Feature      | FR#147   | GH#172 | Made promise "new task" title format: "[text] — Promised to [ContactName]" replaces "[text] - [ContactName]" | e557a83 |
| 2026-05-29 | Bug Fix      | Issue#36 | GH#174 | Orphan merge data loss — updateCustomFields now re-throws on Supabase error; mergeOrphanIntoContact aborts early if enrichment write fails; orphan row preserved until target write succeeds | 7fb1ce8 |
| 2026-05-29 | Bug Fix      | Issue#37 | GH#176 | contactToDb partial-object enrichment wipe — enrichment fields changed from ?? defaults to 'key' in contact presence checks; single-field saves no longer zero all other enrichment columns | 149fa9a |
| 2026-05-29 | Feature      | FR#136   | GH#160 | Task picker in promises filters to active tasks only (excludes done/archived/inboxHistory) | 9b38dba |
| 2026-05-29 | Feature      | FR#137   | GH#161 | Linked task title on promise: clickable link to task + clear-link (×) button | 9b38dba |
| 2026-05-29 | Feature      | FR#138   | GH#162 | "Create new Inbox task" from promise includes contact name in title | 9b38dba |
| 2026-05-29 | Feature      | FR#143   | GH#167 | Clear (×) button on contact list filter text input | 9b38dba |
| 2026-05-29 | Feature      | FR#148   | GH#173 | Bidirectional task↔promise sync: task done/undo → promise.done toggle; onTaskDoneChanged callback in useTaskCrud | 02255a6 |
| 2026-05-29 | Feature      | FR#145   | GH#170 | Gift-task reverse sync: task done/undo → gift.given toggle (bidirectional) | 02255a6 |
| 2026-05-29 | Feature      | FR#149   | GH#175 | Contact link on task: contact_id FK on tasks; TaskDetailPanel shows Contact row; createInboxTask passes contactId | f4845ef |
| 2026-05-29 | Feature      | FR#142   | GH#166 | Dislikes & Things to Avoid section on contacts; dislikes JSONB column on contacts table | f6cc1e2 |
| 2026-05-29 | Feature      | FR#140   | GH#164 | Settings panel for Contacts: manage global relationship tags and likes/preferences categories | 3aa9a81 |
| 2026-05-29 | Feature      | FR#141   | GH#165 | Situation-aware tag clouds: custom categories from settings merged into LikesSection/DislikesSection dropdowns and relationship tag suggestions | 3aa9a81 |
| 2026-05-30 | Bug Fix      | Issue#38 | GH#177 | Gift task Contact field missing in TaskDetailPanel — contacts.find(...)?.name → ?.displayName | afee2043 |
| 2026-05-30 | Feature      | FR#150   | GH#179 | Sort custom likes/dislikes categories alphabetically in dropdown | afee2043 |
| 2026-05-30 | Bug Fix      | FR#153   | GH#182 | Task pickers showed done/inboxHistory tasks — corrected INACTIVE_BUCKETS names ('completed'→'done', 'inbox_history'→'inboxHistory') | afee2043 |
| 2026-05-30 | Feature      | FR#151   | GH#180 | Relationship tags added via contact auto-add to Settings list (onAddCustomTag callback threaded App→ContactsPanel→ContactDetail→RelationshipTagsSection) | 611bf116 |
| 2026-05-30 | Feature      | FR#155   | GH#184 | Settings > Contacts full CRUD: count badges per tag/category, cascade rename/merge, delete with replace | 786e3ede, 81a2c8c2 |
| 2026-05-30 | Feature      | FR#139   | GH#163 | AI Chat mode contact enrichment: auto-apply contact_promise/like/dislike/tag/note/gift actions from natural language | 9fd2f0a7, 81a2c8c2 |
| 2026-05-30 | Bug Fix      | —        | —      | Contacts TDZ crash (contacts referenced in useCallAI before useContacts declaration) + Settings list not updating on tag/category rename or delete | 81a2c8c2 |
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
| 2026-05-27 | Code Quality | CQ#17    | GH#153 | Correct stale bucket:'next' fixture data in calendarApi and taskUtils tests | 7235ba4 |
| 2026-05-27 | Feature      | FR#129   | GH#151 | Per-row sub-templates in exports — messageRowTemplate (conversation) and taskRowTemplate+indentUnit (hierarchical); collapsible sections with independent reset buttons in ExportTemplateEditor; fixed missing exportTemplates prop in App.jsx→TaskBucketView chain | 907608c |
| 2026-05-27 | Feature      | FR#130   | GH#154 | Hierarchical export: effort and notes rendered as indented sub-rows at depth+1 using resolvedIndentUnit — tracks custom indent unit correctly | f16294d |
| 2026-05-27 | Feature      | FR#46   | GH#42  | Receipt-to-Sheets pipeline — extractReceiptFields (claude-haiku), Log as receipt button in EmailInboxPanel, receiptSheetId setting, →ACTION:append-sheet handler in useCallAI | 0195f23 |
| 2026-05-28 | Feature      | FR#131  | GH#155 | Mark email as spam — Mark as spam button in EmailInboxPanel, markAsSpam callback in App.jsx, →ACTION:mark-spam handler in useCallAI, constants.jsx prompt updated | 7a1488f |
| 2026-05-28 | Feature      | FR#132  | GH#156 | Contact Manager — Google Contacts two-way sync + personal CRM enrichment (notes, relationship tags, likes/preferences, gift ideas, promises linked to tasks); new contacts Supabase table + People API integration | f5c7398, ade9528, 558193a, 9688781 |
| 2026-05-29 | Feature      | FR#133  | GH#157 | Gift ideas: task link badge + GiftTaskPicker; given→task done sync (markTaskDone) | 75024d0 |
| 2026-05-29 | Feature      | FR#134  | GH#158 | "They promised" auto-creates Waiting For task via createInboxTask({isWaitingFor:true}) | 75024d0 |
| 2026-05-29 | Feature      | FR#135  | GH#159 | Promise done → linked task done sync via markTaskDone in onToggleDone wrapper | 75024d0 |
| 2026-05-29 | Feature      | FR#144  | GH#169 | Contact detail identity footer: UUID + Google resource name for record identification | 75024d0 |
| 2026-05-29 | Bug Fix      | Issue#35 | GH#168 | Orphaned contact records: auto-sweep empty orphans at sync; OrphanBanner merge/delete UI; orphan indicator in contact list | 18fa3c6 |
| 2026-05-29 | Bug Fix      | —        | GH#168 | ContactsPanel crash: mergeOrphanIntoContact + deleteOrphanContact missing from props destructure | fb5e29e |
| 2026-05-30 | Feature      | FR#154  | GH#183 | Backfill contact relationship tags from existing contacts into Settings list on load; settingsReady gate prevents race condition | 06b9a64 |
| 2026-05-30 | Feature      | FR#156  | GH#185 | CamelCase entry for contact relationship tags and likes categories; toContactTagCase() utility; PRESET_TAGS updated | 06b9a64 |
| 2026-05-30 | Feature      | —       | GH#183 | Alphabetical sort for ContactTagManager and ContactCategoryManager; refactored to value-based edit state (editingTag/editingCat) | 06b9a64 |
| 2026-05-31 | Bug Fix      | Issue#41 | GH#189 | contacts_lookup tool now merges Supabase enrichment (dislikes, likes, notes, tags, gifts, promises) into People API results via googleResourceName join | e69d9a4 |
| 2026-06-01 | Feature | FR#158 | GH#187 | Contact name fuzzy/partial matching in action handlers — resolveContactByName() helper, substring fallback, ambiguous-match error | 753c2e77 |
| 2026-06-01 | Feature | FR#176 | GH#207 | Contact row inbox indicator — onInboxLoaded callback, inboxSenderEmails state, 📬 badge in ContactRow | 5739db4c |
| 2026-06-01 | Feature | FR#177 | GH#208 | Email > Contacts tab — EmailContactsPanel with date filter, contact grouping, expand/collapse, unknown senders | 0c0ee0da |
| 2026-06-01 | Feature | FR#157 | GH#186 | contact_promise system prompt: no auto-emit tasks; suggest + confirm flow; Drive sharing + contact note hints (FR#182) | c302510a |
| 2026-06-01 | Feature | FR#178/179/180/181/182 | GH#209/211/212/213/214 | email→Drive tools (attachment + email-to-Doc), →ACTION:attach_drive, processEmailWithAI calendar + contact note steps | 1d3ded27 |
| 2026-06-01 | Bug Fix | Issue#43/FR#181/179/178/177 | GH#215 | workingTasks scope fix; docsApi named params; processEmailWithAI full-body fetch; EmailContactsPanel load-more pagination | 912e3cf2 |
| 2026-06-01 | Bug Fix | — | — | drive_search includes Shared Drives (supportsAllDrives + includeItemsFromAllDrives); DRIVE_SEARCH_TOOL folder-search guidance | 344913ab |
| 2026-06-02 | Feature | FR#183/184 | GH#216/217 | Contact-task linking (LinkedTasksSection, contact picker, contact:<name> syntax, resolve in action handlers); Drive scope empty-result hint | 7f721a64 |
| 2026-06-02 | Feature | FR#183 | GH#216 | Contact-task linking — LinkedTasksSection, contact picker in TaskDetail, contact:<name> action syntax, resolve in handlers; empty state always shown | 74b8553 |
| 2026-06-02 | Bug Fix | — | GH#216 | TaskDetailPanel: missing task.id in onUpdate calls for contact picker (crash fix) | 25e45f9 |
| 2026-06-02 | Feature | FR#184 | GH#217 | drive_search empty-result scope hint; Settings Drive scope description updated | 7f721a6 |
| 2026-06-02 | Bug Fix | Issue#39 | GH#178 | Gift/promise task links re-linked after inbox processing — onTaskReplaced callback in useInboxProcessing transfers contactId to new task and updates contact giftIdeas/promises taskId via relinkTaskContactsRef | fa8b4d2 |
| 2026-06-02 | Bug Fix | Issue#40 | GH#188 | handleSkipPendingAction: hasInboxContext guard (current.bucket==='inbox') prevents non-inbox pending action dismissals from auto-starting inbox processing | 0bc12fb |
| 2026-06-02 | Bug Fix | Issue#43 | GH#215 | useCallAI: wrap extractAction/setPendingAction in mode!==chat/dump/daily guard — chat mode already applies actions directly, preventing duplicate task creation | 0bc12fb |
| 2026-06-02 | Feature | FR#186 | GH#219 | Task completion appends to contact notes — taskCompletionToContactNotes setting; handleTaskDoneChangedRef appends [date] Completed entry when isDone+contactId+setting | 0bc12fb |
| 2026-06-02 | Feature | FR#187 | GH#220 | Health monitoring panel MVP — health_items Supabase table+RLS; useHealth.js CRUD hook; HealthPanel.jsx (Medications/Supplements/Appointments/Documents tabs); sidebar button | 0bc12fb |
| 2026-06-02 | Bug Fix | — | GH#220 | useHealth.js: crypto.randomUUID() replaces genHealthId() — non-UUID strings failed Postgres UUID column constraint, causing optimistic rollback and items disappearing on save | 835a4a4 |
| 2026-06-02 | Feature | FR#188 | GH#221 | Health panel: StyledDateInput with colorScheme:dark for consistent date/time pickers | 17b8b39 |
| 2026-06-02 | Feature | FR#189 | GH#222 | Health panel: DriveFilePicker component in ApptForm + DocForm; file name badge; falls back to text input when Drive disconnected | 17b8b39 |
| 2026-06-02 | Feature | FR#190 | GH#223 | Health panel: Summarize ✦ button on DocRow; opens coach chat with pre-filled get_drive_file prompt (Phase 1) | 17b8b39 |
| 2026-06-02 | Feature | FR#191 | GH#224 | Health panel: Calendar pull (MEDICAL_KEYWORDS scan, From your calendar section); Calendar push (checkbox → doCalendarCreateEvent, 30-min default) | 17b8b39 |
| 2026-06-02 | Bug Fix | — | GH#221 | Health panel calendar: expanded MEDICAL_KEYWORDS (dr./dr , nurse, lab, mri, ct, x-ray, scan, vaccine, etc.); calendar push on edit path | c92f136 |
| 2026-06-02 | Feature | — | GH#224 | Health panel calendar: ignore/dismiss list (localStorage); date window dropdown (30d–1y, default 90d); empty-state message; past events filtered out by default | b237b5f | |
| 2026-06-02 | Feature | FR#183/184 | GH#216/217 | Contact-task linking (LinkedTasksSection, contact picker, contact:<name> syntax, resolve in action handlers); Drive scope empty-result hint | 7f721a64 |
| 2026-06-02 | Feature | FR#183 | GH#216 | Contact-task linking — LinkedTasksSection, contact picker in TaskDetail, contact:<name> action syntax, resolve in handlers; empty state always shown | 74b8553 |
| 2026-06-02 | Bug Fix | — | GH#216 | TaskDetailPanel: missing task.id in onUpdate calls for contact picker (crash fix) | 25e45f9 |
| 2026-06-02 | Feature | FR#184 | GH#217 | drive_search empty-result scope hint; Settings Drive scope description updated | 7f721a6 |

| 2026-06-03 | feat | FR#192 | GH#225 | Health Documents: auto-summarize on add setting | 741bf5d |
| 2026-06-03 | Feature | FR#193 | GH#226 | Habits panel — SOrg habit tracking: 5 habits (Friction Audit, Skill Hour, Evidence Journal, Strategic Review, Energy Audit), streak/periodic tracking, 90-day heatmap, per-habit entry forms, Supabase habit_entries table | 8aa1e5b |
| 2026-06-03 | Feature | FR#194-198 | GH#227-231 | Habits analytics tab — compliance heatmap (12-week), Skill Hour cumulative tracker (250h milestone + sparkline), Energy ecology panel, weekly score trend (0–5 SVG line chart), habits score vs task throughput overlay chart; analyticsUtils.js pure functions with 28 unit tests | b37af28 |

| 2026-06-03 | Feature | FR#199 | GH#232 | Move Habits Analytics to Analytics area as third tab — HabitsAnalyticsView (collapsible/configurable), habitsAnalyticsConfig, AnalyticsArea Habits tab, stripped internal chart titles, removed HabitsAnalytics.jsx sub-tab | aa61e08 |
