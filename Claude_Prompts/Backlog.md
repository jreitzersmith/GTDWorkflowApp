# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#43** · Code Quality — **CQ#17** · Feature Requests — **FR#184**

---

## Known issues / remaining work

- Issue#43 [GH#215] (2026-06-01) — Chat mode duplicate task: action handler auto-creates task immediately + metadata panel also creates on accept; need to surface task ID to pending action state so panel patches instead of posts
- Issue#39 [GH#178] (2026-05-30) — AI processing breaks gift/promise task link — when AI Process mode moves original task to inboxHistory and creates a new task, gift/promise taskId links go stale; deferred pending architectural decision
- Issue#40 [GH#188] (2026-05-30) — Inbox processing auto-starts after AI Skip in contact enrichment — after Skip, coach immediately transitions to inbox processing mode instead of awaiting next input; likely post-action flow in useCallAI.js
- Issue#41 [GH#189] (2026-05-31) — contacts_lookup tool result missing enrichment data — People API returns name/email/phones only; Supabase enrichment (dislikes, likes, notes, tags, etc.) not merged in; fix: join on googleResourceName in useCallAI.js contacts_lookup handler
- Issue#42 [GH#210] (2026-06-01) — AI creates project node instead of subcategory when user asks for a subcategory — parser gap (extractAddAction dropped nodeType) + prompt gap (no nodeType:subcategory instruction); fixed same day

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

- FR#183 [GH#216] (2026-06-02) — Contact-task linking (Option A) — contactId + contactName fields on tasks; Linked Tasks section in ContactDetail (mutually exclusive with Promises — task appears in only one); contact picker in Task Detail; contact:<name> AI action syntax. Files: supabase.js, SQL/, constants.jsx, useCallAI.js, TaskDetail, ContactDetail.
- FR#184 [GH#217] (2026-06-02) — Settings: detect missing drive.readonly scope and prompt Drive reconnect — drive_search empty-result hint + Drive settings warning chip when token lacks drive.readonly. Files: useCallAI.js, settings UI, useGoogleAuth.js.




#### Data model expansions

- FR#109 [GH#117] (2026-05-18) — Rename "Projects" to "Tasks" across UI and codebase (future consideration) — high-risk rename touching constants, all components, supabase.js field mappers, existing DB rows (`bucket = 'project'`), AI prompts, and docs; defer until architecture is stable

- FR#16 [GH#17] — Shopping list manager (new bucket/sidebar section)

#### Platform / reach

- [ ] FR#91 [GH#96] (2026-05-15) — Replace magic link auth with Google OAuth (Supabase Google provider) — eliminates OTP rate limits and expiry issues; one-click login for all users; evaluate unifying with existing Google API scope grant
- [ ] FR#92 [GH#97] (2026-05-15) — Self-service account management — delete account + export data in Settings; GDPR/CCPA compliance prerequisite; depends on FR#91
- [ ] FR#93 [GH#98] (2026-05-15) — Admin panel for user management — list/ban/delete users, usage metrics, impersonation; Supabase Dashboard is sufficient until user count demands it
- [ ] FR#94 [GH#99] (2026-05-15) — Organisation support and team management — shared workspaces, roles (Owner/Admin/Member/Viewer), invite flow, billing hooks; major architectural change, post-single-user-validation only

- FR#9 [GH#18] — Todoist export / two-way sync (previously Issue#4 / GH#3)
- FR#20 [GH#19] — Mobile layout (significant; requires media queries throughout)

---

## Deferred Testing Scenarios

Test cases that could not be executed during their cycle due to a missing condition. Check when the condition is next available, then remove the item and note the result in the commit or GitHub issue.

- [FR#128 GH#149] Dismissing the send action bar does not also dismiss the draft — needs a live Gmail thread to test
- [FR#139 GH#163] Received promise (contact promises to call Enterhealth) → Waiting For task created automatically — needs a contact enrichment test with direction:received to verify task is placed in Waiting For
- [FR#176 GH#207] Inbox indicator badge appears on ContactRow when contact's email is in loaded inbox — needs Email inbox loaded during test
- [FR#176 GH#207] Inbox indicator clears when inbox refreshes without that sender — needs Email inbox loaded
- [FR#176 GH#207] Inbox indicator clears when Gmail disconnected — needs Gmail connected
- [FR#180 GH#212] Ask coach to attach a Drive file to a task via drive_search + →ACTION:attach_drive; verify badge in Task Detail — needs Drive connected
- [FR#181 GH#213] Process a scheduling email; confirm Calendar step offers →ACTION:calendar_create — needs an email with scheduling/meeting info
- [FR#182 GH#214] Process email from a contact; confirm AI offers contact_note step — needs email from a known contact
- [FR#182 GH#214] Ask coach to share a Drive file via email (drive_search + gmail_compose) — needs Drive + Gmail both connected
