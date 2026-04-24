# GTD Manager

A personal Getting Things Done task manager with an AI coach built on the Claude API.

## Quick Start

### Option A — Run as a Claude Artifact (no setup needed)
Open `src/App.jsx` in Claude.ai and run it as a React artifact. The API key is handled automatically.

### Option B — Run standalone with Vite

```bash
# 1. Scaffold a Vite React project
npm create vite@latest gtd-manager -- --template react
cd gtd-manager

# 2. Replace the default App
cp /path/to/gtd-project/src/App.jsx src/App.jsx
# Remove src/App.css and src/index.css imports if present

# 3. Install dependencies (none beyond React — all inline)
npm install

# 4. Add your Anthropic API key
echo "VITE_ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE" > .env

# 5. Update the fetch call in App.jsx headers section:
#    "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
#    "anthropic-version": "2023-06-01",

# 6. Start dev server
npm run dev
```

## Features
- 5 GTD buckets: Inbox, Next Actions, Projects, Waiting For, Someday/Maybe
- AI Coach with 4 modes: Chat, Process, Weekly Review, Brain Dump
- One-click bucket moves suggested by AI
- Tasks persist in localStorage

## Project brief
See `CLAUDE.md` for full context, known issues, and suggested next features.
