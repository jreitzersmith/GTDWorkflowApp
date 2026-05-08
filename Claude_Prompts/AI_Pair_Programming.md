# GTD Workflow App — AI Pair Programming Process

**Project:** `C:\Programming_Projects\GTDWorkflowApp` — a React single-page GTD task manager with an AI coach (Claude API). Entire app is one file: `src/App.jsx` (~7200 lines). HTML summary docs live in `Product_Summary/`: `project-summary.html`, `project-snippets.html`, `project-commits.html`.

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

### Step 4 — Automated Tests
After the build passes, run `npx vitest run` via desktop-commander (Windows binary — the Linux sandbox cannot execute it). Evaluate the result:

- **All pass:** note the count (e.g. "85/85 passing") and proceed to Step 5.
- **Any fail:** make one self-contained fix attempt — code change, build, re-run tests. If tests still fail after that single pass, report the remaining failures with a brief diagnosis and ask John how to proceed. Do not iterate silently beyond one attempt.

Open Step 5 with the test result line (e.g. "85/85 tests passing ✓").

### Step 5 — Testing Guidance
Provide specific, concrete manual testing steps — not generic advice. Format: "click here, expect to see this." Every instruction should be feature-specific.

### Step 6 — John's Testing & Feedback
John tests. If something is off, iterate back to Step 3. If it passes, he confirms it is working.

**If testing reveals an issue and a fix is applied:** run the build, then explicitly ask John to re-test and confirm the fix before moving to Step 7. A passing build is not sufficient — re-confirmation is required after every mid-testing fix, no matter how small. Do not commit until that second confirmation arrives.

Do **not** touch the three HTML doc files (`Product_Summary/project-summary.html`, `Product_Summary/project-snippets.html`, `Product_Summary/project-commits.html`) until John says "looks good" or equivalent. Misleading docs are worse than no docs.

### Step 7 — Commit
Once John confirms, commit via `mcp__git__git_commit` (not bash git — bash can hit HEAD.lock on the Windows mount).

```
feat: short description

- Bullet explaining change 1
- Bullet explaining change 2
```

Use `fix:` for bug fixes, `docs:` for documentation-only commits.

After committing, if the change resolves a tracked known issue or completes a feature request:
1. Append a row to `Claude_Prompts/Resolved_Issues_And_Requests.md` — date, type, #, name, commit hash
2. Mark the item done (~~strikethrough~~) in `Claude_Prompts/Known_Issues_And_Requests.md`
3. Confirm the last-used number at the top of `Claude_Prompts/Known_Issues_And_Requests.md` is current

### Step 8 — Documentation (append only)
After the commit, update all three project doc files — **but only if John has already confirmed the feature works in Step 6.** If for any reason he hasn't confirmed yet, explicitly say docs will be updated once he does. Do not update docs speculatively.

When ready: read the tail of each HTML file in `Product_Summary/` to find the last documented state, then append new content (TOC entry, feature section, snippets, commit entry). Never rewrite existing sections. Update all three files in one Python pass.

Authoring rules (from `Claude_Prompts/Project_Summary.md`):
- Audience: total beginner to React/Node.js, but experienced sysadmin (Linux/macOS/Windows/AWS)
- Each feature: plain-English description, design decision, React concepts explained from scratch
- Cross-link all three files via named anchors; use highlight.js from CDN for syntax highlighting
- Collapsible sections where possible; consistent fonts, colors, and nav header across all three files

---

## Backlog management

When John provides a new Known Issue or Feature Request to add to `Claude_Prompts/Known_Issues_And_Requests.md`, categorise it first before placing it:

| Category | Number format | Use when |
|---|---|---|
| Known Issues | `Issue#x` | A bug or broken behaviour in the current app |
| Code quality | `CQ#x` | Code standards gaps: component size, test coverage, architecture |
| UI polish / quick wins | `FR#x` | Low-effort visible improvements (styling, interactions) |
| Daily workflow / GTD core | `FR#x` | Core GTD loop, daily planning, coach modes |
| Inbox / processing improvements | `FR#x` | Inbox flow, processing, AI suggestions |
| Integrations / data | `FR#x` | External services (Gmail, Calendar, Supabase, Todoist, etc.) |
| Data model expansions | `FR#x` | New fields, buckets, or task properties |
| Platform / reach | `FR#x` | Mobile layout, export, third-party sync |

After placing the entry, update the **Last used numbers** line at the top of the file.

---

## File edit rules for App.jsx

- Use `mcp__workspace__bash` with a Python script for all changes — never the Edit tool
- Never do multiple Python write passes — the Windows filesystem mount truncates the file
- Read the exact target lines first with the `Read` tool to get precise strings for replacement
- Use `str.replace(old, new)` — never regex on JSX (too fragile)
- Verify each replacement succeeded by checking for `✗` in the output before writing
- After write, confirm line count grew (not shrank)

---

## File placement conventions

- **HTML summary docs** (`project-summary.html`, `project-snippets.html`, `project-commits.html`): `Product_Summary/`
- **Visual mockups** (HTML wireframes or design mockups of the app): `Visual_Mockups/`

---

## Key remembered preferences

- Run commands directly — don't hand copy-paste steps
- Don't summarize what you just did after linking a file
- No emoji in responses unless asked
