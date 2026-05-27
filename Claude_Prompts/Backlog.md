# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#34** · Code Quality — **CQ#17** · Feature Requests — **FR#129**

---

## Known issues / remaining work


---

## Code quality


---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins


#### Daily workflow / GTD core

- FR#129 [GH#151] (2026-05-27) — Expandable export row templates — allow users to define per-message format (conversation exports) and per-level indentation/prefix (hierarchical exports) via sub-templates in ExportTemplateEditor



#### Analytics





#### Inbox / processing improvements

#### Integrations / data

- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
  - `sheetsApi.js` API wrapper exists. Missing: (1) Settings UI to configure target Sheet ID, (2) a `→ACTION:append_sheet` coach action line handler in `useCallAI.js`, (3) coach prompt instruction to identify financial emails and emit the action. Pattern matches FR#46 (receipt pipeline) — these two could be implemented together.
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#46 [GH#42] (2026-05-09) — Receipt-to-Sheets pipeline — AI extracts vendor/amount/date from email and appends to a Sheet
  - `sheetsApi.js` exists. Missing: (1) Settings field for target Sheet ID, (2) "Process as receipt" option in EmailInboxPanel, (3) a specialized AI prompt to extract financial fields, (4) `→ACTION:append_sheet` handler in `useCallAI.js`. Overlaps with FR#17 — implement together.
  - `driveApi.js` exists. Missing: a `DRIVE_SEARCH_TOOL` definition added to the tool list in `useCallAI.js` (alongside `GET_TASK_CONTEXT_TOOL`), a handler in the tool dispatch loop, and coach prompt instruction. Self-contained change, low risk.
- FR#70 [GH#70] (2026-05-12) — Multiple Google account support
  - `useGoogleAuth.js` has a single token store (`gtd_google_token` in localStorage). Significant refactor required: token store must be keyed by account email, `user_settings.google_accounts` array in Supabase, account selector UI in Email and Calendar panels, and per-account scope management. High risk — touches auth flow throughout the app.

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
- [FR#119 GH#138] Supabase persistence round-