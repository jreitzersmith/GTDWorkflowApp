# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#23** · Code Quality — **CQ#11** · Feature Requests — **FR#101**

---

## Known issues / remaining work

- [ ] Issue#22 [GH#102] (2026-05-16) — Weekly Review coach ignores "no" response and moves tasks anyway — question guard (currently Process mode only) must be extended to Weekly Review; reinforce in Weekly Review system prompt

---

## Code quality

---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins

- [ ] FR#100 [GH#107] (2026-05-16) — Task analytics charts — completion rate, actual vs estimated effort accuracy, task volume by bucket; new view/panel, data from existing task model fields (completedDate, effort, actualEffort)

#### Daily workflow / GTD core


#### Inbox / processing improvements

#### Integrations / data

- [ ] FR#96 [GH#101] (2026-05-16) — Drive target folder settings per action type — settings UI to configure destination Drive folder for each action (create-doc, create-sheet, create-slides, save-review-to-doc); uses existing `reviewDriveFolderId` pattern generalised to all Drive-creating actions
- [ ] FR#97 [GH#103] (2026-05-16) — Save-to-Drive: output format selector (prose/JSON/markdown) + timestamp + mode in filename — settings option; applies to Weekly Review saves and coach create-doc handler
- [ ] FR#98 [GH#104] (2026-05-16) — Settings: configurable AI Coach name and user display name — defaults to "Coach" and Google account name; threaded into all system prompts
- [ ] FR#101 [GH#110] (2026-05-18) — Conversation export — export coach chat to Google Docs, Markdown, or plain text; export button in coach panel header, settings for default format + content; chip messages used for tool activity (see FR#102 for raw payload export)
- [ ] FR#102 [GH#109] (2026-05-18) — Full conversation export: raw API tool call inputs and outputs — IMPORTANT: review FR#101 implementation before extending; raw API payloads not currently stored in messages state
- [ ] FR#99 [GH#105] (2026-05-16) — Chat mode: Drive file read tool — `search_drive` + `get_drive_file` tools in useCallAI.js so coach can retrieve doc content by name; extends FR#59

- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
  - `sheetsApi.js` API wrapper exists. Missing: (1) Settings UI to configure target Sheet ID, (2) a `→ACTION:append_sheet` coach action line handler in `useCallAI.js`, (3) coach prompt instruction to identify financial emails and emit the action. Pattern matches FR#46 (receipt pipeline) — these two could be implemented together.
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#46 [GH#42] (2026-05-09) — Receipt-to-Sheets pipeline — AI extracts vendor/amount/date from email and appends to a Sheet
  - `sheetsApi.js` exists. Missing: (1) Settings field for target Sheet ID, (2) "Process as receipt" option in EmailInboxPanel, (3) a specialized AI prompt to extract financial fields, (4) `→ACTION:append_sheet` handler in `useCallAI.js`. Overlaps with FR#17 — implement together.
- FR#59 [GH#58] (2026-05-11) — AI coach `search_drive` tool — Drive full-text search via tool use
  - `driveApi.js` exists. Missing: a `DRIVE_SEARCH_TOOL` definition added to the tool list in `useCallAI.js` (alongside `GET_TASK_CONTEXT_TOOL`), a handler in the tool dispatch loop, and coach prompt instruction. Self-contained change, low risk.
- FR#70 [GH#70] (2026-05-12) — Multiple Google account support
  - `useGoogleAuth.js` has a single token store (`gtd_google_token` in localStorage). Significant refactor required: token store must be keyed by account email, `user_settings.google_accounts` array in Supabase, account selector UI in Email and Calendar panels, and per-account scope management. High risk — touches auth flow throughout the app.

#### Data model expansions

- FR#23 [GH#15] (2026-05-08) — Project categories (user-defined) — user-defined categories with filtering/grouping
  - Task `category` field exists, Settings UI for managing category list exists, and `TaskDetailPanel` has the category selector dropdown. What is missing: a cross-bucket filter/group view that surfaces tasks by category across Next Actions, Projects, etc. Likely implemented as a waterfall filter addition or a new sidebar filter control.

- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- [ ] FR#91 [GH#96] (2026-05-15) — Replace magic link auth with Google OAuth (Supabase Google provider) — eliminates OTP rate limits and expiry issues; one-click login for all users; evaluate unifying with existing Google API scope grant
- [ ] FR#92 [GH#97] (2026-05-15) — 🌤 Self-service account management — delete account + export data in Settings; GDPR/CCPA compliance prerequisite; depends on FR#91
- [ ] FR#93 [GH#98] (2026-05-15) — 🌤 Admin panel for user management — list/ban/delete users, usage metrics, impersonation; Supabase Dashboard is sufficient until user count demands it
- [ ] FR#94 [GH#99] (2026-05-15) — 🌤 Organisation support and team management — shared workspaces, roles (Owner/Admin/Member/Viewer), invite flow, billing hooks; major architectural change, post-single-user-validation only

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)

