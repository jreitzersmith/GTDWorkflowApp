# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#43** · Code Quality — **CQ#17** · Feature Requests — **FR#201**

---

## Known issues / remaining work



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

- FR#201 [GH#234] (2026-07-14) — Harden Supabase magic-link redirect with explicit emailRedirectTo — signInWithOtp() currently has no redirectTo, so redirects depend entirely on the static Supabase Site URL (this caused a real outage: Site URL was stale at localhost:3000, fixed as an emergency config change via the Management API on 2026-07-14). Add options: { emailRedirectTo: window.location.origin } so the redirect is dynamic and correct regardless of origin. High risk (auth flow change) — requires full plan/build/test cycle. See GH#234.
- FR#190 [GH#223] (2026-06-02) — Health panel: Paperless NGX Phase 2 — deferred until Paperless NGX MCP/connector exists; Phase 1 (AI coach summarization) already implemented
- FR#185 [GH#218] (2026-06-02) — Android SMS contact tracking — companion app reads device SMS via content://sms/, syncs to new sms_messages Supabase table, surfaces threads in Contacts panel alongside email; deferred to Android app phase. See GH#218 for full architecture, schema, and design decisions.
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#70 [GH#70] (2026-05-12) — Multiple Google account support
  - `useGoogleAuth.js` has a single token store (`gtd_google_token` in localStorage). Significant refactor required: token store must be keyed by account email, `user_settings.google_accounts` array in Supabase, account selector UI in Email and Calendar panels, and per-account scope management. High risk — touches auth flow throughout the app.

#### Contacts enrichment




#### Data model expansions

- FR#109 [GH#117] (2026-05-18) — Rename "Projects" to "Tasks" across UI and codebase (future consideration) — high-risk rename touching constants, all components, supabase.js field mappers, existing DB rows (`bucket = 'project'`), AI prompts, and docs; defer until architecture is stable

- FR#16 [GH#17] — Shopping list manager — mobile-first, multi-list per store, real-time sharing, AI coach integration (→ACTION:shopping_add, gift idea pipeline, price search), barcode scanning, autocomplete from history, recurring/templates, geofence + shared-list notifications. 4 new Supabase tables. Depends on FR#91 (multi-user auth) and FR#20 (mobile layout). Voice entry deferred to app-wide voice phase. See GH#17 for full spec.

#### Platform / reach

- [ ] FR#91 [GH#96] (2026-05-15) — Replace magic link auth with Google OAuth (Supabase Google provider) — eliminates OTP rate limits and expiry issues; one-click login for all users; evaluate unifying with existing Google API scope grant
- [ ] FR#92 [GH#97] (2026-05-15) — Self-service account management — delete account + export data in Settings; GDPR/CCPA compliance prerequisite; depends on FR#91
- [ ] FR#93 [GH#98] (2026-05-15) — Admin panel for user management — list/ban/delete users, usage metrics, impersonation; Supabase Dashboard is sufficient until user count demands it
- [ ] FR#94 [GH#99] (2026-05-15) — Organisation support and team management — shared workspaces, roles (Owner/Admin/Member/Viewer), invite flow, billing hooks; major architectural change, post-single-user-validation only

- FR#200 [GH#233] (2026-06-04) — Android app preparation: storage abstraction (replace localStorage with swappable useStorage hook), Anthropic API proxy (protect key from APK extraction), Google OAuth refactor (browser PKCE flow incompatible with native Android); items 1–2 are approach-independent; item 3 deferred until Capacitor vs. React Native decision is made
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
- [Issue#39 GH#178] Gift given→task done bidirectional sync after re-link — g2: marking re-linked task done did not flip gift.given toggle; re-link itself confirmed working (g1 passed); likely test-timing fluke; retest with deliberate pause between processing and done-toggle
- [Issue#40 GH#188] Skip in contact enrichment — fix committed 0bc12fb; needs live test: dismiss a pending action from contact enrichment mode, confirm inbox processing does NOT auto-start
- [Issue#43 GH#215] Chat mode duplicate task — fix committed 0bc12fb; needs live test: ask coach to create a task in chat mode, confirm exactly one task created, no pending action bar
- [FR#180 GH#212] Ask coach to attach a Drive file to a task via drive_search + →ACTION:attach_drive; verify badge in Task Detail — needs Drive connected
- [FR#181 GH#213] Process a scheduling email; confirm Calendar step offers →ACTION:calendar_create — needs an email with scheduling/meeting info
- [FR#182 GH#214] Process email from a contact; confirm AI offers contact_note step — needs email from a known contact
- [FR#182 GH#214] Ask coach to share a Drive file via email (drive_search + gmail_compose) — needs Drive + Gmail both connected
- [FR#196 GH#229] Energy ecology panel: entries from multiple weeks appear newest first — needs energy_audit entries across 2+ different weeks
- [FR#196 GH#229] Energy ecology panel: empty drain or regenerate field shows "—" placeholder — needs an energy entry with only one of drain/regenerate filled
- [FR#198 GH#231] Score vs throughput: empty state shows "Start logging habits and completing tasks…" — needs a state with zero habits logged and zero completed tasks with completedDate
- [FR#198 GH#231] Score vs throughput: legend note "No task completion dates logged yet" visible when tasks lack completedDate — needs tasks with done=true but no completedDate set
