# GTD Workflow App — Code Review Prompt

## Before you begin

1. Read `CLAUDE.md` for the project brief, tech stack, and branching model.
2. Read `Claude_Prompts/Code_Standards.md` for the coding standards this project is held to.
3. Run `npx vitest run` and note the test count and pass/fail state — include this in the Project Health section.

## Known project conventions (not deviations from standard)

- **Inline styles throughout** — there are no CSS files by design. All styling uses JavaScript objects and shared design tokens in `src/constants.jsx` (`COLORS`). Do not flag absence of CSS as an issue.
- **No TypeScript** — PropTypes are used for prop validation. Flag missing PropTypes but do not flag absence of TypeScript.
- **Feature-based structure** — code is organized under `src/features/<feature>/`. This is intentional and correct.
- **Functional components and hooks only** — no class components. Flag any class component as a violation.
- **Single App.jsx** — `src/App.jsx` is the root component and orchestrator. It is intentionally larger than a typical component; flag only if it contains logic that clearly belongs in a feature module.

---

## Evaluation criteria

Score each criterion 1–5 and provide a one-sentence finding and one actionable suggestion (or "None" if score ≥ 4).

### General quality

**1. Readability**
- Are variables, functions, and components named semantically (never `data`, `item`, `comp`, `thing`)?
- Is formatting consistent (2-space indent, single quotes, semicolons)?
- Do comments explain *why* rather than *what*?

**2. Single responsibility**
- Does each function/component do exactly one thing?
- Can each unit be described in one sentence without "and"?

**3. Testability**
- Is business logic isolated in pure functions?
- Are side effects separated from rendering logic?

**4. DRY**
- Is repeated logic extracted into utilities or custom hooks?
- Is there copy-pasted logic that should be shared?

### React-specific

**5. Component design**
- Are components focused and under 400–600 lines?
- Is there clear separation between presentational and container components?
- Are props minimal, purposeful, and validated with PropTypes?

**6. Hooks usage**
- Is stateful logic extracted into named custom hooks?
- Are `useEffect` dependency arrays complete and accurate?
- Is state kept as local as possible?

**7. Performance**
- Do all list renderings use stable, unique key props?
- Are `useMemo` / `useCallback` used appropriately?
- Are large components lazy-loaded via `React.lazy` / `Suspense`?

**8. Data flow**
- Is data flowing down via props and events up via callbacks?
- Is prop drilling beyond 2–3 levels avoided?
- Are side effects inside `useEffect` or custom hooks — never in the render body?

**9. Error handling**
- Are major UI sections wrapped in Error Boundaries?
- Do async operations explicitly handle loading, success, and error states?
- Are there meaningful fallback UIs?

### Project health

**10. Structure and hygiene**
- Is the feature-based folder structure consistent?
- Are there stale TODOs, commented-out code, or unused imports?
- Are there console.logs left in the code?
- Test suite: report count from `npx vitest run` and note any failures.

---

## Output format

For each criterion:
- **Score:** 1 (poor) → 5 (excellent)
- **Finding:** One sentence describing what was observed
- **Suggestion:** One actionable improvement if score < 4, otherwise "None"

Then:

**OVERALL SCORE:** weighted average out of 5

**TOP 3 PRIORITIES:** the three most impactful improvements — formatted as backlog entries ready to file:

```
- [ ] CQ#x — <short description of the issue and recommended fix>
```

Use `CQ#x` numbering (check `Claude_Prompts/Backlog.md` for the last used CQ number before assigning).
