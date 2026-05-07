# GTD Manager — Project Brief for Claude

## Working instructions
Before each set of tool calls, briefly explain what you're looking for and why.

## What this project is
A personal GTD (Getting Things Done) task manager built as a React single-page app. It combines a full task list with an AI coach powered by the Anthropic Claude API.

## User context
- Knowledge worker / desk job
- Has tried GTD before but fades after ~1 week
- Wants the AI to actively help maintain the GTD system, not just answer questions

## Tech stack
- React (functional components + hooks)
- Inline styles only — no CSS framework; shared tokens in `COLORS` object, styles in `s` object
- Anthropic Claude API (`claude-sonnet-4-6`) — also supports local LLMs via Ollama
- localStorage for persistence
- Vite for local dev

## File structure
```
gtd-project/
├── CLAUDE.md       ← this file
├── src/
│   └── App.jsx     ← entire app (single file, ~4014 lines)
└── README.md
```

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
- **Process** — walks inbox items one by one; recommends a bucket with one-click Move confirmation
- **Weekly Review** — guided 7-step review
- **Brain Dump** — prompts across life areas to surface open loops
- **Project Review** — reviews projects one by one; two sub-modes: Tasks (next action suggestions) and Metadata (effort/due date/defer suggestions with accept/reject per task)

### API integration
- `fetch` → `https://api.anthropic.com/v1/messages`
- System prompt includes full task list context on every call
- Provider selector supports Claude (Anthropic API) and local Ollama models

## Known issues / remaining work
- [ ] Brain Dump doesn't auto-add items to inbox — user has to copy manually (Chat mode can create tasks via `→ACTION:create`, but Brain Dump mode is not wired up)
- [ ] Weekly Review doesn't check off steps as completed
- [ ] No export or sync with Todoist
- [ ] Mobile layout not optimized
- [ ] Tasks only persist in localStorage — no backend or cross-device sync

## Suggested next features (in rough priority order)

### Code quality (Senior_Code_Engineer.md gaps — prioritised above product features)
1. [CODE QUALITY] Async error handling — `calendarApi.js` has 6 async functions with no `try/catch`; `gmailTools.js` has 21 async functions but only 3 are wrapped. Every async operation must explicitly handle loading, success, and error states with meaningful fallback UI.
2. [CODE QUALITY] Component size and single responsibility — every component file exceeds the ~100-line guideline. `calendar.jsx` (830 lines), `SettingsPanel.jsx` (760 lines), `email.jsx` (711 lines), `TaskDetailPanel.jsx` (624 lines), and `TaskRow.jsx` (553 lines) each contain multiple distinct sub-components that should be split into their own files. `App.jsx` (2,579 lines) violates single responsibility most severely — `GTDManager` orchestrates state, data flow, event handling, and rendering all at once.
3. [CODE QUALITY] Presentational/container separation — `TaskRow`, `TaskDetailPanel`, and `SettingsPanel` mix rendering with business logic. Refactor into pure presentational components (receive data via props, render only) backed by container components or hooks that handle state and side effects.
4. [CODE QUALITY] Feature-based file structure — current structure organises by file type (`/components/`, `/hooks/`). Standard calls for feature-based organisation (e.g. `/features/Email/`, `/features/Calendar/`) with component, hook, and utils co-located per feature.
5. [CODE QUALITY] Array index as key — 9 instances of `key={i}` or `key={idx}` across the codebase. Static lists (typing indicator dots) are low risk; dynamic lists in `calendar.jsx` and `email.jsx` should use stable unique keys to avoid rendering bugs.

### Product features
6. Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)
7. Daily focus view (pick 3 Most Important Tasks from Next Actions)
8. Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
9. Todoist export / two-way sync
10. Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
11. Multi-device sync (Supabase or similar)
12. Dark-theme checkboxes — native browser checkboxes throughout the app don't respect the dark theme; replace with styled custom checkboxes consistent with the COLORS token system
13. Remove "Process with AI" button from the left sidebar navigation panel
14. Daily Review button (replaces "Process with AI" in sidebar) — context-aware: shows "Start Day" in the morning or if the start-of-day review hasn't run yet that calendar day; shows "End Day" in the afternoon/evening or after start-of-day completes. Button label/icon changes to reflect state. Must handle incomplete/interrupted start-of-day reviews gracefully. Persist daily review state (last run date + phase) in localStorage.
15. AI-assisted daily planning — evaluate calendar + task list to build an optimized daily todo list; accounts for effort estimates on tasks and adds travel time estimates for external/offsite calendar events. Likely a new AI coach mode.
16. Shopping list manager — lightweight tool for managing shopping lists, likely as a new bucket or sidebar section distinct from the GTD task buckets
17. Gmail inbox financial detail capture — when processing emails, extract any financial details (amounts, due dates, account references) and export them to a Google Sheet in Google Drive
18. Gmail inbox rate limiting — inbox metadata fetches hit Gmail's 429 rate limit when loading many messages in parallel; add request queuing / exponential backoff to eliminate the errors
19. [RETHINK] Inbox History bucket exposure to AI — currently `inboxHistory` is excluded from `getTaskContext` and from valid `→ACTION:update` bucket targets, so the AI can't move tasks there via chat. This was intentional (Inbox History is system-managed via Process mode) but may be too restrictive. Decide: should the AI be able to file tasks directly to Inbox History, and if so, should it also be able to see tasks already there?

## API Key setup (local dev)
Create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
In App.jsx fetch headers use: `import.meta.env.VITE_ANTHROPIC_API_KEY`

**Never commit `.env` to git.**
