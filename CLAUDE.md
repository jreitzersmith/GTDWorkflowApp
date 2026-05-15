# GTD Manager — Project Brief for Claude

## What this project is

A personal GTD task manager built as a React SPA with an AI coach powered by the Anthropic Claude API. Integrates with Google services (Gmail, Google Calendar, Drive, Docs, Sheets, Slides) for email management, calendar sync, and file attachments. Primary persistence via Supabase (tasks + user_settings + gmail_queue tables); localStorage fallback for unauthenticated sessions. Real-time cross-device sync via Supabase subscription channel.

---

## Tech stack

- React (functional components + hooks only — no class components), inline styles throughout (no CSS files), shared design tokens in `COLORS`
- Anthropic Claude API (`claude-sonnet-4-6`); local Ollama support for coach panel
- Supabase: `tasks` + `user_settings` + `gmail_queue` tables; `useSupabaseAuth.js`, `src/api/supabase.js` (field mappers: `taskToDb`/`dbToTask`, `queueEntryToRow`/`rowToQueueEntry`); tasks table includes `drive_attachments` JSONB column
- Google OAuth 2.0 (PKCE flow) via `useGoogleAuth.js`; unified scope management for Gmail, Calendar, Drive, Docs, Sheets, Slides
- Google API modules: `src/api/driveApi.js`, `docsApi.js`, `sheetsApi.js`, `slidesApi.js` (typed wrappers with 401 retry)
- Vite for local dev

---

## References

| Trigger | File |
|---|---|
| Every session | `Claude_Prompts/Cycle_Programming_Workflow.md` |
| Writing or reviewing any code | `Claude_Prompts/Cycle_Programming_Code_Standards.md` |
| Planning or triaging | `Claude_Prompts/Known_Issues_And_Requests.md` |
| After resolving items | `Claude_Prompts/Resolved_Issues_And_Requests.md` |
| Updating HTML docs | `Claude_Prompts/Project_Summary.md` |
| Inspecting live schema | `scripts/README.md` |

---

## File structure

```
GTDWorkflowApp/
├── CLAUDE.md
├── Graphics/                  ← app icons and image assets
│   ├── getting-things-done.ico
│   └── getting-things-done.png
├── Product_Summary/
│   ├── project-summary.html
│   ├── project-commits.html
│   └── project-snippets.html
├── Claude_Prompts/
│   ├── Cycle_Programming_Claude.md   ← this file
│   ├── Cycle_Programming_Workflow.md
│   ├── Cycle_Programming_Code_Standards.md
│   ├── Cycle_Programming_UserProcess.md
│   ├── Known_Issues_And_Requests.md
│   ├── Resolved_Issues_And_Requests.md
│   └── Project_Summary.md
├── scripts/                   ← dev-session tools (not part of app bundle)
│   ├── get_schema.py          ← fetch live Supabase schema
│   └── README.md
├── src/
│   ├── App.jsx
│   ├── constants.jsx          ← COLORS, BUCKETS, COACH_MODES, SYSTEM_PROMPTS
│   ├── contexts.js
│   ├── main.jsx
│   ├── api/supabase.js
│   ├── features/
│   │   ├── calendar/
│   │   ├── coach/
│   │   ├── email/
│   │   ├── settings/
│   │   └── tasks/
│   ├── hooks/
│   │   ├── useSupabaseAuth.js
│   │   ├── useGoogleAuth.js
│   │   └── useSupabaseSync.js
│   ├── prompts/               ← exported copies of all AI system prompts
│   ├── shared/
│   ├── SQL/
│   └── Visual_Mockups/        ← exported copies of all mockups produced
└── README.md
```

File placement:
- SQL files and ALTER TABLE migrations → `src/SQL/`
- AI system prompt changes → update corresponding file in `src/prompts/` (`constants.jsx` is source of truth)
- Visual mockups → `Visual_Mockups/`
- New features → `src/features/<feature-name>/`

---

## Current app state

### Buckets

📥 Inbox · ⚡ Next Actions · 📁 Projects · ⏳ Waiting For · 💭 Someday/Maybe · ⏰ Deferred · ✅ Completed · 📋 Inbox History

### Task fields

`{ id, text, bucket, done, created, priority[], location[], dueDate, effort, actualEffort, deferUntil, notes, recurrence, childIds?, parentId? }`

### Task management

Add/edit/delete/move across buckets. Priority tags, location tags, due dates, effort estimates, defer-until. Task Detail Panel (360px side panel). Project hierarchy with drag-and-drop. Collapsible project tree. Descendant count badge. Cumulative effort totals. Waterfall filtering. Completed view hierarchy. In-bucket text filter (bypasses tree/grouping; resets on bucket change). Global search modal (Cmd+K / Ctrl+K) across all non-archive buckets with keyboard nav and match highlighting. Drive file attachments on tasks via Google Picker (stored as `driveAttachments[]`).

### AI Coach (6 modes)

Chat · Process · Weekly Review · Brain Dump · Project Review · Daily Review. Action lines: `→ACTION:update`, `→ACTION:add`, `→ACTION:create`.

- **Chat** — lazy task context: compact bucket-count summary + `get_task_context` tool on demand; other modes receive full task list
- **Process** — `→ACTION:add|<title>|parent:<id>` places tasks under existing projects; code-level question guard prevents auto-confirm when AI response contains a clarifying question; duplicate detection via expanded context (Next Actions + Waiting For visible to AI)
- **Brain Dump** — each captured item auto-added to Inbox via `→ACTION:create|<text>|bucket:inbox`

### API

`fetch` → `https://api.anthropic.com/v1/messages`. Chat mode uses lazy task context (compact summary + `get_task_context` tool); all other modes receive full task list. Claude + Ollama provider selector. Google Services settings panel: unified OAuth with per-service scope preferences.

---

## Branching model

- `main` — stable/releasable only. Never commit directly to main.
- `develop` — integration branch. All feature branches are cut from here and merged back here.
- Feature branches — named `feature/<slug>`, `fix/<slug>`, or `cq/<slug>`. Cut from `develop`, merge into `develop` when done.
- Releases — merge `develop` → `main` when a batch of work is stable and tested.

**At session start:** check out `develop` (or the relevant feature branch) before making any changes. Never commit to `main`.

---

## Ongoing maintenance

**Vite timestamp cleanup:** At session start, check for `vite.config.js.timestamp-*.mjs` in the project root. If 5 or more exist, delete them via desktop-commander:

```
Remove-Item "C:\Programming_Projects\GTDWorkflowApp\vite.config.js.timestamp-*.mjs" -Force
```

---

## Session behavior

**Approval gates**
- Do not ask for confirmation on individual steps that were already covered in an approved plan.
- If the plan says "commit each item separately," commit — do not ask before each commit.
- Ask for explicit go-ahead only when: scope has changed unexpectedly, a HALT condition was triggered, or a decision requires user judgment that wasn't anticipated in the plan.

**Testing checklists**
- Always present as an interactive widget (mcp__visualize__show_widget): state button cycles Pass → Fail → Skip → Note per item, per-item notes text field, Submit button calling sendPrompt() with full summary.
- Render the widget in TWO situations: (1) at the end of a cycle when presenting the checklist for the first time, and (2) whenever John asks which tests are outstanding or remaining — never answer that question in plain text.
- See Cycle_Programming_Workflow.md Phase 5 for full spec.

**Clarifying questions**
- If you can proceed confidently with a reasonable assumption, state the assumption and proceed rather than asking.

**Planning sessions (both variants)**
- Read all relevant source files once at the start of the planning turn. Do not re-read them mid-session unless a file has been edited.
- Produce the complete plan in a single response. Do not emit it incrementally across multiple turns.
- Capture exact replacement strings (old/new) during the planning turn while files are loaded. Do not defer this to execution time.

### Without Worker (Sonnet Only)

- Execute changes immediately after the plan is approved. No handoff document needed.
- Keep responses focused; avoid narrating tool calls.

### With Worker (Sonnet + Qwen)

- The planning turn must produce a self-contained work order file (`Claude_Prompts/WorkOrder_YYYY-MM-DD.md`). This is the primary artifact of the planning session.
- The work order must be complete enough that a non-interactive model can execute it without asking questions. Every ambiguity must be resolved in the work order, not deferred.
- Morning review sessions start cold (no prior conversation history). Provide the diff and execution log; do not assume context from the planning session.

---

## Backlog management

**Categories:**

| Category | Number format | Use when |
|---|---|---|
| Known Issues | `Issue#x` | Bug or broken behaviour |
| Code quality | `CQ#x` | Component size, test coverage, architecture |
| UI polish / quick wins | `FR#x` | Low-effort visible improvements |
| Daily workflow / GTD core | `FR#x` | Core GTD loop, planning, coach modes |
| Inbox / processing improvements | `FR#x` | Inbox flow, AI suggestions |
| Integrations / data | `FR#x` | Gmail, Calendar, Supabase, Todoist, etc. |
| Data model expansions | `FR#x` | New fields, buckets, task properties |
| Platform / reach | `FR#x` | Mobile, export, third-party sync |

**On new entry:** File a GitHub issue immediately via `mcp__github__create_issue` using the repo's label set. Record the GH# and creation date in `Known_Issues_And_Requests.md`:

```
- [ ] Issue#12 [GH#31] (2026-05-09) — description
```

Update the Last used numbers line at the top of the file.

**On root cause identified:** When the cause of an issue or the approach to a feature is determined — even before any code is written — update the corresponding GitHub issue with that reasoning. Include what the root cause is, what files/functions are involved, and the proposed fix. This keeps the issue self-documenting and avoids re-deriving the analysis if a session is interrupted.

**On resolution:** Delete the line from `Known_Issues_And_Requests.md`. Append a row to `Resolved_Issues_And_Requests.md` (date · type · # · GH# · name · commit hash). Close the GitHub issue via `mcp__github__update_issue` with `state: closed`.

**Triage on report:** Categorize immediately when John reports an issue or request. Ask one clarifying question if category is ambiguous. Do not begin investigation until the item is logged.

**Defer during active testing:** If a new issue arrives during Phases 5–6 of an open cycle, log it and acknowledge it, but do not investigate or propose changes until the current cycle is confirmed and committed.

---

## Key remembered preferences

- Run commands directly — do not hand copy-paste steps
- No emoji in responses unless asked
- Use `mcp__git__git_commit` for commits, not bash git (avoids HEAD.lock on Windows mount)
- Use `git -C "path" push origin develop` for push, not `cd && git push` (PowerShell `&&` is invalid)
- Supabase migrations: confirm John is ready, then run using the Management API directly (project ref `tudmteqljgpocffalssz`, token in `.env` as `SUPABASE_MANAGEMENT_TOKEN`). Verify with an `information_schema.columns` query before proceeding to testing. Never hand copy-paste SQL steps to John.
