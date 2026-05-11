# GTD Manager — Project Brief for Claude

## Working instructions
- Before each set of tool calls, briefly explain what you're looking for and why.
- When John reports an issue or new request, triage and categorise it immediately — see the Backlog management section below. Ask one clarifying question if the category is ambiguous before recording it.

## Ongoing maintenance
- **Vite timestamp cleanup:** At the start of each session, check for `vite.config.js.timestamp-*.mjs` files in the project root. If 5 or more exist, delete them all with:
  `Remove-Item "C:\Programming_Projects\GTDWorkflowApp\vite.config.js.timestamp-*.mjs" -Force`

## What this project is
A personal GTD (Getting Things Done) task manager built as a React SPA with an AI coach powered by the Anthropic Claude API. Integrates with Google services (Gmail, Google Calendar, Drive, Docs, Sheets, Slides) for email management, calendar sync, and file attachments.

## User context
- Knowledge worker / desk job
- Has tried GTD before but fades after ~1 week
- Wants the AI to actively help maintain the GTD system, not just answer questions

## Tech stack
- React (functional components + hooks)
- Inline styles only — no CSS framework; shared tokens in `COLORS` object, styles in `s` object
- Anthropic Claude API (`claude-sonnet-4-6`) — also supports local LLMs via Ollama
- **Supabase** for primary persistence (tasks + user_settings tables); real-time subscription channel for cross-device sync
- localStorage as fallback for unauthenticated sessions and as one-time migration source when Supabase is empty on first auth
- `useSupabaseAuth.js` — Supabase auth hook; `src/api/supabase.js` — client + field mappers (`taskToDb` / `dbToTask`, `queueEntryToRow` / `rowToQueueEntry`); tasks table includes `drive_attachments` JSONB column; `gmail_queue` table for email cleanup queue
- Google OAuth 2.0 (PKCE flow) via `useGoogleAuth.js`; unified scope management for Gmail, Calendar, Drive, Docs, Sheets, Slides
- Google API modules: `src/api/driveApi.js`, `docsApi.js`, `sheetsApi.js`, `slidesApi.js` (typed wrappers with 401 retry)
- Vite for local dev

## Coding standards
See `Claude_Prompts/Senior_Code_Engineer.md` — read this file whenever writing or reviewing any code.

## Pairing workflow
See `Claude_Prompts/AI_Pair_Programming.md` — read this file at the start of any development session and follow it for every change.

## Known issues & roadmap
See `Claude_Prompts/Known_Issues_And_Requests.md` — read this when planning new features or triaging bugs.

## Resolved issues & requests
See `Claude_Prompts/Resolved_Issues_And_Requests.md` — add an entry after every commit that closes a known issue or completes a feature request.

## Project documentation
See `Claude_Prompts/Project_Summary.md` — read this when updating the HTML summary docs in `Product_Summary/` (`project-summary.html`, `project-snippets.html`, `project-commits.html`).

## File structure
```
GTDWorkflowApp/
├── CLAUDE.md                        ← this file
├── Product_Summary/                 ← project overview docs (not committed to dev workflow)
│   ├── project-summary.html         ← high-level project summary
│   ├── project-commits.html         ← commit history view
│   ├── project-snippets.html        ← code snippet reference
│   └── GTDWorkflowApp_ProjectSummary.html
├── Claude_Prompts/                  ← Claude workflow docs (NOT app prompts)
│   ├── AI_Pair_Programming.md
│   ├── Senior_Code_Engineer.md
│   ├── Known_Issues_And_Requests.md
│   ├── Resolved_Issues_And_Requests.md
│   └── Project_Summary.md
├── src/
│   ├── App.jsx                      ← top-level layout + auth gate wiring
│   ├── constants.jsx                ← COLORS, BUCKETS, COACH_MODES, SYSTEM_PROMPTS
│   ├── contexts.js                  ← React contexts
│   ├── main.jsx                     ← Vite entry point
│   ├── api/
│   │   └── supabase.js              ← Supabase client + field mappers (taskToDb/dbToTask)
│   ├── features/                    ← feature-based organisation (one folder per domain)
│   │   ├── calendar/                ← Google Calendar view, API calls, event display
│   │   ├── coach/                   ← AI coach panel, callAI hook, project review
│   │   ├── email/                   ← Gmail inbox, rules, cleanup panels + tools
│   │   ├── settings/                ← settings panel, usage tracker, app settings hooks
│   │   └── tasks/                   ← task list, task row, detail panel, CRUD hooks
│   ├── hooks/                       ← cross-feature hooks (auth, sync)
│   │   ├── useSupabaseAuth.js
│   │   ├── useGoogleAuth.js
│   │   └── useSupabaseSync.js
│   ├── prompts/                     ← exported copies of all AI system prompts
│   │   ├── 01_chat.md               ← SYSTEM_PROMPTS.chat
│   │   ├── 02_process.md            ← SYSTEM_PROMPTS.process
│   │   ├── 03_weekly_review.md      ← SYSTEM_PROMPTS.review
│   │   ├── 04_project_review.md     ← SYSTEM_PROMPTS.projectReview
│   │   ├── 05_project_metadata.md   ← SYSTEM_PROMPTS.projectMetadata
│   │   ├── 06_brain_dump.md         ← SYSTEM_PROMPTS.dump
│   │   └── 07_calendar_event.md     ← SYSTEM_PROMPTS.calendarEvent
│   ├── shared/                      ← reusable UI components (sidebar, auth gate, etc.)
│   └── SQL/                         ← Supabase schema + migration SQL
│       ├── tasks_schema.sql         ← public.tasks table + RLS + indexes + migrations
│       ├── user_settings_schema.sql ← public.user_settings table + RLS
│       ├── gmail_queue_schema.sql   ← public.gmail_queue table + RLS + indexes
│       └── setup_supabase_schema.py ← one-time setup script (run via Management API)
└── README.md
```

## File placement conventions
- **SQL files** (new tables, ALTER TABLE migrations, RLS policies): `src/SQL/`
  - Add migrations as a new section in the relevant `*_schema.sql` file
  - Keep `setup_supabase_schema.py` in sync if re-running from scratch
- **AI system prompts** (any change to `SYSTEM_PROMPTS` in `constants.jsx`): update the corresponding file in `src/prompts/`
  - `src/constants.jsx` is the source of truth; `src/prompts/` files are reference exports
- **Visual mockups** (HTML wireframes or design mockups): `Visual_Mockups/`
- **New features**: add a folder under `src/features/<feature-name>/` — do not create new top-level `components/` or `hooks/` directories

## Current state of the app

### Buckets (sidebar navigation)
- 📥 **Inbox** — unprocessed capture
- ⚡ **Next Actions** — concrete physical actions; supports groupBy (none / location / project / due date / effort)
- 📁 **Projects** — multi-step goals with full project hierarchy (parent/child via `childIds`/`parentId`)
- ⏳ **Waiting For** — delegated items
- 💭 **Someday/Maybe** — future ideas
- ⏰ **Deferred** — virtual view of tasks with a future `deferUntil` date; tasks auto-move to Inbox on wake date
- ✅ **Completed** — finished tasks
- 📋 **Inbox History** — processed inbox items archived for reference

### Task fields
Every task object: `{ id, text, bucket, done, created, priority[], location[], dueDate, effort, actualEffort, deferUntil, notes, recurrence, childIds?, parentId? }`

### Task management features
- Add tasks to any bucket; "Add & Ask AI" adds to Inbox and opens AI processing immediately
- Inline title editing (pencil icon)
- Complete / delete tasks
- Move tasks between buckets via dropdown
- Priority tags, location tags (multi-select), due dates, effort estimates, defer-until dates
- Overdue highlighting on tasks past their due date
- **Task Detail Panel** — click any task title to open a 360px side panel with: editable title, full notes textarea (autosave on blur), metadata editing (due/defer/effort/location), bucket move dropdown, complete/delete buttons. Close via ×, Escape, or bucket change. Tasks with notes show a 📝 indicator in the row.
- **Project hierarchy** — tasks can have children; drag-and-drop reordering within Projects view
- **Collapsible project tree** — toolbar buttons: ≡ Projects Only / ⊖ Collapse All / ⊕ Expand All
- **Descendant count badge** — shows `↓ incomplete / total` on tasks with children
- **Cumulative effort totals** — recursive sum shown on project rows and Next Actions group headers
- **Waterfall filtering** in Next Actions — tasks with unfinished predecessors are hidden
- **Collapsible settings sections** — each settings section (API config, Efforts, Locations, etc.) collapses independently; open/closed state persisted in localStorage
- **Effort list auto-sort** — efforts sorted shortest→longest on add, using calendar time (1 day = 1440 min, 1 week = 10080 min, 1 month = 43200 min)
- **Completed view hierarchy** — Completed bucket preserves project tree structure; virtual root detection shows only top-level done tasks at root, children nested beneath their parent

### AI Coach (bottom panel — 5 modes)
- **Chat** — free-form; AI sees full task list and gives contextual GTD advice. Supports task mutations via action lines the AI appends to its reply:
  - `→ACTION:update` — edit any field on an existing task (including `recurrence` and `actualEffort`)
  - `→ACTION:add` — create a child task under an existing parent (updates both `parentId` and parent's `childIds`)
  - `→ACTION:create` — create a standalone task in any bucket
  - Failed actions surface as a follow-up error bubble in the chat; success shown as an update chip
- **Process** — walks inbox items one by one; recommends a bucket with one-click Move confirmation. Supports `→ACTION:add|<title>|parent:<id>` to place tasks under existing projects. Code-level guard prevents auto-confirm when AI response contains a clarifying question. Duplicate detection: AI sees Next Actions + Waiting For context.
- **Weekly Review** — guided 7-step review
- **Brain Dump** — prompts across life areas to surface open loops; each captured item auto-added to Inbox via `→ACTION:create|<text>|bucket:inbox`
- **Project Review** — reviews projects one by one; two sub-modes: Tasks (next action suggestions) and Metadata (effort/due date/defer suggestions with accept/reject per task)

### API integration
- `fetch` → `https://api.anthropic.com/v1/messages`
- Chat mode: compact bucket-count summary + `get_task_context` tool on demand. All other modes receive the full task list.
- Provider selector supports Claude (Anthropic API) and local Ollama models
- **Google Services settings** — unified OAuth panel; per-service scope selector; single "Authorize Google" button; scope preferences persisted in localStorage

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

**Defer during active testing:** If a new issue arrives during Phases 5–6 of an open workflow, log it and acknowledge it, but do not investigate or propose changes until the current cycle is confirmed and committed.
