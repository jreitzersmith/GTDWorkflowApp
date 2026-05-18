import { createClient } from "@supabase/supabase-js";

// ── Supabase gmail_queue helpers ──────────────────────────────────────────
function queueEntryToRow(entry, userId) {
  return {
    id:            entry.id,
    user_id:       userId,
    label_name:    entry.labelName,
    label_id:      entry.labelId || null,
    query:         entry.query,
    description:   entry.description || null,
    archive:       entry.archive !== false,
    create_filter: entry.createFilter !== false,
    saved_at:      entry.savedAt || new Date().toISOString(),
    status:        entry.status || 'pending',
    run_count:     entry.runCount || null,
  };
}
function rowToQueueEntry(row) {
  return {
    id:           row.id,
    savedAt:      row.saved_at,
    labelName:    row.label_name,
    labelId:      row.label_id || null,
    query:        row.query,
    description:  row.description || null,
    archive:      row.archive,
    createFilter: row.create_filter,
    status:       row.status || 'pending',
    runCount:     row.run_count || null,
  };
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  // Disable auto URL detection so Supabase doesn't consume Google OAuth ?code= params.
  // We manually exchange Supabase magic-link codes in the auth useEffect instead.
  { auth: { detectSessionInUrl: false } }
);


// ── Supabase field mappers (camelCase ↔ snake_case) ──────────────────────────
function taskToDb(task, userId) {
  return {
    id:            task.id,
    user_id:       userId,
    text:          task.text,
    bucket:        task.bucket,
    done:          task.done,
    created:       task.created,
    priority:      task.priority      ?? [],
    location:      task.location      ?? [],
    due_date:      task.dueDate       ?? null,
    due_time:      task.dueTime       ?? null,
    effort:        task.effort        ?? null,
    actual_effort: task.actualEffort  ?? null,
    defer_until:   task.deferUntil    ?? null,
    notes:         task.notes         ?? null,
    recurrence:    task.recurrence    ?? null,
    parent_id:     task.parentId      ?? null,
    child_ids:     task.childIds      ?? [],
    sort_order:         task.sortOrder      ?? 0,
    category:           task.category       ?? null,
    calendar_event_id:  task.calendarEventId ?? null,
    drive_attachments:  task.driveAttachments ?? [],
    completed_date:     task.completedDate ?? null,
    reviewed:           task.reviewed ?? false,
    node_type:          task.nodeType ?? null,
    updated_at:         new Date().toISOString(),
    is_waiting_for:     task.isWaitingFor  ?? false,
    is_someday:         task.isSomeday     ?? false,
    is_next_action:     task.isNextAction  ?? false,
    defer_count:        task.deferCount    ?? 0,
  };
}

function dbToTask(row) {
  const t = {
    id:           row.id,
    text:         row.text,
    bucket:       row.bucket,
    done:         row.done,
    created:      row.created,
    priority:     row.priority      ?? [],
    location:     row.location      ?? [],
    dueDate:      row.due_date      ?? null,
    dueTime:      row.due_time       ?? null,
    effort:       row.effort        ?? null,
    actualEffort: row.actual_effort ?? null,
    deferUntil:   row.defer_until   ?? null,
    notes:        row.notes         ?? null,
    recurrence:   row.recurrence    ?? null,
    childIds:     row.child_ids     ?? [],
    sortOrder:         row.sort_order          ?? 0,
    category:          row.category            ?? null,
    calendarEventId:   row.calendar_event_id   ?? null,
    driveAttachments:  row.drive_attachments   ?? [],
    completedDate:     row.completed_date      ?? null,
    reviewed:          row.reviewed            ?? false,
    nodeType:          row.node_type           ?? null,
  };
  if (row.parent_id) t.parentId = row.parent_id;
  if (row.is_waiting_for) t.isWaitingFor  = true;
  if (row.is_someday)     t.isSomeday     = true;
  if (row.is_next_action) t.isNextAction  = true;
  if (row.defer_count)   t.deferCount = row.defer_count;
  return t;
}


export { supabase, queueEntryToRow, rowToQueueEntry, taskToDb, dbToTask };
