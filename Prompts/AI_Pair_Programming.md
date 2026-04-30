# GTD Workflow App — AI Pair Programming Process

**Project:** `C:\Programming_Projects\GTDWorkflowApp` — a React single-page GTD task manager with an AI coach (Claude API). Entire app is one file: `src/App.jsx` (~3600 lines). Docs live in the project root: `project-summary.html`, `project-snippets.html`, `project-commits.html`.

**CLAUDE.md** is checked in and contains the full project brief — always read it at session start.

**On session start, also review the memory index** at `C:\Users\JRS\AppData\Roaming\Claude\local-agent-mode-sessions\2cf835c2-0e1d-4b15-946e-2117a3c78aea\ec49ebde-78d0-488d-8e79-8f2745ca93e4\spaces\43cc0cd5-cf15-434a-b32a-ac2c42290801\memory\MEMORY.md` and read any `feedback_*.md` files listed there. These contain corrections from past sessions that override default behavior.

---

## The workflow

1. **Plan first.** Before any code change, summarize the planned change and wait for explicit approval ("proceed", "yes", etc.). This applies to every change, no matter how small.

2. **One Python pass, always.** All edits to `App.jsx` must happen in a single Python read → modify → write cycle using `mcp__workspace__bash`. Never use the Edit tool on `App.jsx` and never do multiple Python write passes — the Windows filesystem mount truncates the file.

3. **Build to verify.** After every code change, run `npx vite build --outDir /tmp/gtd-distN` (increment N each time to avoid EPERM on the dist folder). A clean build confirms no syntax errors before telling John to test.

4. **Test before docs.** After committing, explicitly tell John to test the feature and say you'll update the docs once he confirms it's working. **DO NOT TOUCH** the three HTML doc files until he says "looks good" or similar.

5. **Commit with `mcp__git__git_commit`** (not bash git), since the bash environment can hit HEAD.lock issues on the Windows mount.

6. **Docs update — append only.** Read the tail of each HTML file to see the last documented state, then append new content (TOC entry, feature section, snippets, commit entry). Never rewrite existing sections. All three files update in one Python pass.

---

## File edit rules for App.jsx

- Use `mcp__workspace__bash` with a Python script for all changes
- Read the exact target lines first with the `Read` tool to get precise strings for replacement
- Use `str.replace(old, new)` — never regex on JSX (too fragile)
- Verify each replacement succeeded by checking for `✗` in the output before writing
- After write, confirm line count grew (not shrank)

---

## Git commit style

```
feat: short description

- Bullet explaining change 1
- Bullet explaining change 2
```

Use `fix:` for bug fixes, `docs:` for documentation-only commits.

---

## Key remembered preferences

- Run commands directly — don't hand copy-paste steps
- Don't summarize what you just did after linking a file
- No emoji in responses unless asked
