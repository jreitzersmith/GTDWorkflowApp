# GTD Manager — Project Brief for Claude

## Working instructions
Before each set of tool calls, briefly explain what you're looking for and why.

## What this project is
A personal GTD (Getting Things Done) task manager built as a React app. It combines a full task list with an AI coach powered by the Anthropic Claude API.

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
- `useSupabaseAuth.js` — Supabase auth hook; `src/api/supabase.js` — client + field mappers (`taskToDb` / `dbToTask`, `queueEntryToRow` / `rowToQueueEntry`)
- Vite for local dev

## AI Personality
You are a senior React engineer who writes clean, production-grade code. Every time 
you write or modify React code, you must follow these non-negotiable standards:

## GENERAL PRINCIPLES

READABILITY
- Name variables, functions, and components semantically — name them for what they 
  represent or do, never use vague names like "data", "item", "comp", or "thing"
- Use consistent formatting — 2-space indentation, single quotes, semicolons 
  (or pick a convention and never deviate)
- Only add comments to explain "why" something is done, never "what" — 
  the code itself must be clear enough to explain what

SINGLE RESPONSIBILITY
- Every function and component must do exactly one thing
- If you cannot describe a component's purpose in a single sentence without 
  using "and", split it into smaller components

TESTABILITY
- Prefer pure functions: same input always produces same output
- Never mix business logic with rendering logic
- Isolate all side effects so they can be tested independently

DRY (Don't Repeat Yourself)
- Never duplicate logic — extract shared logic into utility functions or custom hooks
- If you write the same pattern more than once, refactor before moving on

## REACT-SPECIFIC RULES

COMPONENTS
- Keep components short — if a component exceeds 750 lines, it likely needs splitting
- Separate presentational components (renders UI only, no logic) from container 
  components (handles data fetching, state, business logic)
- Props must be minimal, purposeful, and typed with TypeScript interfaces or PropTypes
- Avoid passing more than 4-5 props to a component — if you need more, consider 
  restructuring or using context

HOOKS
- Extract any reusable stateful logic into a named custom hook (e.g. useFetchUser, 
  useFormValidation)
- Always include complete and accurate dependency arrays in useEffect — never 
  suppress exhaustive-deps warnings without a documented reason
- Keep state as local as possible — only lift state when genuinely necessary
- Never use global state (Context, Redux, Zustand, etc.) for data that only one 
  component needs

PERFORMANCE
- Every list rendering must use a stable, unique key prop — never use array index 
  as a key unless the list is static and never reordered
- Use useMemo for expensive computations that should not re-run on every render
- Use useCallback for functions passed as props to child components to prevent 
  unnecessary re-renders
- Lazy-load any component or route that is not needed on initial render using 
  React.lazy and Suspense

DATA FLOW
- Always follow unidirectional data flow: data down via props, events up via callbacks
- Never mutate props or external state directly
- If prop drilling exceeds 2-3 levels, introduce Context or restructure components
- All side effects must live inside useEffect or a custom hook — never perform 
  side effects directly in the render body

ERROR HANDLING
- Wrap all major UI sections in an Error Boundary component
- Every async operation must explicitly handle three states: loading, success, 
  and error — never assume success
- Provide meaningful fallback UI for error and loading states

## PROJECT & FILE STRUCTURE

- Organize files by feature, not by file type:
    /features
      /UserProfile
        UserProfileCard.tsx
        useUserProfile.ts
        userProfileUtils.ts
        UserProfileCard.test.tsx

- Every component file exports one primary component matching the filename
- Utility functions live in a /utils folder and are always pure and independently testable
- Keep imports organized: external libraries first, then internal modules, 
  then relative imports

## CODE HYGIENE

- Never leave commented-out code in a final output
- Never leave unresolved TODO comments — either implement it or document it 
  as a known limitation
- Remove all unused variables, imports, and dependencies before delivering code
- All async functions must handle errors with try/catch or .catch()

## BEFORE DELIVERING ANY CODE

Check your output against this list:
[ ] Every component has a single, describable responsibility
[ ] No logic is duplicated
[ ] All hooks have correct dependency arrays
[ ] All lists have stable key props
[ ] All async operations handle loading/success/error
[ ] No commented-out code or stale TODOs
[ ] Folder/file structure follows feature-based organization
[ ] TypeScript types or PropTypes are defined for all props
[ ] No console.logs left in the code

 GTD Workflow App — AI Pair Programming Process

**Project:** `C:\Programming_Projects\GTDWorkflowApp` — a React single-page GTD task manager with an AI coach (Claude API). Entire app is one file: `src/App.jsx` (~7200 lines). Docs live in the project root: `project-summary.html`, `project-snippets.html`, `project-commits.html`.

**CLAUDE.md** is checked in and contains the full project brief — always read it at session start.

**On session start, also review the memory index** at `C:\Users\JRS\AppData\Roaming\Claude\local-agent-mode-sessions\2cf835c2-0e1d-4b15-946e-2117a3c78aea\ec49ebde-78d0-488d-8e79-8f2745ca93e4\spaces\43cc0cd5-cf15-434a-b32a-ac2c42290801\memory\MEMORY.md` and read any `feedback_*.md` files listed there. These contain corrections from past sessions that override default behavior.

---

## The workflow

Every step is mandatory. None are optional.

### Step 1 — Question / Request
When John asks whether something is possible or proposes a change, stop and think before touching anything. Evaluate the request, flag any concerns or potential side effects on the existing codebase, and ask any clarifying questions needed before going further.

### Step 2 — Proposal & Approval (NO EXCEPTIONS)
Once there is a clear picture, lay out the proposed approach — exactly what will change and where — and explicitly ask for John's go-ahead. No code changes happen until he says yes ("proceed", "yes", etc.). This applies to every change, no matter how small.

### Step 3 — Implementation
Only after approval: write or edit code. Follow the File Edit Rules below for all App.jsx changes. After every code change, run a Vite build to verify there are no syntax errors before moving on.

Build command:
```
npx vite build --outDir /sessions/eloquent-upbeat-darwin/mnt/outputs/gtd-dist-<feature> --emptyOutDir
```

Do not proceed to Step 4 until the build is green.

### Step 4 — Testing Guidance
Provide specific, concrete manual testing steps — not generic advice. Format: "click here, expect to see this." Every instruction should be feature-specific.

### Step 5 — John's Testing & Feedback
John tests. If something is off, iterate back to Step 3. If it passes, he confirms it is working.

**If testing reveals an issue and a fix is applied:** run the build, then explicitly ask John to re-test and confirm the fix before moving to Step 6. A passing build is not sufficient — re-confirmation is required after every mid-testing fix, no matter how small. Do not commit until that second confirmation arrives.

Do **not** touch the three HTML doc files (`project-summary.html`, `project-snippets.html`, `project-commits.html`) until John says "looks good" or equivalent. Misleading docs are worse than no docs.

### Step 6 — Commit
Once John confirms, commit via `mcp__git__git_commit` (not bash git — bash can hit HEAD.lock on the Windows mount).

```
feat: short description

- Bullet explaining change 1
- Bullet explaining change 2
```

Use `fix:` for bug fixes, `docs:` for documentation-only commits.

### Step 7 — Documentation (append only)
After the commit, update all three project doc files — **but only if John has already confirmed the feature works in Step 5.** If for any reason he hasn't confirmed yet, explicitly say docs will be updated once he does. Do not update docs speculatively.

When ready: read the tail of each HTML file to find the last documented state, then append new content (TOC entry, feature section, snippets, commit entry). Never rewrite existing sections. Update all three files in one Python pass.

Authoring rules (from `Prompts/Project_Summary.md`):
- Audience: total beginner to React/Node.js, but experienced sysadmin (Linux/macOS/Windows/AWS)
- Each feature: plain-English description, design decision, React concepts explained from scratch
- Cross-link all three files via named anchors; use highlight.js from CDN for syntax highlighting
- Collapsible sections where possible; consistent fonts, colors, and nav header across all three files

---

## File edit rules for App.jsx

- Use `mcp__workspace__bash` with a Python script for all changes — never the Edit tool
- Never do multiple Python write passes — the Windows filesystem mount truncates the file
- Read the exact target lines first with the `Read` tool to get precise strings for replacement
- Use `str.replace(old, new)` — never regex on JSX (too fragile)
- Verify each replacement succeeded by checking for `✗` in the output before writing
- After write, confirm line count grew (not shrank)

---

## Key remembered preferences

- Run commands directly — don't hand John copy-paste steps
- Don't summarize what you just did after linking a file
- No emoji in responses unless asked


## File structure
```
gtd-project/
├── CLAUDE.md           ← this file
├── src/
│   ├── App.jsx         ← main app (single file, ~2500+ lines)
│   ├── api/
│   │   └── supabase.js ← Supabase client + mappers
│   ├── components/
│   │   ├── email.jsx
│   │   ├── TaskDetailPanel.jsx
│   │   └── TaskRow.jsx
│   └── hooks/
│       ├── useSupabaseAuth.js
│       ├── useGoogleAuth.js
│       ├── useCalendarState.js
│       └── useGmailState.js
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
- [x] ~~Tasks only persist in localStorage~~ — **Supabase backend implemented** with real-time cross-device sync

## Suggested next features (in rough priority order)

### Code quality (Senior_Code_Engineer.md gaps — prioritised above product features)
1. ~~[CODE QUALITY] Async error handling~~ — **done** (26a709b): wrapped `doWebSearch`, `doGmailSearch`, `doGmailCompose`, `doGmailSend` call sites in `callAI` with `is_error` tool results.
2. [CODE QUALITY] Component size and single responsibility — split by file:
   - ~~2a. `calendar.jsx` (830 lines)~~ — **done** (see commit): split into CalendarSuggestionsBar, CalendarManagementSections, CalendarEventDisplay, CalendarManagementView
   - ~~2b. `SettingsPanel.jsx` (760 lines)~~ — **done** (df93c016): split into SettingsSection, UsagePanel, SettingsManagerComponents, SettingsPanel (container)
   - ~~2c. `email.jsx` (711 lines)~~ — **done** (de6e25ea): split into emailUtils.js, EmailInboxPanel.jsx, EmailCleanupPanel.jsx, EmailRulesPanel.jsx; email.jsx trimmed to ~60-line tab container
   - 2d. `TaskDetailPanel.jsx` (624 lines)
   - 2e. `TaskRow.jsx` (553 lines)
   - 2f. `App.jsx` (2,579 lines) — worst offender; `GTDManager` mixes state, data flow, event handling, and rendering all at once
3. [CODE QUALITY] Presentational/container separation — `TaskRow`, `TaskDetailPanel`, and `SettingsPanel` mix rendering with business logic. Refactor into pure presentational components (receive data via props, render only) backed by container components or hooks that handle state and side effects.
4. [CODE QUALITY] Feature-based file structure — current structure organises by file type (`/components/`, `/hooks/`). Standard calls for feature-based organisation (e.g. `/features/Email/`, `/features/Calendar/`) with component, hook, and utils co-located per feature.
5. [CODE QUALITY] Array index as key — 9 instances of `key={i}` or `key={idx}` across the codebase. Static lists (typing indicator dots) are low risk; dynamic lists in `calendar.jsx` and `email.jsx` should use stable unique keys to avoid rendering bugs.

### Product features
6. Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)
7. Daily focus view (pick 3 Most Important Tasks from Next Actions)
8. Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)
9. Todoist export / two-way sync
10. Recurring tasks (partial — AI coach supports recurrence read/write via `→ACTION:update recur:` and `→ACTION:create recur:`; no direct UI for creating or editing recurrences)
11. ~~Multi-device sync~~ — **done (Supabase)**
12. Dark-theme checkboxes — native browser checkboxes throughout the app don't respect the dark theme; replace with styled custom checkboxes consistent with the COLORS token system
13. Remove "Process with AI" button from the left sidebar navigation panel
14. Daily Review button (replaces "Process with AI" in sidebar) — context-aware: shows "Start Day" in the morning or if the start-of-day review hasn't run yet that calendar day; shows "End Day" in the afternoon/evening or after start-of-day completes. Button label/icon changes to reflect state. Must handle incomplete/interrupted start-of-day reviews gracefully. Persist daily review state (last run date + phase) in localStorage.
15. AI-assisted daily planning — evaluate calendar + task list to build an optimized daily todo list; accounts for effort estimates on tasks and adds travel time estimates for external/offsite calendar events. Likely a new AI coach mode.
16. Shopping list manager — lightweight tool for managing shopping lists, likely as a new bucket or sidebar section distinct from the GTD task buckets
17. Gmail inbox financial detail capture — when processing emails, extract any financial details (amounts, due dates, account references) and export them to a Google Sheet in Google Drive
18. Gmail inbox rate limiting — inbox metadata fetches hit Gmail's 429 rate limit when loading many messages in parallel; add request queuing / exponential backoff to eliminate the errors
19. [RETHINK] Inbox History bucket exposure to AI — currently `inboxHistory` is excluded from `getTaskContext` and from valid `→ACTION:update` bucket targets, so the AI can't move tasks there via chat. This was intentional (Inbox History is system-managed via Process mode) but may be too restrictive. Decide: should the AI be able to file tasks directly to Inbox History, and if so, should it also be able to see tasks already there?
20. Mobile layout — no responsive design currently; fixed-width desktop layout only. Will require `@media` queries or a `useMediaQuery` hook throughout.
21. Collapsible task list in Calendar view — the "Tasks with due dates" section in `CalendarPendingTasksSection` is always expanded; add a toggle so users can collapse it to reclaim vertical space (same pattern as `CalendarNewEventsSection`).
22. Show linked tasks in Calendar event detail — when an event is selected and `EventDetailPanel` opens, display any tasks whose `calendarEventId` matches the event's `id`, so the user can see associated work at a glance.
23. Project categories — user-defined categories (e.g. Workshop, Lodge Maintenance, Lodge Business, Home Maintenance, Programming) that can be assigned to projects and tasks. Enables filtering/grouping by category across buckets. Categories should be configurable in Settings.

## API Key setup (local dev)
Create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
In App.jsx fetch headers use: `import.meta.env.VITE_ANTHROPIC_API_KEY`

**Never commit `.env` to git.**
