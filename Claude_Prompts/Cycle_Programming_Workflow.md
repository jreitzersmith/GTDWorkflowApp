# GTD Workflow App — AI Pair Programming Process

**Project:** `C:\Programming_Projects\GTDWorkflowApp`

Read `CLAUDE.md` at session start. Read `Claude_Prompts/Cycle_Programming_Code_Standards.md` before writing or reviewing any code.

Also read the memory index at `...\memory\MEMORY.md` and any `feedback_*.md` files listed there before starting any session.

---

## The two workflow variants

This file covers two operating modes. The steps are the same in structure; what differs is who executes implementation turns and how the handoff works.

- **Without Worker (Sonnet Only):** Sonnet plans and executes within the session. Use for smaller scopes, debugging, ambiguous problems, or any work that requires real-time judgment.
- **With Worker (Sonnet + Qwen):** Sonnet plans and produces a work order. A local Qwen model (122B recommended) executes implementation turns overnight. Sonnet reviews the diff in a morning session. Use for batches of well-defined, independent changes.

The decision guide is in `Claude_Prompts/Cycle_Programming_UserProcess.md`.

---

## Phase 1 — Session Setup (both variants)

At the start of every session, before any planning or execution:

1. Check for `vite.config.js.timestamp-*.mjs` in the project root. If 5 or more exist, delete them.
2. Read `Claude_Prompts/Known_Issues_And_Requests.md`.
3. Read `Claude_Prompts/Resolved_Issues_And_Requests.md` (tail is sufficient if file is long).
4. Read `CLAUDE.md`.
5. Read any `feedback_*.md` files listed in the memory index.

Do not read source files yet. Source files are read during the planning turn, not at session setup.

---

## Phase 2 — Triage and Scoping

When John presents a list of items to work on:

1. Categorize each item immediately (see Backlog management in `CLAUDE.md`).
2. File any new items as GitHub issues before planning begins. Record GH# and date in `Known_Issues_And_Requests.md`.
3. Identify dependencies between items: does any item require another to land first?
4. Identify risk level for each item:
   - **Low risk:** markdown edits, GitHub operations, documentation updates, isolated utility functions with test coverage
   - **Medium risk:** UI changes in components with no test coverage, edits touching multiple files, any change to `constants.jsx` or `supabase.js`
   - **High risk:** App.jsx edits in uncovered regions, schema changes, auth flow changes
5. State the dependency order and risk levels explicitly. Ask one clarifying question if scope is ambiguous.

Do not begin planning until the scope is confirmed.

---

## Phase 3 — Planning Turn

Read all relevant source files in this turn. Capture exact replacement strings now — do not defer to execution time.

Produce the plan as a single response containing:

- For each item: what changes, in which files, with exact old/new strings for App.jsx edits
- Dependencies: which items must land before others
- Risk flags: any region with no test coverage, any silent-failure risk (str.replace on App.jsx)
- HALT conditions: what should stop execution (build failure, replacement not found, test regression)
- Manual testing checklist for each item (GitHub-flavored markdown checkboxes)
- Commit message template for each item

### Without Worker (Sonnet Only)

The plan is presented inline. John reviews and approves with a single confirmation. Execution begins immediately after approval — no separate handoff document.

### With Worker (Sonnet + Qwen)

The plan is saved as `Claude_Prompts/WorkOrder_YYYY-MM-DD.md`. John reviews the file, requests any revisions, and confirms. Execution does not begin until John explicitly confirms the work order is ready to run.

The work order format is specified in the Work Order section below.

---

## Phase 4 — Execution

### Without Worker (Sonnet Only)

Execute items in dependency order. For each item:

1. Apply the change.
2. Run the build:
   ```
   npx vite build --outDir /sessions/.../mnt/outputs/gtd-dist-<feature> --emptyOutDir
   ```
3. Do not proceed to the next item until the build is green.
4. After all items: run `npx vitest run`. Note the pass count.
5. Do not commit until both build and tests pass.

If a build fails: diagnose, make one self-contained fix attempt, rebuild. If still failing after one attempt, stop and report — do not iterate silently.

If a str.replace replacement is not found: stop immediately. Log which replacement failed and why. Do not proceed to subsequent edits in the same file.

### With Worker (Sonnet + Qwen)

Sonnet does not execute during this phase. The local Qwen model executes the work order overnight according to the work order protocol. See the Work Order section for the execution contract.

If an item in the work order hits a HALT condition, the worker logs it and skips to the next independent item. It does not attempt diagnosis or recovery — that is reserved for the morning review session.

---

## Phase 5 — Testing Guidance

After all changes for a cycle are complete, provide a specific manual testing checklist. Generic advice is not acceptable.

**Format:** Always present the checklist as an interactive widget using `mcp__visualize__show_widget`. Each item must:
- Have a state button that cycles through **unchecked → Pass → Fail → Skip → Note** on click
  - Pass = green · Fail = red · Skip = grey · Note = amber
- Have a per-item text input field for optional notes/observations
- Pre-populate state if the user has already reported results in chat before the widget is rendered
- Include a **Submit** button that calls `sendPrompt()` with a compact summary including all states and any notes
  - Format: `FR#XX test results — [Item label]: Pass · [Item label]: Fail (note text) · ...`
- Use `Note` state (amber) for items that partially passed or have a known caveat

Each checklist item: specific action + specific expected result. Group by feature area if multiple items were implemented.

John clicks items to mark state, then submits. Do not ask for a general "did it work" — wait for the widget submission. On receipt, treat pass = confirmed, fail = needs fix (diagnose), note = log as new FR if not already tracked.

---

## Supabase migrations

When a cycle includes a SQL migration (new columns, new tables, ALTER TABLE):

1. **Confirm readiness** — before running, confirm John is ready (app not actively in use, data is clean).
2. **Run it yourself** using the Supabase Management API — do not hand copy-paste steps to John:
   ```
   curl -s -X POST \
     "https://api.supabase.com/v1/projects/tudmteqljgpocffalssz/database/query" \
     -H "Authorization: Bearer $SUPABASE_MANAGEMENT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"query": "<SQL here>"}'
   ```
   Credentials are in `.env` (`SUPABASE_MANAGEMENT_TOKEN`, project ref = `tudmteqljgpocffalssz`).
3. **Verify** — follow up with a `SELECT` on `information_schema.columns` to confirm the schema change landed.
4. **Only then** proceed to the testing checklist — persistence tests are meaningless without the columns present.

---

## Phase 6 — Feedback and Iteration

John reports results using the checklist. If items are unchecked:

1. Read the failure report.
2. Diagnose the specific unchecked items only.
3. Propose a fix — one fix per failure, stated concisely.
4. Get explicit approval before applying the fix.
5. Apply, build, re-run affected tests, provide targeted re-test steps for the specific failure only.
6. Do not re-run the full checklist — only the items that failed.

**A passing build after a fix is not sufficient confirmation.** John must explicitly re-confirm the fixed item before moving to commit. Do not commit until that confirmation arrives.

---

## Phase 7 — Commit

Once John confirms all checklist items are passing:

Use `mcp__git__git_commit` (not bash git):

```
feat: short description

- Bullet explaining change 1
- Bullet explaining change 2
```

Use `fix:` for bug fixes, `docs:` for documentation-only commits. One commit per logical item unless items are tightly coupled.

After committing:
1. Delete the resolved item from `Known_Issues_And_Requests.md`.
2. Append a row to `Resolved_Issues_And_Requests.md` (date · type · # · GH# · name · commit hash).
3. Close the GitHub issue via `mcp__github__update_issue` with `state: closed`.
4. Confirm the Last used numbers line at the top of `Known_Issues_And_Requests.md` is current.

Push: `git -C "C:\Programming_Projects\GTDWorkflowApp" push origin main`

### With Worker (Sonnet + Qwen)

Commits are made by the worker during overnight execution using the commit message templates from the work order. The morning review session verifies commits are correct before doing the post-commit housekeeping (Known_Issues, Resolved_Issues, GitHub issue closure). Do not close GitHub issues until the morning review has confirmed the change is correct.

---

## Phase 8 — Documentation

Update `Product_Summary/project-summary.html`, `project-snippets.html`, and `project-commits.html` only after John has confirmed the feature works in Phase 6. Do not update docs speculatively.

When ready: read the tail of each HTML file to find the last documented state, then append new content. Never rewrite existing sections. Update all three files in one Python pass.

Authoring rules (from `Claude_Prompts/Project_Summary.md`): beginner-friendly prose, React concepts explained from scratch, cross-linked via named anchors, highlight.js for syntax, collapsible sections, consistent nav header.

### With Worker (Sonnet + Qwen)

Documentation updates happen in the morning review session, not during overnight execution. The worker does not touch `Product_Summary/` files.

---

## Morning Review Session (With Worker only)

This session starts cold — no conversation history from the planning session is assumed. John provides:
- `git diff HEAD~N HEAD` for the batch (the actual diff, not a summary)
- The worker's execution log (`Claude_Prompts/WorkLog_YYYY-MM-DD.md`)
- `npx vitest run` output
- `npx vite build` output

Sonnet produces a structured report:

1. **Applied cleanly** — list of changes confirmed correct in the diff
2. **Needs manual testing** — specific checklist items for John to check (use `- [ ]` format)
3. **Flagged for attention** — changes that look wrong, incomplete, or inconsistent with the work order; exact reason for each flag
4. **Housekeeping required** — Known_Issues lines to delete, Resolved_Issues rows to add, GitHub issues to close

Token cost for a typical 3–5 item morning review: ~$0.15–$0.25.

---

## Work Order Format (With Worker only)

Saved as `Claude_Prompts/WorkOrder_YYYY-MM-DD.md`. The worker reads this file and executes it without interaction.

````markdown
# Work Order — YYYY-MM-DD

## Items

### Item 1: [FR/Issue#] — Short title
**Risk:** Low / Medium / High
**Dependencies:** None / Item 2 must land first
**Files:** src/features/calendar/CalendarApi.js

**Change:**
File: src/features/calendar/CalendarApi.js
Old:
```
exact string to replace (verbatim, with surrounding context lines)
```
New:
```
exact replacement string
```

**Verification:**
- Build must pass after this change
- Run: `npx vite build`
- HALT if build fails

**Commit message:**
```
fix: calendar event creation uses task due date

- Pass task.dueDate as event start/end instead of today's date
- Closes Issue#11 [GH#22]
```

**Post-commit:** Delete Issue#11 from Known_Issues; append row to Resolved_Issues; close GH#22

---

### Item 2: ...

## HALT Conditions (global)
- Any str.replace that finds no match: log and skip remaining edits in that file; continue to next independent item
- Any build failure: log and skip remaining items in the same dependency group; continue to independent items
- Any test regression (tests that were passing before this batch now fail): halt entire batch, log, do not commit

## Execution Log
Worker writes to `Claude_Prompts/WorkLog_YYYY-MM-DD.md` with:
- Each item: applied / skipped / halted + reason
- Build results per item
- Final test results
- List of commits made (hash + message)
````

A work order is valid for worker execution only if:
- Every App.jsx edit includes the exact surrounding context lines (not just the changed lines)
- Every item has an explicit HALT condition
- The execution log location is specified
- No item says "implement X" without specifying exact file, function, and replacement strings

---

## File edit rules for App.jsx

- Use `mcp__workspace__bash` with a Python script for all changes — never the Edit tool directly
- **Read source via `git show`:** use `subprocess.run(['git','show','HEAD:path'])` to get file content, never `open(path,'r')` directly from the mount. The virtiofs FUSE page cache does not invalidate on Windows-side writes (git commit/checkout, rebase, PowerShell), so direct reads can return stale/truncated content. `git show` reads from the ext4 object store and is always fresh.
- **Write with `open(path,'w')` mode** — `O_TRUNC` bypasses the stale cache. Safe regardless of what Windows did to the file.
- **Never use `open(path,'a')` (append mode)** — seeks to the cached (possibly stale) EOF, writes at the wrong offset.
- Multiple Python writes in separate calls are fine as long as each uses `'w'` mode and content comes from `git show`.
- Use `str.replace(old, new)` — never regex on JSX
- Verify each replacement succeeded before writing (check for `✗` in output)
- After write, confirm size with `wc -c` and that it matches expected byte count
- In a work order, capture the exact old string during the planning turn while the file is loaded

---

## Scope creep handling

### Without Worker (Sonnet Only)

If a new issue arrives during Phases 5–6: log it immediately in `Known_Issues_And_Requests.md` with a GitHub issue filed. Acknowledge to John. Do not investigate or propose changes. Resume the current cycle. Surface it after the current cycle is confirmed and committed.

### With Worker (Sonnet + Qwen)

If a new issue is discovered during morning review: log it, add to the next work order. Do not patch it ad hoc during the review session unless it is a critical regression blocking use of the app.

If the worker encountered unexpected scope (e.g., a dependent file changed and the replacement string was wrong): log in the work order report, add a revised item to the next planning session. Do not attempt to recover mid-batch.
