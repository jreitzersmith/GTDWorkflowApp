# GTD Manager — Project Brief for Claude

## What this project is
A personal GTD (Getting Things Done) task manager built as a React single-page app. It combines a full task list with an AI coach powered by the Anthropic Claude API.

## User context
- Knowledge worker / desk job
- Has tried GTD before but fades after ~1 week
- Starting fresh with no prior system
- Uses Todoist (or will), wants an AI-assisted alternative/companion
- Wants the AI to actively help maintain the GTD system, not just answer questions

## Current state of the app (what's built)
The app is a single React component (`src/App.jsx`) with:

### Task management
- Five GTD buckets: Inbox, Next Actions, Projects, Waiting For, Someday/Maybe + Completed
- Add tasks to any bucket
- "Add & Ask AI" — adds to inbox and immediately opens AI processing
- Move tasks between buckets via dropdown
- Complete/delete tasks
- Task counts per bucket in sidebar
- Tasks persist via localStorage

### AI Coach (bottom panel, 4 modes)
- **Chat** — free-form, AI sees full task list, gives contextual GTD advice
- **Process** — walks inbox items one by one, recommends a bucket, shows a one-click "Move" confirmation bar
- **Weekly Review** — guided 7-step review
- **Brain Dump** — prompts across life areas to surface open loops

### API integration
- Uses `fetch` to call `https://api.anthropic.com/v1/messages`
- Model: `claude-sonnet-4-20250514`
- System prompt includes full task list context on every call
- API key must be injected (see Setup below)

## Known issues / next steps
- [ ] API key is currently hardcoded as empty — needs env var or input field
- [ ] No way to edit a task's text after creation
- [ ] No due dates or priority levels
- [ ] No way to add notes/context to a task
- [ ] Brain Dump doesn't auto-add items to inbox — user has to do it manually
- [ ] Weekly Review doesn't check off steps as completed
- [ ] No export or sync with Todoist
- [ ] Mobile layout not optimized
- [ ] Tasks only persist in localStorage — no backend/sync across devices

## Suggested next features (in priority order)
1. Inline task editing (double-click to edit)
2. Task notes field
3. Due dates with overdue highlighting
4. Brain Dump auto-capture (AI extracts items and adds them directly)
5. Todoist export / two-way sync
6. Daily focus view (pick 3 Most Important Tasks from Next Actions)
7. Recurring tasks
8. Multi-device sync (Supabase or similar)

## Tech stack
- React (functional components + hooks)
- Inline styles (no CSS framework)
- Anthropic Claude API (claude-sonnet-4-20250514)
- localStorage for persistence
- No build tool required if using Claude Artifacts; needs Vite/CRA for standalone

## Setup for standalone development
```bash
npm create vite@latest gtd-manager -- --template react
cd gtd-manager
cp path/to/App.jsx src/App.jsx
npm install
# Add your API key (see below)
npm run dev
```

## API Key
For local dev, create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```
Then in App.jsx, replace the fetch headers with:
```js
"x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
"anthropic-version": "2023-06-01",
```

**Note:** In the Claude Artifacts environment, the API key is injected automatically — do not hardcode it. When running standalone, never commit your `.env` to git.

## File structure
```
gtd-project/
├── CLAUDE.md          ← this file (project brief)
├── src/
│   └── App.jsx        ← full React app (single file)
└── README.md          ← setup instructions
```
