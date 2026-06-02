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
    contact_id:         task.contactId     ?? null,
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
  if (row.contact_id)    t.contactId  = row.contact_id;
  return t;
}


export { supabase, queueEntryToRow, rowToQueueEntry, taskToDb, dbToTask };

// ── Contacts CRUD (FR#132) ────────────────────────────────────────────────────
// All functions operate on the contacts table with RLS — user_id is enforced
// server-side via the contacts_owner policy.

/**
 * Fetch all contacts for the authenticated user.
 * @returns {object[]} array of raw Supabase contact rows
 */
async function fetchContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .order('display_name', { ascending: true });
  if (error) throw new Error(`fetchContacts: ${error.message}`);
  return data || [];
}

/**
 * Insert or update a contact row, matching on google_resource_name.
 * For manual contacts (no google_resource_name), matches on id.
 * Custom enrichment fields (notes, promises, etc.) are only overwritten if
 * explicitly included in the contact object — pass only what changed.
 *
 * @param {object} contactRow - Supabase-formatted row from contactToDb()
 * @returns {object} the upserted row
 */
async function upsertContact(contactRow) {
  const { data, error } = await supabase
    .from('contacts')
    .upsert(
      { ...contactRow, updated_at: new Date().toISOString() },
      { onConflict: 'google_resource_name', ignoreDuplicates: false }
    )
    .select()
    .single();
  if (error) throw new Error(`upsertContact: ${error.message}`);
  return data;
}

/**
 * Update only the custom enrichment fields on a contact (never overwrites
 * Google-synced standard fields).
 *
 * @param {string} contactId  - UUID of the contact row
 * @param {object} fields     - subset of custom columns to update
 * @returns {object} the updated row
 */
async function updateContactCustomFields(contactId, fields) {
  const allowed = [
    'relationship_tags', 'notes', 'likes_preferences', 'gift_ideas', 'promises', 'dislikes',
    'email_history', 'drive_attachments', 'is_favorite',
  ];
  const update = Object.fromEntries(
    Object.entries(fields).filter(([k]) => allowed.includes(k))
  );
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('contacts')
    .update(update)
    .eq('id', contactId)
    .select()
    .single();
  if (error) throw new Error(`updateContactCustomFields: ${error.message}`);
  return data;
}

/**
 * Update standard (Google-synced) fields on a contact row.
 * Called after a successful Google People API PATCH to keep Supabase in sync.
 *
 * @param {string} contactId
 * @param {object} fields - standard columns to update (display_name, emails, etc.)
 * @returns {object} the updated row
 */
async function updateContactStandardFields(contactId, fields) {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', contactId)
    .select()
    .single();
  if (error) throw new Error(`updateContactStandardFields: ${error.message}`);
  return data;
}

/**
 * Delete a contact row by id.
 * @param {string} contactId
 */
async function deleteContact(contactId) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);
  if (error) throw new Error(`deleteContact: ${error.message}`);
}


// ── Health items (FR#187) ────────────────────────────────────────────────────

async function fetchHealthItems() {
  const { data, error } = await supabase
    .from('health_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchHealthItems: ${error.message}`);
  return data || [];
}

async function upsertHealthItem(item) {
  const { data, error } = await supabase
    .from('health_items')
    .upsert(item, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw new Error(`upsertHealthItem: ${error.message}`);
  return data;
}

async function deleteHealthItem(id) {
  const { error } = await supabase
    .from('health_items')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`deleteHealthItem: ${error.message}`);
}

export {
  fetchContacts,
  upsertContact,
  updateContactCustomFields,
  updateContactStandardFields,
  deleteContact,
  fetchHealthItems,
  upsertHealthItem,
  deleteHealthItem,
};

