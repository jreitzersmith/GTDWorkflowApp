# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#36** · Code Quality — **CQ#17** · Feature Requests — **FR#149**

---

## Known issues / remaining work

- Issue#36 [GH#174] (2026-05-29) — Orphan merge deletes source row even when Supabase write fails — `updateCustomFields` does not re-throw on error; `mergeOrphanIntoContact` calls `deleteContact` unconditionally. Fix: re-throw in `updateCustomFields` catch; abort early in `mergeOrphanIntoContact` if write fails.

---

## Code quality


---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins


#### Daily workflow / GTD core




#### Analytics




#### Inbox / processing improvements

#### Integrations / data

- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
  - `sheetsApi.js` API wrapper exists. Missing: (1) Settings UI to configure target Sheet ID, (2) a `→ACTION:append_sheet` coach action line handler in `useCallAI.js`, (3) coach prompt instruction to identify financial emails and emit the action. Pattern matches FR#46 (receipt pipeline) — these two could be implemented together.
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#70 [GH#70] (2026-05-12) — Multiple Google account support
  - `useGoogleAuth.js` has a single token store (`gtd_google_token` in localStorage). Significant refactor required: token store must be keyed by account email, `user_settings.google_accounts` array in Supabase, account selector UI in Email and Calendar panels, and per-account scope management. High risk — touches auth flow throughout the app.

#### Contacts enrichment

- FR#149 [GH#175] (2026-05-29) — Contact link on task: display contact name (with link) in Task Detail Panel for tasks created from promises/gifts; requires new `contact_id` UUID column on tasks table + migration
- FR#145 [GH#170] (2026-05-29) — Gift-task reverse sync: task done → mark gift as "given" (with givenDate); bidirectional undo
- FR#146 [GH#171] (2026-05-29) — Received promise auto-task: route to Inbox (not Projects) retaining isWaitingFor flag; AI Process mode routes to Waiting For + suggests follow-up due date (Part 2 deferred to FR#139)
- FR#147 [GH#172] (2026-05-29) — Made promise "new task" title format: "[text] — Promised to [ContactName]" instead of "[text] - [ContactName]"
- FR#148 [GH#173] (2026-05-29) — Full bidirectional promise↔task sync: uncheck promise → unmark task; task done → promise done (reverse direction)
- FR#136 [GH#160] (2026-05-28) — Task picker in promises should filter to active tasks only (exclude Inbox History, done, archived)
- FR#137 [GH#161] (2026-05-28) — Linked task title on promise: make it a clickable link to the task + add clear-link (×) button
- FR#138 [GH#162] (2026-05-28) — "Create new Inbox task from promise": task title should include contact name for context (e.g. "Send X to Jessica Beatty")
- FR#139 [GH#163] (2026-05-28) — AI coach integration for Contacts: natural-language operations (tag, note, promise via coach)
- FR#140 [GH#164] (2026-05-28) — Settings panel for Contacts: manage global relationship tags list and likes/preferences categories (persisted in user_settings)
- FR#141 [GH#165] (2026-05-28) — Situation-aware tag clouds for likes/preferences categories (e.g. Dietary Preferences → gluten-free, vegan chips); depends on FR#140
- FR#142 [GH#166] (2026-05-28) — "Dislikes and Things to Avoid" section in Contact detail — mirrors Likes/Preferences; requires new `dislikes JSONB` column on contacts table
- FR#143 [GH#167] (2026-05-28) — Clear (×) button on contact list filter text input

#### Data model expansions


- FR#109 [GH#117] (2026-05-18) — Rename "Projects" to "Tasks" across UI and codebase (future consideration) — high-risk rename touching constants, all components, supabase.js field mappers, existing DB rows (`bucket = 'project'`), AI prompts, and docs; defer until architecture is stable

- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- [ ] FR#91 [GH#96] (2026-05-15) — Replace magic link auth with Google OAuth (Supabase Google provider) — eliminates OTP rate limits and expiry issues; one-click login for all users; evaluate unifying with existing Google API scope grant
- [ ] FR#92 [GH#97] (2026-05-15) — 🌤 Self-service account management — delete account + export data in Settings; GDPR/CCPA compliance prerequisite; depends on FR#91
- [ ] FR#93 [GH#98] (2026-05-15) — 🌤 Admin panel for user management — list/ban/delete users, usage metrics, impersonation; Supabase Dashboard is sufficient until user count demands it
- [ ] FR#94 [GH#99] (2026-05-15) — 🌤 Organisation support and team management — shared workspaces, roles (Owner/Admin/Member/Viewer), invite flow, billing hooks; major architectural change, post-single-user-validation only

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)

---

## Deferred Testing Scenarios

Test cases that could not be executed during their cycle due to a missing condition (no live email, second device required, Supabase not ready, specific data state needed, etc.). Check these when the condition is next available, then remove the item and note the result in the commit or GitHub issue.

- [FR#128 GH#149] Dismissing the send action bar does not send the email — needs: manual test of dismiss/cancel path in confirm bar
- [FR#128 GH#149] If send fails (e.g. revoked token), error appears in coach chat — needs: test with expired/revoked Google token
- [FR#119 GH#138] Supabase persistence round-trip for notes field — needs: Supabase connected session with task that has notes
- [FR#46 GH#42] Sheets not connected: Sheet ID input is disabled — needs: Google Sheets disconnected state
- [FR#46 GH#42] receiptSheetId not configured: Log as receipt button is absent — needs: Sheet ID cleared in Settings
- [FR#131 GH#155] Gmail connected at “read only” scope — Mark as spam still visible but produces an error (modify required) — needs: Gmail reconnected at read-only scope
- [FR#131 GH#155] No email selected — button absent (not rendered) — needs: email panel with no selection active
