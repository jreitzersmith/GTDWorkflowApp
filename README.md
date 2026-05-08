# GTD Manager

A personal Getting Things Done task manager with an AI coach built on the Claude API.

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/jreitzersmith/GTDWorkflowApp.git
cd GTDWorkflowApp

# 2. Install dependencies
npm install

# 3. Add your API keys
cp .env.example .env
# Edit .env — add your Anthropic API key and Supabase credentials

# 4. Start dev server (opens on http://localhost:5173)
npm run dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `VITE_ANTHROPIC_API_KEY` | Claude API key |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID (Calendar + Gmail) |
| `GITHUB_TOKEN` | GitHub PAT (dev tooling only — not needed to run the app) |

See `.env.example` for the full list.

## Features

- **8 GTD buckets:** Inbox, Next Actions, Projects, Waiting For, Someday/Maybe, Deferred, Completed, Inbox History
- **AI Coach with 5 modes:** Chat, Process, Weekly Review, Brain Dump, Project Review
- **Project hierarchy** with drag-and-drop reordering, descendant counts, and cumulative effort totals
- **Task Detail Panel** — notes, metadata, bucket moves, defer dates
- **Gmail integration** — inbox triage, label rules, cleanup
- **Google Calendar integration** — event display and AI-assisted scheduling
- **Supabase persistence** with real-time cross-device sync; localStorage fallback for unauthenticated sessions

## Project brief

**Tech stack:** React (functional components + hooks), inline styles only, Anthropic Claude API (`claude-sonnet-4-6`), Supabase for persistence, Vite for dev.

**File structure:**
```
src/
├── features/        # Feature-based organisation (calendar, coach, email, settings, tasks)
├── hooks/           # Cross-feature hooks (Supabase auth, Google auth, sync)
├── api/             # Supabase client + field mappers
├── prompts/         # Exported copies of all AI system prompts
├── shared/          # Reusable UI components
└── SQL/             # Supabase schema + migration SQL
Claude_Prompts/      # Claude workflow docs (pairing process, code standards, backlog)
Product_Summary/     # HTML project documentation (summary, commits, code snippets)
```

**Development workflow:** See `Claude_Prompts/AI_Pair_Programming.md` — every change follows an 8-step process (propose → approve → implement → build → test → confirm → commit → document).

**Coding standards:** See `Claude_Prompts/Senior_Code_Engineer.md`.

**Backlog:** See `Claude_Prompts/Known_Issues_And_Requests.md` — tracked locally and mirrored to GitHub Issues.
