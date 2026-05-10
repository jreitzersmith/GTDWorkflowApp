# GTD Manager — Project Brief for Claude

## What this project is

A personal GTD task manager built as a React SPA with an AI coach powered by the Anthropic Claude API. Primary persistence via Supabase (tasks + user_settings tables); localStorage fallback for unauthenticated sessions. Real-time cross-device sync via Supabase subscription channel.

## User context

Knowledge worker / desk job. Has tried GTD before but fades after ~1 week. Wants the AI to actively maintain the GTD system, not just answer questions. Is a capable sysadmin (Linux/macOS/Windows/AWS) but new to React/Node and to AI-assisted pair programming.

---

## Tech stack

- React (functional components + hooks), inline styles only, shared tokens in `COLORS`, styles in `s`
- Anthropic Claude API (`claude-sonnet-4-6`); local Ollama support for coach panel
- Supabase: `tasks` + `user_settings` tables; `useSupabaseAuth.js`, `src/api/supabase.js` (field mappers: `taskToDb`/`dbToTask`, `queueEntryToRow`/`rowToQueueEntry`)
- Vite for local dev

## Coding standards

See `Claude_Prompts/Senior_Code_Engineer.md`. Read it before writing or reviewing any code.

## Pairing workflow

See `Claude_Prompts/AI_Pair_Programming.md`. Read it at session start and follow it for every change.

## Known issues and roadmap

See `Claude_Prompts/Known_Issues_And_Requests.md`. Read when planning or triaging.

## Resolved issues

See `Claude_Prompts/Resolved_Issues_And_Requests.md`. Append after every resolving commit.

## Project documentation

See `Claude_Prompts/Project_Summary.md` before updating HTML docs in `Product_Summary/`.

---

## File structure

```
GTDWorkflowApp/
├── CLAUDE.md
├── Product_Summary/
│   ├── project-summary.html
│   ├── project-commits.html
│   └── project-snippets.html
├── Claude_Prompts/
│   ├── AI_Pair_Programming.md
│   ├── Senior_Code_Engineer.md
│   ├── Known_Issues_And_Requests.md
│   ├── Resolved_Issues_And_Requests.md
│   ├── Project_Summary.md
│   └── User_Instructions.md
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
│   └── SQL/
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

Add/edit/delete/move across buckets. Priority tags, location tags, due dates, effort estimates, defer-until. Task Detail Panel (360px side panel). Project hierarchy with drag-and-drop. Collapsible project tree. Descendant count badge. Cumulative effort totals. Waterfall filtering. Completed view hierarchy.

### AI Coach (5 modes)

Chat · Process · Weekly Review · Brain Dump · Project Review. Action lines: `→ACTION:update`, `→ACTION:add`, `→ACTION:create`.

### API

`fetch` → `https://api.anthropic.com/v1/messages`. Full task list in system prompt. Claude + Ollama provider selector.

---

## Ongoing maintenance

**Vite timestamp cleanup:** At session start, check for `vite.config.js.timestamp-*.mjs` in the project root. If 5 or more exist, delete them:

```
Remove-Item "C:\Programming_Projects\GTDWorkflowApp\vite.config.js.timestamp-*.mjs" -Force
```

---

## Response format and behavior preferences

These preferences apply to all sessions and both workflow variants. They exist to minimize unnecessary token usage and round-trips.

**Verbosity**
- Do not summarize what you just did after completing a task. The user can read the output.
- Do not add preamble before files or explanations before tool calls.
- Inline notes are preferred over full paragraphs when a decision has an obvious rationale.

**Approval gates**
- Do not ask for confirmation on individual steps that were already covered in an approved plan.
- If the plan says "commit each item separately," commit — do not ask before each commit.
- Ask for explicit go-ahead only when: scope has changed unexpectedly, a HALT condition was triggered, or a decision requires user judgment that wasn't anticipated in the plan.

**Clarifying questions**
- Ask one clarifying question when category is ambiguous, not a list.
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

**On resolution:** Delete the line from `Known_Issues_And_Requests.md`. Append a row to `Resolved_Issues_And_Requests.md` (date · type · # · GH# · name · commit hash). Close the GitHub issue via `mcp__github__update_issue` with `state: closed`.

**Triage on report:** Categorize immediately when John reports an issue or request. Ask one clarifying question if category is ambiguous. Do not begin investigation until the item is logged.

**Defer during active testing:** If a new issue arrives during Phases 5–6 of an open cycle, log it and acknowledge it, but do not investigate or propose changes until the current cycle is confirmed and committed.

---

## Key remembered preferences

- Run commands directly — do not hand copy-paste steps
- No emoji in responses unless asked
- Use `mcp__git__git_commit` for commits, not bash git (avoids HEAD.lock on Windows mount)
- Use `git -C "path" push origin main` for push, not `cd && git push` (PowerShell `&&` is invalid)
- Claude Desktop on this machine is MSIX-packaged; config is at `C:\Users\JRS\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
