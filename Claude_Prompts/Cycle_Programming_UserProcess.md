# GTD Workflow App — User Instructions

## Purpose

Personal reference for running a productive working session on the GTD Manager project. Covers both workflow variants. Follow this at the start and end of each session regardless of which path you're on.

---

## Choosing which variant to run

Decide before opening a session.

| Condition | Use |
|---|---|
| Clear list of well-defined, mostly mechanical changes | Sonnet + Qwen |
| Any item involves debugging an unclear failure | Sonnet Only |
| Any item requires reading UI output to make a decision | Sonnet Only |
| Fewer than 3 items | Sonnet Only |
| You want changes today, not tomorrow morning | Sonnet Only |
| You're not sure what the right solution is yet | Sonnet Only |
| Batch is mostly markdown, GitHub ops, and doc updates | Sonnet + Qwen |
| App.jsx changes needed, region has test coverage | Sonnet + Qwen (with caution) |
| App.jsx changes needed, region has no test coverage | Sonnet Only |

If unsure: use Sonnet Only. The worker variant saves money on repetitive execution; it doesn't help when the work requires judgment.

---

## Session setup

1. Open a new Cowork session for the GTDWorkflowApp project folder.
2. Your first message should include:
   - Which variant you're running (or ask Claude to recommend based on scope)
   - The list of items to work on — Issue#, FR#, or a plain description
   - Any context not in the project files (e.g., "I tested Issue#11 yesterday and noticed it also affects recurring tasks")
3. Do not add anything else to the first message. Let Claude do session setup before you continue.

---

## Building your issue/feature list

Do this before opening the session:

1. Open `Known_Issues_And_Requests.md` and pick items by priority. Note their Issue#/FR# numbers.
2. Write a one-sentence definition of done for each item. If you can't write it, the item isn't ready to plan.
3. Check for dependencies: does any item require another to be done first?
4. Set a scope limit: 2–4 items per cycle. More than that invites drift.

Hand Claude the numbered list plus your one-sentence done criteria per item.

---

## Planning turn

### Without Worker (Sonnet Only)

Claude reads the relevant files, produces a complete plan in one response, and asks for your approval.

Your job:
- Read the plan fully before approving
- Ask any questions in a single follow-up message, not one question at a time
- Confirm with one "proceed" or "approved" — not item by item
- If something looks wrong, say specifically what's wrong rather than "can you double-check this"

### With Worker (Sonnet + Qwen)

Claude reads the relevant files and produces a work order saved to `Claude_Prompts/WorkOrder_YYYY-MM-DD.md`. Open that file and read it before approving.

Specifically check:
- Every App.jsx edit shows the exact old string with several lines of surrounding context — not just the changed line
- Every item has a HALT condition
- Commit message templates reference the correct Issue#/FR# and GH#
- The execution log path is specified

If anything is vague or missing, tell Claude specifically what's missing. Approve only when the work order is specific enough that you'd be comfortable executing it yourself.

---

## Executing (Sonnet Only)

You don't do anything during execution except monitor. Claude will apply each change, run the build after each code change, run tests at the end, and report results.

If Claude reports a build failure or test regression, do not say "try again." Say what you want: "make one fix attempt and report if it still fails" or "skip this item and continue."

---

## Preparing an overnight run (Sonnet + Qwen)

Once the work order is approved:

1. Confirm the git repo is clean: `git status` — should show nothing uncommitted.
2. Confirm the current build is green: `npx vite build`.
3. Start your local Qwen worker pointing at the work order file.
4. Go to sleep.

Do not start the worker if the build is not green. A failed build before the run means you'll wake up to errors that aren't the worker's fault.

---

## Morning review (Sonnet + Qwen)

### What to check, in order:

1. Open `Claude_Prompts/WorkLog_YYYY-MM-DD.md` — scan for any HALT or SKIP entries. Note which items were affected.
2. Run `git log --oneline -10` — confirm the expected commits are there with the right messages.
3. Run `npx vite build` — if this fails, stop everything and bring it to the morning review session.
4. Run `npx vitest run` — note any new failures.
5. Open a new Cowork session. Paste or reference:
   - The execution log
   - `git diff HEAD~N HEAD` where N = number of commits in the batch
   - Build output (if any failures)
   - Test output
6. Claude produces a structured report: applied cleanly / needs testing / flagged / housekeeping.
7. Work through the manual testing checklist Claude provides before approving any housekeeping steps.

Do not close GitHub issues or update Known_Issues until you've confirmed the changes work correctly.

---

## Manual testing and reporting failures

Claude gives you a testing checklist in `- [ ]` format. Work through it in order.

When done, paste back the checklist with items checked off. For unchecked items, add one line below each describing what you actually saw:

```
- [x] Open Calendar view — tasks with due dates appear in the pending section
- [ ] Create event from task with due date — event date should match task due date
  → Event was created with today's date (May 9), task due date is May 15
- [x] Check created event — default notification present
```

Do not say "item 2 didn't work." Paste the exact failure. Claude will diagnose from what you observed, not from what you expected.

---

## Prompting habits to change

Apply these on both variants.

**Stop:** Approving each step individually with a separate "proceed" message.
**Do instead:** Front-load your authorization in the planning approval: "implement all items in the plan, commit each separately, don't ask before individual commits."

**Stop:** Discovering scope mid-session ("I can still see done items," "have completed items been uploaded?").
**Do instead:** Define your complete definition of done before the planning turn. If "done" includes updating Known_Issues, GitHub, and docs, say so at the start.

**Stop:** Saying "can you double-check this" without specifying what concerns you.
**Do instead:** State the specific concern: "The GH# on FR#37 — is that correct or was GH#31 already used?"

**Stop:** Reporting test results as "it worked" or "something seems off."
**Do instead:** Paste the specific checklist item that failed with one sentence describing what you observed.

**Stop:** Opening a session with a vague request and letting scope emerge through conversation.
**Do instead:** Write your complete item list before opening the session. The first message should contain everything Claude needs to plan.

**Stop:** Asking Claude if something was done rather than checking the artifact.
**Do instead:** Check `git log`, `Known_Issues_And_Requests.md`, or GitHub Issues directly. Claude's confirmation is not a substitute for checking the actual artifact.

---

## Git, docs, and issue tracking checkpoints

### Without Worker (Sonnet Only)

| When | What | Who |
|---|---|---|
| After each item is confirmed working | Commit that item | Claude |
| After each commit | Delete from Known_Issues, append to Resolved_Issues, close GH# | Claude |
| After all items committed | Push to origin | Claude |
| After push and John confirms docs should update | Update Product_Summary/ HTML files | Claude |

### With Worker (Sonnet + Qwen)

| When | What | Who |
|---|---|---|
| During overnight run, per item | Commit with template message | Worker |
| During overnight run | Write execution log | Worker |
| Morning review | Verify commits and diff | Claude (Sonnet) |
| After manual testing confirmed | Delete from Known_Issues, append to Resolved_Issues | Claude (Sonnet) |
| After housekeeping | Close GitHub issues | Claude (Sonnet) |
| After everything confirmed | Push to origin | Claude (Sonnet) |
| After push | Update Product_Summary/ HTML files | Claude (Sonnet) |

The worker does not touch Known_Issues, Resolved_Issues, GitHub issues, or Product_Summary. Those require judgment.

---

## When things go wrong

### Without Worker (Sonnet Only)

**Build fails mid-session:** Tell Claude "make one fix attempt." If it fails again, stop work on that item — it goes back into Known_Issues with a note. Do not iterate on the same failure beyond two attempts in one session.

**Session hits Pro allotment mid-task:** Before the session ends, ensure the build is green, tests pass, and whatever is done is committed. Do not leave App.jsx in a partially edited state. Log remaining items in Known_Issues and resume next session.

**A confirmed fix turns out to be wrong after the session:** Open a new session. Describe specifically what broke and when you noticed it. Do not open with "remember last session?" — describe the problem from scratch using `git log` and `git diff` for context.

### With Worker (Sonnet + Qwen)

**Worker halted mid-batch:** Check the execution log for which items halted and why. If it's a HALT-on-miss (str.replace not found), the file state at planning time was stale. Fix: in the next planning session, re-read the affected file and capture fresh replacement strings. Do not re-run the halted item from the old work order.

**Worker continued past a HALT condition:** This is the most serious failure mode. In the morning review, if an item that depended on a halted item is present in the diff, flag it immediately. Do not accept those commits — they may have been applied to the wrong base state. Bring to the morning review session for diagnosis before touching anything else.

**Worker output passes build and tests but looks wrong in manual testing:** Trust the testing checklist over your intuition about the diff. If a checklist item fails, note it — do not approve the housekeeping steps until it's resolved. Plan the fix in the next cycle.

**Scope was underestimated — worker ran out of specified items:** This is fine. The execution log will show what was and wasn't done. Unfinished items go into the next work order. A partial batch that builds and tests cleanly is a success.

**You're not sure if overnight output is safe to ship:** Default to not shipping. Run the morning review, get Claude's assessment, work through the testing checklist. If anything is flagged, the ~$0.20 morning review session is much cheaper than shipping a broken change.

---

## End-of-session checklist

Before closing every session:

- [ ] Build is green
- [ ] Tests are passing (or known failures are logged)
- [ ] All completed items are committed and pushed
- [ ] Known_Issues is updated (resolved items removed, new items added with GH# and date)
- [ ] Resolved_Issues is updated
- [ ] GitHub issues are closed for resolved items
- [ ] Any new issues surfaced during the session are logged with GH# and date

### Without Worker (Sonnet Only)

Optionally note in one paragraph what was done, what's next, and any open risks. Paste this into your first message at the next session start to save setup turns.

### With Worker (Sonnet + Qwen)

Confirm the work order is saved and the git repo is clean before closing. Do not start the worker until you've verified the build is green.

---

## Deciding when to switch variants mid-project

You don't have to commit to one variant for the whole project. Switch based on what's in front of you.

**Switch to Sonnet Only when:**
- A bug surfaced that you don't fully understand yet
- The last overnight run produced unexpected output and you want to work through the fix interactively
- You're designing a new feature and aren't sure what the right approach is
- You have one or two quick items that aren't worth a batch

**Switch to Sonnet + Qwen when:**
- You have 4+ well-defined items, mostly markdown or isolated code changes
- You want to preserve your Pro allotment for planning and review, not execution
- The work is well-specified enough that you could explain each change in one sentence to another developer
