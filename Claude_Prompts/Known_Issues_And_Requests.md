# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#18** · Code Quality — **CQ#11** · Feature Requests — **FR#80**

---

## Known issues / remaining work


---

## Code quality


---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins

#### Daily workflow / GTD core


#### Inbox / processing improvements


#### Integrations / data


- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#41 [GH#37] (2026-05-09) — Doc capture from coach — coach action `→ACTION:create-doc` creates a Google Doc from coach output and links it back to a task or project
- FR#42 [GH#38] (2026-05-09) — Weekly Review auto-doc — at end of Weekly Review, offer to save the full review transcript as a dated Google Doc in a configurable Drive folder
- FR#43 [GH#39] (2026-05-09) — AI Coach creates Docs/Sheets/Slides — coach actions `→ACTION:create-sheet` and `→ACTION:create-slides` scaffold new files from coach conversation
- FR#44 [GH#40] (2026-05-09) — Slides briefing from tasks — generate a Google Slides briefing deck from a selected project or set of Next Actions; one slide per task or milestone
- FR#45 [GH#41] (2026-05-09) — Unified Drive/Docs/Sheets search — search bar in coach or task panel that queries Drive full-text and returns matching files as context or task attachments
- FR#46 [GH#42] (2026-05-09) — Receipt-to-Sheets pipeline — forward a receipt email to the app; AI extracts vendor/amount/date and appends a row to a designated Google Sheet
- FR#59 [GH#58] (2026-05-11) — AI coach Drive search tool — `search_drive` tool in useCallAI.js using Drive API `files.list` full-text search; coach can surface Drive files in conversation and offer to attach them to tasks; relates to FR#45 (UI search bar) but is AI tool-use access
- FR#70 [GH#70] (2026-05-12) — Multiple Google account support — OAuth token store keyed by account; per-account scope management for Gmail/Calendar/Drive; account selector in email and calendar panels; `google_accounts` array in user_settings

#### Data model expansions

- FR#10 [GH#16] — Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)

## Inbox / processing improvements

- [ ] FR#77 [GH#78] (2026-05-13) — Process mode: editable metadata panel in pending action bar (priority, category, effort, due, defer, location, recurrence editable before confirm)
