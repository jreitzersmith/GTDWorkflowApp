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
│   └── App.jsx     ← entire app (single file, ~2850 lines)
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
Every task object: `{ id, text, bucket, done, created, priority[], location[], dueDate, effort, deferUntil, notes, childIds?, parentId? }`

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

### AI Coach (bottom panel — 5 modes)
- **Chat** — free-form; AI sees full task list and gives contextual GTD advice
- **Process** — walks inbox items one by one; recommends a bucket with one-click Move confirmation
- **Weekly Review** — guided 7-step review
- **Brain Dump** — prompts across life areas to surface open loops
- **Project Review** — reviews projects one by one; two sub-modes: Tasks (next action suggestions) and Metadata (effort/due date/defer suggestions with accept/reject per task)

### API integration
- `fetch` → `https://api.anthropic.com/v1/messages`
- System prompt includes full task list context on every call
- Provider selector supports Claude (Anthropic API) and local Ollama models

## Known issues / remaining work
- [ ] Brain Dump doesn't auto-add items to inbox — user has to copy manually
- [ ] Weekly Review doesn't check off steps as completed
- [ ] No export or sync with Todoist
- [ ] Mobile layout not optimized
- [ ] Tasks only persist in localStorage — no backend or cross-device sync

## Suggested next features (in rough priority order)
1. Brain Dump auto-capture (AI extracts items and adds them directly to Inbox)
2. Daily focus view (pick 3 Most Important Tasks from Next Actions)
3. Todoist export / two-way sync
4. Recurring tasks
5. Multi-device sync (Supabase or similar)

## API Key setup (local dev)
Create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
In App.jsx fetch headers use: `import.meta.env.VITE_ANTHROPIC_API_KEY`

**Never commit `.env` to git.**
