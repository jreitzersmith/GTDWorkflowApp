# GTD Workflow App — Architecture Notes

Reference for key architectural decisions and data model conventions. Read when writing code that touches task buckets, email processing, or the uncategorized project.

---

## Virtual / flag-based bucket architecture

Four views are virtual filter views driven by boolean flags on tasks, not by `task.bucket`:

| View | Flag | Default |
|---|---|---|
| Next Actions | `isNextAction` | false |
| Waiting For | `isWaitingFor` | false |
| Someday/Maybe | `isSomeday` | false |
| Deferred | `deferUntil > today` | — |

All flagged tasks have `bucket: 'project'` — they live in the Projects tree and are surfaced in their respective views by filter. The `bucket` field no longer uses `'next'`, `'waiting'`, or `'someday'` as values.

**Creating next actions:** always `bucket: 'project', isNextAction: true, parentId: uncategorizedProjectId` (or an explicit parent). Never `bucket: 'next'`.

**Supabase columns:** `is_next_action`, `is_waiting_for`, `is_someday`, `defer_until` on the `tasks` table.

**uncategorizedProjectId:** stored in `user_settings.uncategorized_project_id`. The live project ID is `mp1esqmp51mo`. If this ever gets stale, query `tasks WHERE lower(text) LIKE '%uncategorized%'` to find the real ID and update `user_settings`.

---

## Email processing architecture

`processEmailWithAI` (App.jsx) sends the email body to the AI in chat mode with a structured prompt covering: task identification → project/metadata clarification → similar-email search → filter/label offer → archive.

**Auto-link mechanism:** `pendingEmailContext` state + `preEmailTaskIdsRef` (App.jsx). When `processEmailWithAI` is called, a snapshot of current task IDs is taken. A `useEffect` watches `tasks` and attaches the email to any newly created task. Clears when `switchCoachMode` is called.

**→ACTION:link_email** is also supported as an explicit AI-emitted directive: `→ACTION:link_email|<task_title_or_id>|<gmail_message_id>[|<subject>]`. Handled in the `taskActionLines` loop in `useCallAI.js`.

**Duplicate-task guard:** `→ACTION:add` was removed from `extractAction`'s regex pattern — it is handled only by `taskActionLines` (auto-processed), not by `setPendingAction` (which would show a confirm bar and cause a second creation).
