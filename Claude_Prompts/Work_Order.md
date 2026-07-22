# Work Order Process (With Worker only)

---

## Morning Review Session

This session starts cold — no conversation history from the planning session is assumed. John provides:
- `git diff HEAD~N HEAD` for the batch (the actual diff, not a summary)
- The worker's execution log (`Claude_Prompts/WorkLog_YYYY-MM-DD.md`)
- `npx vitest run` output
- `npx vite build` output

Sonnet produces a structured report:

1. **Applied cleanly** — list of changes confirmed correct in the diff
2. **Needs manual testing** — specific checklist items for John to check (use `- [ ]` format)
3. **Flagged for attention** — changes that look wrong, incomplete, or inconsistent with the work order; exact reason for each flag
4. **Housekeeping required** — Backlog.md lines to delete, Changelog.md rows to add, GitHub issues to close

Token cost for a typical 3–5 item morning review: ~$0.15–$0.25.

---

## Work Order Format

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

**Post-commit:** Delete Issue#11 from Backlog.md; append row to Changelog.md; close GH#22

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
