# GTD Workflow App — Known Issues & Feature Requests

> **Last used numbers:** Known Issues — **Issue#17** · Code Quality — **CQ#10** · Feature Requests — **FR#76**

---

## Known issues / remaining work

- [ ] Issue#12 [GH#32] (2026-05-09) — Process mode: AI does not assign due date when user corrects a deferral assumption mid-conversation (task filed without dueDate after user overrides AI's proposed defer date)
- [ ] Issue#13 [GH#33] (2026-05-09) — AI sets incorrect deferUntil on weekday-recurring tasks (defers to day after first calendar occurrence instead of next recurrence date)

---

## Suggested next features (in rough priority order)

### Feature requests

#### UI polish / quick wins

#### Daily workflow / GTD core


#### Inbox / processing improvements

- FR#8 [GH#9] — Inbox Process mode — AI identifies co-related tasks during inbox processing and suggests grouping them into an existing project or a new one (similar to the calendar-event grouping flow)

#### Integrations / data


- FR#17 [GH#12] — Gmail financial detail capture → Google Sheet
- FR#38 [GH#34] (2026-05-09) — Local provider tool support — get_task_context and other tool-use features currently require the Claude provider; extend tool dispatch to work with vllm, llama.cpp, and other OpenAI-compatible local providers when they gain tool-use support
- FR#40 [GH#36] (2026-05-09) — Gmail attachment linking — in EmailManagementView, let user attach a Gmail message or its attachments to a task as a Drive reference
- FR#41 [GH#37] (2026-05-09) — Doc capture from coach — coach action `→ACTION:create-doc` creates a Google Doc from coach output and links it back to a task or project
- FR#42 [GH#38] (2026-05-09) — Weekly Review auto-doc — at end of Weekly Review, offer to save the full review transcript as a dated Google Doc in a configurable Drive folder
- FR#43 [GH#39] (2026-05-09) — AI Coach creates Docs/Sheets/Slides — coach actions `→ACTION:create-sheet` and `→ACTION:create-slides` scaffold new files from coach conversation
- FR#44 [GH#40] (2026-05-09) — Slides briefing from tasks — generate a Google Slides briefing deck from a selected project or set of Next Actions; one slide per task or milestone
- FR#45 [GH#41] (2026-05-09) — Unified Drive/Docs/Sheets search — search bar in coach or task panel that queries Drive full-text and returns matching files as context or task attachments
- FR#46 [GH#42] (2026-05-09) — Receipt-to