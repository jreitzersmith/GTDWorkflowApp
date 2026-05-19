# GTD Workflow App — AI Pair Programming Process

**Project:** `C:\Programming_Projects\GTDWorkflowApp`

Read `CLAUDE.md` at session start. Read `Claude_Prompts/Code_Standards.md` before writing or reviewing any code.

Also read the memory index at `...\memory\MEMORY.md` and any `feedback_*.md` files listed there before starting any session.

---

## The two workflow variants

This file covers two operating modes. The steps are the same in structure; what differs is who executes implementation turns and how the handoff works.

- **Without Worker (Sonnet Only):** Sonnet plans and executes within the session. Use for smaller scopes, debugging, ambiguous problems, or any work that requires real-time judgment.
- **With Worker (Sonnet + Qwen):** Sonnet plans and produces a work order. A local Qwen model (122B recommended) executes implementation turns overnight. Sonnet reviews the diff in a morning session. Use for batches of well-defined, independent changes.

The decision guide is in `Claude_Prompts/User_Process.md`.

---

## Phase 1 — Session Setup (both variants)

At the start of every session, before any planning or execution:

1. Check for `vite.config.js.timestamp-*.mjs` in the project root. If 5 or more exist, delete them.
2. Read `Claude_Prompts/Backlog.md`.
3. Read `Claude_Prompts/Changelog.md` (tail is sufficient if file is long).
4. Read `CLAUDE.md`.
5. Read any `feedback_*.md` files listed in the memory index.

Do not read source files yet. Source files are read during the planning turn, not at session setup.

---

## Phase 2 — Triage and Scoping

When John presents a list of items to work on:

1. Categorize each item immediately (see Backlog management in `CLAUDE.md`).
2. File any new items as GitHub issues before planning begins. Record GH# and date in `Backlog.md`.
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
2. If the change touched `src/constants.jsx`, run a syntax check before building:
   ```
   node -e "require('./src/constants.jsx')" 2>&1 | grep -i "syntaxerror" && echo "SYNTAX ERROR" || echo "OK"
   ```
   If it prints `SYNTAX ERROR`, stop immediately and fix before proceeding.
3. Run the build:
   ```
   npx vite build --outDir /tmp/gtd-build --emptyOutDir
   ```
   **Note:** Always build to `/tmp/gtd-build` (native sandbox filesystem). Building to the FUSE-mounted `mnt/` path fails with EPERM on the unlink syscall (Windows mount layer restriction — known Cowork bug [GH#55206]). The `/tmp/` path is unaffected.
4. Do not proceed to the next item until the build is green.
5. After all items: run `npx vitest run`. Note the pass count.
6. Do not commit until both build and tests pass.

If a build fails: diagnose, make one self-contained fix attempt, rebuild. If still failing after one attempt, stop and report — do not iterate silently.

If a str.replace replacement is not found: stop immediately. Log which replacement failed and why. Do not proceed to subsequent edits in the same file.

### With Worker (Sonnet + Qwen)

Sonnet does not execute during this phase. The local Qwen model executes the work order overnight according to the work order protocol. See the Work Order section for the execution contract.

If an item in the work order hits a HALT condition, the worker logs it and skips to the next independent item. It does not attempt diagnosis or recovery — that is reserved for the morning review session.

---

## Phase 5 — Testing Guidance

After all changes for a cycle are complete, provide a specific manual testing checklist. Generic advice is not acceptable.

**Always render as a widget** — this applies in two situations:
1. At the end of a cycle, when presenting the full checklist for the first time
2. Whenever John asks which tests are outstanding, remaining, or not yet passed — render only the unresolved items as a fresh widget, never answer in plain text

**Format:** Always present the checklist as an interactive widget using `mcp__visualize__show_widget`. Each item must:
- Have a state button that cycles through **— → Pass → Fail → Skip → Note** on click
  - Pass = green · Fail = red · Skip = blue · Note = amber
  - Apply button colors as **inline styles** using CSS variables (e.g. `--color-background-success`), not CSS classes — class-based colors are overridden by the pre-styled button defaults
- Show a per-item `<textarea>` notes field **only for Fail, Skip, and Note** states — hidden for — and Pass
- Include an **overall notes** `<textarea>` below all items (before Submit)
- Include a right-aligned **Submit** button that calls `sendPrompt()` with all states and any notes
- Use `Note` state (amber) for items that partially passed or have a known caveat
- Build the UI with `document.createElement` (not innerHTML) to avoid textarea value loss on state cycle
- See `memory/feedback_testing_checklist_widget.md` for the full working template

Each checklist item: specific action + specific expected result. Group by feature area if multiple items were implemented.

John clicks items to mark state, then submits. Do not ask for a general "did it work" — wait for the widget submission. On receipt, treat pass = confirmed, fail = needs fix (diagnose), note = log as new FR if not already tracked.

**Skip items (condition not met):** Any item submitted as Skip means the test condition was unavailable (no live email, requires a second device, specific data state not present, etc.). At the end of the cycle, before committing, move each skipped item to the **Deferred Testing Scenarios** section of `Backlog.md` with a one-line note explaining what condition is needed.

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
1. Delete the resolved item from `Backlog.md`.
2. Append a row to `Changelog.md` (date · type · # · GH# · name · commit hash).
3. Post the test results to the GitHub issue via `mcp__github__add_issue_comment` before closing — copy the full checklist results from the submit output (one result per line).
4. Close the GitHub issue via `mcp__github__update_issue` with `state: closed`.
5. Confirm the Last used numbers line at the top of `Backlog.md` is current.
6. If any checklist items were submitted as Skip, move them to the **Deferred Testing Scenarios** section of `Backlog.md` now (if not already done in Phase 5). Format: `- [FR# or Issue#] <item description> — needs: <condition>`.

Push: `git -C "C:\Programming_Projects\GTDWorkflowApp" push origin main`

### With Worker (Sonnet + Qwen)

Commits are made by the worker during overnight execution using the commit message templates from the work order. The morning review session verifies commits are correct before doing the post-commit housekeeping (Known_Issues, Resolved_Issues, GitHub issue closure). Do not close GitHub issues until the morning review has confirmed the change is correct.

---

## Phase 8 — Documentation

**CLAUDE.md review (do this first)**
Before updating Product_Summary/, check whether this cycle changed anything CLAUDE.md describes:
- Did `package.json` change? → Review and update the Tech stack section.
- Did a new coach mode, bucket, major feature, or API integration land? → Review and update the Current app state section.

This is a lightweight check — most cycles won't require changes. If nothing relevant changed, proceed to HTML docs.

Update `Product_Summary/project-summary.html`, `project-snippets.html`, and `project-commits.html` only after John has confirmed the feature works in Phase 6. Do not update docs speculatively.

When ready: read the tail of each HTML file to find the last documented state, then append new content. Never rewrite existing sections. Update all three files in one Python pass.

Authoring rules (from `Claude_Prompts/Project_Summary.md`): beginner-friendly prose, React concepts explained from scratch, cross-linked via named anchors, highlight.js for syntax, collapsible sections, consistent nav header.

### With Worker (Sonnet + Qwen)

Documentation updates happen in the morning review session, not during overnight execution. The worker does not touch `Product_Summary/` files.

---

## Morning Review Session + Work Order Format (With Worker only)

See `Claude_Prompts/Work_Order.md` for the full morning review protocol and work order template.

---


## File edit rules

See `Claude_Prompts/File_Editing_Rules.md` for the full protocol. Summary:

- Never use the Edit tool — corrupts files on this Windows FUSE mount
- **Preferred:** `mcp__desktop-commander__read_file` / `write_file` — host-side, bypasses FUSE entirely
- **Fallback:** read via `git show HEAD:path` (never `open(path,'r')`), write via `open(path,'w')`
- Use `str.replace(old, new)` — never regex on JSX
- Verify each replacement succeeded before writing
- After write, confirm size with `wc -c`
- In a work order, capture the exact old string during the planning turn while the file is loaded

---

## Scope creep handling

### Without Worker (Sonnet Only)

If a new issue arrives during Phases 5–6: log it immediately in `Backlog.md` with a GitHub issue filed. Acknowledge to John. Do not investigate or propose changes. Resume the current cycle. Surface it after the current cycle is confirmed and committed.

### With Worker (Sonnet + Qwen)

If a new issue is discovered during morning review: log it, add to the next work order. Do not patch it ad hoc during the review session unless it is a critical regression blocking use of the app.

If the worker encountered unexpected scope (e.g., a dependent file changed and the replacement string was wrong): log in the work order report, add a revised item to the next planning session. Do not attempt to recover mid-batch.

---

## Architecture reference

For data model conventions (virtual bucket flags, email processing, uncategorizedProjectId) see `Claude_Prompts/Architecture_Notes.md`.

