# GTD Workflow App — Senior Code Engineer Standards

## General principles

**Readability**
- Name variables, functions, and components semantically — what they represent or do, never `data`, `item`, `comp`, `thing`
- Consistent formatting: 2-space indentation, single quotes, semicolons
- Comments explain *why*, never *what* — the code explains what

**Single responsibility**
- Every function and component does exactly one thing
- If you cannot describe a component's purpose in one sentence without "and," split it

**Testability**
- Prefer pure functions: same input → same output
- Never mix business logic with rendering logic
- Isolate all side effects so they can be tested independently
- When introducing new pure functions or custom hooks: identify test candidates and list proposed test cases as part of the Step 2 proposal. Write tests in the same implementation pass, co-located in the feature folder — not deferred.

**DRY**
- Never duplicate logic — extract into utility functions or custom hooks
- If the same pattern appears more than once, refactor before moving on

---

## React-specific rules

**Components**
- Keep components short — above 400–600 lines, split
- Separate presentational components (UI only) from container components (data, state, logic)
- Props: minimal, purposeful; no more than 4–5 per component without restructuring or context

**Hooks**
- Extract reusable stateful logic into named custom hooks (`useFetchUser`, `useFormValidation`)
- Complete and accurate dependency arrays in `useEffect` — never suppress `exhaustive-deps` without a documented reason
- State as local as possible; only lift when genuinely necessary
- No global state for data only one component needs

**Performance**
- Stable, unique key prop on every list rendering — never array index on dynamic or reordered lists
- `useMemo` for expensive computations that should not re-run on every render
- `useCallback` for functions passed as props to child components
- Lazy-load non-initial components via `React.lazy` and `Suspense`

**Data flow**
- Unidirectional: data down via props, events up via callbacks
- Never mutate props or external state directly
- Prop drilling beyond 2–3 levels: introduce Context or restructure
- All side effects in `useEffect` or a custom hook — never in the render body

**Error handling**
- Wrap major UI sections in an Error Boundary
- Every async operation: handle loading, success, and error — never assume success
- Meaningful fallback UI for error and loading states

---

## Project and file structure

Feature-based organization:

```
/features
  /UserProfile
    UserProfileCard.tsx
    useUserProfile.ts
    userProfileUtils.ts
    UserProfileCard.test.tsx
```

- One primary component per file, matching the filename
- Utility functions in `/utils` — pure and independently testable
- Imports: external libraries → internal modules → relative imports
- Visual mockups → `Visual_Mockups/`

---

## Code hygiene

- No commented-out code in final output
- No unresolved TODO comments — implement or document as a known limitation
- Remove unused variables, imports, and dependencies before delivery
- All async functions handle errors with try/catch or `.catch()`

---

## Pre-delivery checklist (both variants)

Before delivering or committing any code:

- [ ] Every component has a single, describable responsibility
- [ ] No logic is duplicated
- [ ] All hooks have correct dependency arrays
- [ ] All lists have stable key props
- [ ] All async operations handle loading/success/error
- [ ] No commented-out code or stale TODOs
- [ ] Folder/file structure follows feature-based organization
- [ ] Props are typed or have PropTypes defined
- [ ] No console.logs left in the code
- [ ] New pure functions and hooks have test candidates identified and proposed
- [ ] Approved tests are written, passing, and co-located in the feature folder
- [ ] If this resolves a tracked issue or FR, it will be logged in Changelog.md after commit

---

## Diff review criteria

Apply these criteria in morning review sessions and whenever reviewing any change. The source of the diff (Sonnet vs. worker) does not change the standards — but the things to watch for differ.

**For all diffs:**
- Does the change match the work order or approved plan exactly? Flag any deviation, even if the deviation looks correct.
- Are there unintended changes to lines not mentioned in the plan? (Whitespace normalization, quote style changes, re-ordering of imports — these should not appear.)
- Does the commit message accurately describe the change? Does it reference the correct Issue#/FR# and GH#?
- Do affected files have their corresponding tests updated if the test scope covers the changed code?
- Is the Known_Issues / Resolved_Issues housekeeping complete?

**Additional checks for worker-generated diffs:**
- Confirm the old string that was replaced matches what was actually in the file before the change. A partial match or a match on the wrong occurrence is a sign the worker operated on stale planning data.
- Check that no HALT condition was triggered silently — the execution log should show explicit pass/skip/halt per item. If an item is missing from the log, treat it as a skip.
- Verify build output and test output match the log. If the log claims a clean build but the diff contains syntax that would obviously fail, flag it.
- Look for signs the worker continued past a HALT condition — if Item 3 depended on Item 2 but Item 2 was halted, Item 3 should be absent from the diff. If it isn't, flag it.

**Additional checks for Sonnet-generated diffs:**
- The main risk is silent str.replace failure on App.jsx. Confirm the changed line count in the diff matches the expected scope. A diff that shows zero lines changed in a targeted file is a failed replacement that was not caught.
- Confirm iterative edits did not leave the file in an inconsistent intermediate state (e.g., a renamed function with the old name still referenced elsewhere).

---

## Guardrails for overnight runs

### Without Worker (Sonnet Only)

There are no overnight runs on the Sonnet-only path. All execution is interactive. If a session hits the Pro allotment mid-task, stop cleanly: commit whatever is in a working state, log remaining items in `Backlog.md`, and resume in the next session.

Clean stopping criteria for Sonnet-only mid-session:
- Build is green
- Tests are passing
- At least one logical item is fully committed (not mid-change)

Never leave App.jsx in a partially edited state between sessions.

### With Worker (Sonnet + Qwen)

A run is safe to start if and only if:

- [ ] The work order is saved and confirmed by John
- [ ] All replacement strings were captured from the current file state (not from a prior session's memory)
- [ ] Each App.jsx edit has explicit HALT-on-miss logic
- [ ] The execution log path is specified in the work order
- [ ] The git repo is clean (no uncommitted changes) before the run starts
- [ ] The most recent build is green before the run starts

A run is reversible if:
- Each item is a separate commit
- No item modifies more than one logical unit
- The worker does not squash or amend commits

If these conditions are not met, the run is not safe for overnight execution. Reduce scope or move items to the Sonnet-only path.

---

## Worker output quality expectations

### With Worker only

The Qwen 122B model is capable of applying well-specified changes reliably. It is not reliable for:
- Diagnosing ambiguous failures
- Making judgment calls about scope
- Deciding whether a silent replacement failure is acceptable
- Adapting to file state that differs from the work order's assumptions

Code quality expectations for worker output are identical to the pre-delivery checklist above. The worker is responsible for meeting the checklist; the morning review session is responsible for verifying it did.

If the worker output fails any checklist item, the morning review flags it and the fix is planned in the next planning session — it is not patched in the morning review session unless it is a build-blocking error.

The worker must not generate new code beyond what is specified in the work order. If a replacement string requires inventing a new helper function that was not specified, the worker should HALT and log it rather than generate the helper and proceed.
