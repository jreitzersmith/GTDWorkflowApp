# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#21** · Code Quality — **CQ#11** · Feature Requests — **FR#91**

---

## Known issues / remaining work

---

## Code quality

---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins

#### Daily workflow / GTD core

- [ ] FR#90 [GH#95] (2026-05-15) — Notes field append vs replace — add `notes_append:<text>` action field so AI can append to existing notes rather than always replacing; implement in extractUpdateAction + useCallAI.js

#### Inbox / processing improvements

#### Integrations / data

- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
  - `sheetsApi.js` API wrapper exists. Missing: (1) Settings UI to configure target Sheet ID, (2) a `→ACTION:append_sheet` coach action line handler in `useCallAI.js`, (3) coach prompt instruction to identify financial emails and emit the action. Pattern matches FR#46 (receipt pipeline) — these two could be implemented together.
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#41 [GH#37] (2026-05-09) — Doc capture from coach — `→ACTION:create-doc` creates a Google Doc from coach output and links to a task
  - `docsApi.js` wrapper exists. Missing: ACTION line parser in `useCallAI.js` for `→ACTION:create-doc`, coach prompt instruction, and optional task link via `driveAttachments` on the target task.
- FR#42 [GH#38] (2026-05-09) — Weekly Review auto-doc — save review transcript as a dated Google Doc
  - `docsApi.js` exists. Missing: a "Save to Drive" button in the Weekly Review coach panel that calls `docsApi` with the full transcript, plus a Settings field for the target Drive folder ID.
- FR#43 [GH#39] (2026-05-09) — AI Coach creates Docs/Sheets/Slides from coach conversation
  - API wrappers (`docsApi.js`, `sheetsApi.js`, `slidesApi.js`) all exist. Missing: ACTION line parsers in `useCallAI.js` for `→ACTION:create-sheet` and `→ACTION:create-slides`, and coach prompt instructions for when to emit them.
- FR#44 [GH#40] (2026-05-09) — Slides briefing from selected project or Next Actions
  - `slidesApi.js` exists. Missing: a "Generate Briefing" trigger (button in task panel or coach action), a template for slide structure (title slide + one slide per task), and a `→ACTION:create-slides` handler in `useCallAI.js`.
- FR#45 [GH#41] (2026-05-09) — Unified Drive/Docs/Sheets search bar in coach or task panel
  - `driveApi.js` exists. This is the UI counterpart to FR#59 (which is the AI tool version). Missing: a search input in the coach or task panel that calls `driveApi.files.list` with full-text query and returns results as attachable items or context.
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

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)

