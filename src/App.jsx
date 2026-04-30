import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const COLORS = {
  bg: "#111210", surface: "#1a1c18", surface2: "#222420", surface3: "#2a2c28",
  border: "#333530", border2: "#404240",
  text: "#e8e4dc", text2: "#a8a49c", muted: "#5a5c58",
  inbox: "#e8c84a", inboxBg: "#2a2618",
  next: "#5ab878", nextBg: "#182418",
  project: "#5a8fd4", projectBg: "#181e2a",
  waiting: "#d4845a", waitingBg: "#2a1e14",
  someday: "#9a8ad4", somedayBg: "#1e1a2a",
  effort: "#6ec6a8", effortBg: "#152520",
  deferred: "#c87ee0", deferredBg: "#1e1428",
  done: "#5a5c58",
};

const BUCKETS = {
  inbox:        { label: "📥 Inbox",           desc: "Unprocessed — capture everything here first", color: COLORS.inbox },
  next:         { label: "⚡ Next Actions",     desc: "Concrete physical actions to do this week",   color: COLORS.next },
  project:      { label: "📁 Projects",        desc: "Anything requiring more than one step",        color: COLORS.project },
  waiting:      { label: "⏳ Waiting For",     desc: "Delegated — ball in someone else's court",     color: COLORS.waiting },
  someday:      { label: "💭 Someday / Maybe", desc: "Ideas and aspirations, not commitments",       color: COLORS.someday },
  deferred:     { label: "⏰ Deferred",          desc: "Deferred tasks waiting for their wake date",  color: COLORS.deferred },
  done:         { label: "✅ Completed",        desc: "Finished tasks",                              color: COLORS.done },
  inboxHistory: { label: "📋 Inbox History",   desc: "Processed inbox items — archived for reference", color: COLORS.muted },
};

const COACH_MODES = {
  chat:          { label: "Chat",           icon: "💬" },
  process:       { label: "Process",        icon: "📥" },
  review:        { label: "Review",         icon: "📋" },
  dump:          { label: "Brain Dump",     icon: "🧠" },
  projectReview: { label: "Project Review", icon: "🔍" },
};

const SYSTEM_PROMPTS = {
  chat: `You are a GTD (Getting Things Done) coach for a knowledge worker. You have access to their full task list (provided in each message). Help them stay organized, clarify tasks, define next actions, and maintain their GTD system. Be concise — under 100 words per response. When recommending a bucket move, be explicit: say "→ Move to Next Actions" or similar.

To update an existing task, end your response with EXACTLY one line:
→ACTION:update|<task_id>|field:value[|field:value...]

Updatable fields: due:YYYY-MM-DD · defer:YYYY-MM-DD · effort:<label> · actualEffort:<label> · bucket:<inbox|next|project|waiting|someday> · title:<new name> · priority:<p1,p2> · location:<loc1,loc2> · recur:<frequency>:<interval>[:<days>] or recur:off · notes:<text — use \\n for line breaks, must be the last field>

Recurrence format: frequency is daily/weekly/monthly/yearly; interval is a number. For weekly on specific days add comma-separated abbreviations: mon,tue,wed,thu,fri,sat,sun (e.g. recur:weekly:1:mon,fri). Use recur:off to remove recurrence.

To add a new task as a child of an existing project or task, end your response with EXACTLY one line:
→ACTION:add|<task title>|parent:<parent_task_id>[|bucket:next][|due:YYYY-MM-DD][|defer:YYYY-MM-DD][|effort:<label>][|location:<loc1,loc2>][|recur:<frequency>:<interval>[:<days>]]

To create a new standalone task, end your response with EXACTLY one line:
→ACTION:create|<task title>|bucket:<inbox|next|someday|waiting>[|due:YYYY-MM-DD][|defer:YYYY-MM-DD][|effort:<label>][|location:<loc1,loc2>][|recur:<frequency>:<interval>[:<days>]]

The task_id / parent_task_id comes from the [id:...] tag shown on each task in the task list.
Only emit →ACTION:update, →ACTION:add, or →ACTION:create when the user explicitly asks you to change or create something. Never include them unsolicited. Emit at most one ACTION line per response.

Before using any task ID, confirm it appears in the current task list. If you cannot find the task, say so explicitly rather than guessing. If an action cannot be completed (missing ID, ambiguous target, invalid field), state clearly what went wrong and what information you need.`,
  process: `You are a GTD inbox processor. For each inbox item given to you:

1. Determine if it's actionable. If not actionable, end with: →ACTION:delete
2. If actionable, decide: is this a SINGLE next action, or a multi-step PROJECT?
   - If you need clarification to decide, ask ONE specific question. Do NOT include an →ACTION tag until clarified.
3. Reword the action as a concrete physical action starting with a strong verb (e.g. "Call", "Draft", "Research", "Buy").
4. Briefly ask (one line): Does this have a due date? And should it be deferred — hidden until a future date when it becomes relevant?
   If you can confidently infer dates from context (e.g. "for Christmas" → due ~Dec 25, defer ~Oct 1), include them directly without asking.
5. End your response with EXACTLY one tag. Optionally append |due:YYYY-MM-DD and/or |defer:YYYY-MM-DD:

→ACTION:next|<Reworded title>[|due:YYYY-MM-DD][|defer:YYYY-MM-DD]
→ACTION:project|<Project name>|<First next action>[|due:YYYY-MM-DD][|defer:YYYY-MM-DD]
→ACTION:someday|<Reworded title>[|defer:YYYY-MM-DD]
→ACTION:waiting|<What you are waiting for>
→ACTION:delete

Be concise — under 80 words before the tag. Never include the →ACTION tag mid-response.`,
  review: `You are running a GTD Weekly Review. Guide the user through 7 steps one at a time:
1. Capture loose ends (anything physical not captured)
2. Process inbox to zero
3. Review Next Actions — anything to complete or remove?
4. Review Projects — does each have a next action?
5. Review Waiting For — any follow-ups needed?
6. Review Someday/Maybe — anything ready to activate?
7. New ideas or goals to add?
Ask one step at a time. Acknowledge their answer, then move on. Under 90 words each.`,
  projectReview: `You are reviewing a GTD project to identify missing next actions.

Given a project name, its current subtasks, and any metadata, you will:
1. Write 2-3 sentences assessing the project's current state and momentum.
2. Identify 2-4 specific, concrete next actions that appear to be missing or would unblock progress.

End your response with EXACTLY this block — nothing after it:
→SUGGESTIONS:
1. [First missing action — start with a strong verb: Call, Draft, Research, Schedule, etc.]
2. [Second missing action]
(add up to 4 total if needed)

If the project is fully on track with no missing actions, write:
→SUGGESTIONS:
(none)

Be concise. Under 80 words before the suggestions block.`,
  projectMetadata: `You are a GTD metadata coach reviewing a project's tasks for completeness.

For each task listed (with its ID), examine these three fields:
- effort: a time estimate (e.g. 15m, 30m, 1h, 2h, 1d) — suggest for any task that is clearly missing one
- due: a deadline in YYYY-MM-DD format — suggest ONLY when the task or project context strongly implies a time constraint
- defer: a hide-until date in YYYY-MM-DD format — suggest ONLY when the task is clearly not actionable until a future date

End your response with EXACTLY this block — nothing after it:
→METADATA:
<taskId>|effort:30m
<taskId>|due:2026-06-01|defer:2026-05-15
(one line per task that needs changes; include only fields that need a value; omit tasks that are already complete)

If all tasks already have adequate metadata, write:
→METADATA:
(none)

Be concise. Under 60 words before the metadata block. Today's date is provided in the task list context.`,
  dump: `You are a GTD brain dump coach. Surface open loops by asking about one life area at a time:
Work tasks → Emails to send → People to follow up with → Projects falling behind → Personal errands → Home tasks → Health commitments → Finances → Learning goals → Anything nagging you
For each response say "Got it — add that to your inbox." then immediately ask about the next area. Under 50 words each. After all areas, give a summary and encourage them to process their inbox.`,
};

const OPENWEBUI_URL = (import.meta.env.VITE_OPENWEBUI_URL || "http://192.168.0.102:3000").replace(/\/$/, "");

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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
    effort:        task.effort        ?? null,
    actual_effort: task.actualEffort  ?? null,
    defer_until:   task.deferUntil    ?? null,
    notes:         task.notes         ?? null,
    recurrence:    task.recurrence    ?? null,
    parent_id:     task.parentId      ?? null,
    child_ids:     task.childIds      ?? [],
    sort_order:    task.sortOrder     ?? 0,
    updated_at:    new Date().toISOString(),
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
    effort:       row.effort        ?? null,
    actualEffort: row.actual_effort ?? null,
    deferUntil:   row.defer_until   ?? null,
    notes:        row.notes         ?? null,
    recurrence:   row.recurrence    ?? null,
    childIds:     row.child_ids     ?? [],
    sortOrder:    row.sort_order    ?? 0,
  };
  if (row.parent_id) t.parentId = row.parent_id;
  return t;
}

// Returns today as "YYYY-MM-DD" in local time (for deferred-date comparisons).
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A task is "active-deferred" when its deferUntil date is strictly after today.
function isDeferred(task) { return !!(task.deferUntil && task.deferUntil > todayStr()); }

// Returns a YYYY-MM-DD string that is (months/weeks) before the given base date string.
function subtractFromDate(base, { months = 0, weeks = 0 }) {
  const d = new Date(base + "T00:00:00");
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Computes the next occurrence task object for a recurring task.
// Returns a new task object ready to insert, or null if no recurrence set.
function buildNextOccurrence(task) {
  const rec = task.recurrence;
  if (!rec) return null;
  const anchor = rec.rescheduleFrom === "dueDate" && task.dueDate ? task.dueDate : todayStr();
  const d = new Date(anchor + "T00:00:00");
  const { frequency, interval = 1, weekDays } = rec;
  if (frequency === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (frequency === "weekly") {
    if (weekDays && weekDays.length > 0) {
      d.setDate(d.getDate() + 1);
      let tries = 0;
      while (!weekDays.includes(d.getDay()) && tries < 14) { d.setDate(d.getDate() + 1); tries++; }
    } else {
      d.setDate(d.getDate() + interval * 7);
    }
  } else if (frequency === "monthly") {
    d.setMonth(d.getMonth() + interval);
  } else if (frequency === "yearly") {
    d.setFullYear(d.getFullYear() + interval);
  }
  const nextDue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { id: _id, done: _done, actualEffort: _ae, ...rest } = task;
  return { ...rest, id: genId(), done: false, dueDate: nextDue, created: Date.now(),
    bucket: rec.sendToInbox ? "inbox" : task.bucket };
}

function formatBubble(text) {
  const parts = text.split(/(→ACTION:[^\n]+)/g);
  return parts.map((part, i) => {
    if (part.match(/→ACTION:/)) return null;
    return <span key={i} dangerouslySetInnerHTML={{ __html: part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />;
  });
}

function extractAction(text) {
  const m = text.match(/→ACTION:(next|project|someday|waiting|delete)\|?([^|\n]*)?\|?([^|\n]*)?((?:\|[^\n]*)*)?/);
  if (!m) return null;
  const extras = m[4] || "";
  const dueMatch = extras.match(/\|due:(\d{4}-\d{2}-\d{2})/);
  const deferMatch = extras.match(/\|defer:(\d{4}-\d{2}-\d{2})/);
  return {
    type: m[1],
    title: (m[2] || "").trim(),
    nextAction: (m[3] || "").trim(),
    dueDate: dueMatch ? dueMatch[1] : null,
    deferUntil: deferMatch ? deferMatch[1] : null,
  };
}

// Parse →ACTION:update from AI reply; returns { taskId, changes } or null.
function extractUpdateAction(text) {
  const m = text.match(/→ACTION:update\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const taskId = m[1].trim();
  const fieldStr = m[2];

  // notes must be last — everything after 'notes:' is its value (may contain |)
  const notesIdx = fieldStr.search(/(^|\|)notes:/);
  const pureFields = notesIdx !== -1 ? fieldStr.slice(0, notesIdx).replace(/\|$/, '') : fieldStr;
  const notesRaw   = notesIdx !== -1 ? fieldStr.slice(fieldStr.indexOf('notes:', notesIdx) + 6) : null;

  const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const changes = {};
  pureFields.split('|').filter(Boolean).forEach(pair => {
    const colon = pair.indexOf(':');
    if (colon === -1) return;
    const key = pair.slice(0, colon).trim();
    const val = pair.slice(colon + 1).trim();
    if (key === 'due')          changes.dueDate      = val;
    if (key === 'defer')        changes.deferUntil   = val;
    if (key === 'effort')       changes.effort       = val;
    if (key === 'actualEffort') changes.actualEffort = val;
    if (key === 'bucket')       changes.bucket       = val;
    if (key === 'title')        changes.text         = val;
    if (key === 'priority')     changes.priority     = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'location')     changes.location     = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'recur') {
      if (val === 'off') {
        changes.recurrence = null;
      } else {
        const [freq, intStr, daysStr] = val.split(':');
        const interval = parseInt(intStr) || 1;
        const rec = { frequency: freq, interval, rescheduleFrom: 'dueDate', sendToInbox: false };
        if (daysStr) rec.weekDays = daysStr.split(',').map(d => DAY_MAP[d.toLowerCase()]).filter(n => n !== undefined);
        changes.recurrence = rec;
      }
    }
  });
  if (notesRaw !== null) changes.notes = notesRaw.replace(/\\n/g, '\n');

  return Object.keys(changes).length ? { taskId, changes } : null;
}

// Parse →ACTION:add from AI reply; returns { title, parentId, ...fields } or null.
function extractAddAction(text) {
  const m = text.match(/→ACTION:add\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const title = m[1].trim();
  const rest = m[2];
  const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const fields = {};
  rest.split('|').filter(Boolean).forEach(pair => {
    const colon = pair.indexOf(':');
    if (colon === -1) return;
    const key = pair.slice(0, colon).trim();
    const val = pair.slice(colon + 1).trim();
    if (key === 'parent')   fields.parentId   = val;
    if (key === 'bucket')   fields.bucket     = val;
    if (key === 'due')      fields.dueDate    = val;
    if (key === 'defer')    fields.deferUntil = val;
    if (key === 'effort')   fields.effort     = val;
    if (key === 'location') fields.location   = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'recur' && val !== 'off') {
      const [freq, intStr, daysStr] = val.split(':');
      const interval = parseInt(intStr) || 1;
      const rec = { frequency: freq, interval, rescheduleFrom: 'dueDate', sendToInbox: false };
      if (daysStr) rec.weekDays = daysStr.split(',').map(d => DAY_MAP[d.toLowerCase()]).filter(n => n !== undefined);
      fields.recurrence = rec;
    }
  });
  if (!fields.parentId || !title) return null;
  return { title, ...fields };
}

// Parse →ACTION:create from AI reply; returns { title, bucket, ...fields } or null.
function extractCreateAction(text) {
  const m = text.match(/→ACTION:create\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const title = m[1].trim();
  const rest = m[2];
  const VALID_BUCKETS = new Set(['inbox', 'next', 'someday', 'waiting']);
  const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const fields = {};
  rest.split('|').filter(Boolean).forEach(pair => {
    const colon = pair.indexOf(':');
    if (colon === -1) return;
    const key = pair.slice(0, colon).trim();
    const val = pair.slice(colon + 1).trim();
    if (key === 'bucket' && VALID_BUCKETS.has(val)) fields.bucket = val;
    if (key === 'due')      fields.dueDate    = val;
    if (key === 'defer')    fields.deferUntil = val;
    if (key === 'effort')   fields.effort     = val;
    if (key === 'location') fields.location   = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'recur' && val !== 'off') {
      const [freq, intStr, daysStr] = val.split(':');
      const interval = parseInt(intStr) || 1;
      const rec = { frequency: freq, interval, rescheduleFrom: 'dueDate', sendToInbox: false };
      if (daysStr) rec.weekDays = daysStr.split(',').map(d => DAY_MAP[d.toLowerCase()]).filter(n => n !== undefined);
      fields.recurrence = rec;
    }
  });
  if (!title || !fields.bucket) return null;
  return { title, ...fields };
}

// Waterfall: a task is visible in Next Actions only when it has no incomplete next-bucket children.
// This enforces bottom-up progression — complete leaf nodes before their parents.
function waterfallFilter(nextTasks, allTasks) {
  return nextTasks.filter(task => {
    const incompleteNextChildren = allTasks.filter(
      t => t.parentId === task.id && t.bucket === "next" && !t.done
    );
    return incompleteNextChildren.length === 0;
  });
}

// Group a task list by a single metadata field.
// Multi-value fields (location, priority) use the first value.
// "project" walks up the parent chain to find the root project name.
// Tasks with no value for the field go into a field-specific fallback bucket.
function groupByField(taskList, field, allTasks = []) {
  const ungroupedLabel = field === "project" ? "No Project" : field === "effort" ? "No Effort" : "Ungrouped";
  const groups = {};
  const ungrouped = [];
  taskList.forEach(task => {
    let keys = [];
    if (field === "location") {
      keys = task.location || [];
    } else if (field === "priority") {
      keys = task.priority || [];
    } else if (field === "dueDate") {
      keys = task.dueDate ? [task.dueDate] : [];
    } else if (field === "effort") {
      keys = task.effort ? [task.effort] : [];
    } else if (field === "project") {
      // Walk up the parent chain to find the root project.
      if (task.parentId) {
        let cur = task;
        while (cur.parentId) {
          const parent = allTasks.find(t => t.id === cur.parentId);
          if (!parent) break;
          cur = parent;
        }
        if (cur.id !== task.id) keys = [cur.text];
      }
    }
    if (!keys.length) { ungrouped.push(task); return; }
    const key = keys[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  });
  // Sort effort groups by duration (shortest first); everything else alphabetically.
  const sorted = Object.entries(groups)
    .sort(([a], [b]) => field === "effort"
      ? effortToMinutes(a) - effortToMinutes(b)
      : a.localeCompare(b))
    .map(([key, items]) => ({ key, label: key, items }));
  if (ungrouped.length) sorted.push({ key: "__ungrouped__", label: ungroupedLabel, items: ungrouped });
  return sorted;
}

// Converts a human effort string (e.g. "2 hours", "3 days", "30m", "1h") to minutes.
// Handles both long-form ("30 min", "2 hours") and compact abbreviations ("30m", "2h", "1d", "1w", "1mo").
// Uses calendar time: 1 day = 24 h, 1 week = 7 d, 1 month = 30 d.
// Returns 0 for unrecognised strings so sums degrade gracefully.
function effortToMinutes(str) {
  if (!str) return 0;
  const s = str.toLowerCase().trim();
  const num = parseFloat(s);
  if (isNaN(num) || num <= 0) return 0;
  // Long-form checks first (order matters: "month" before "m", "week" before "w", etc.)
  if (s.includes("month")) return Math.round(num * 43200); // 30 d × 24 h
  if (s.includes("week"))  return Math.round(num * 10080); // 7 d × 24 h
  if (s.includes("day"))   return Math.round(num * 1440);  // 24 h
  if (s.includes("hour"))  return Math.round(num * 60);
  if (s.includes("min"))   return Math.round(num);
  // Compact abbreviations (e.g. "30m", "1h", "2d", "1w", "1mo")
  if (/^\d+(\.\d+)?mo$/.test(s)) return Math.round(num * 43200);
  if (/^\d+(\.\d+)?w$/.test(s))  return Math.round(num * 10080);
  if (/^\d+(\.\d+)?d$/.test(s))  return Math.round(num * 1440);
  if (/^\d+(\.\d+)?h$/.test(s))  return Math.round(num * 60);
  if (/^\d+(\.\d+)?m$/.test(s))  return Math.round(num);
  return 0;
}

// Returns a color for effort accuracy comparison (actual vs estimated).
// delta ≤ 0 → green (under/on time), ≤ 25% over → amber, > 25% → red.
function effortAccuracyColor(estimatedMin, actualMin) {
  if (!estimatedMin || !actualMin) return COLORS.effort;
  const delta = (actualMin - estimatedMin) / estimatedMin;
  if (delta <= 0)    return "#5ab878"; // under or on time
  if (delta <= 0.25) return "#d4a95a"; // within 25% over
  return "#d45a5a";                    // significantly over
}

// Converts a minutes total back to a compact human label (e.g. 150 → "2.5h").
function minutesToEffortLabel(minutes) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60)   return `${minutes}m`;
  if (minutes < 480)  return `${+((minutes / 60).toFixed(1))}h`;
  if (minutes < 2400) return `${+((minutes / 480).toFixed(1))}d`;
  if (minutes < 9600) return `${+((minutes / 2400).toFixed(1))}w`;
  return `${+((minutes / 9600).toFixed(1))}mo`;
}

// Builds a calibration context string for the AI system prompt.
// Uses per-label averages from completed tasks (minSamples required) and manual overrides.
// calibrationOverrides: { [label]: overrideLabel | null }
const MIN_CALIBRATION_SAMPLES = 3;
function buildCalibrationContext(tasks, efforts, calibrationOverrides) {
  const completed = tasks.filter(t => t.done && t.effort && t.actualEffort);
  if (!completed.length && !Object.values(calibrationOverrides || {}).some(Boolean)) return "";

  // Per-label stats from completed tasks
  const stats = {};
  efforts.forEach(label => { stats[label] = { totalActual: 0, count: 0 }; });
  completed.forEach(t => {
    if (stats[t.effort]) {
      stats[t.effort].totalActual += effortToMinutes(t.actualEffort);
      stats[t.effort].count       += 1;
    }
  });

  // Global average ratio (actual / estimated) — used as fallback narrative
  const globalTotalActual = completed.reduce((s, t) => s + effortToMinutes(t.actualEffort), 0);
  const globalTotalEst    = completed.reduce((s, t) => s + effortToMinutes(t.effort), 0);
  const globalRatioPct    = globalTotalEst > 0
    ? Math.round(((globalTotalActual - globalTotalEst) / globalTotalEst) * 100)
    : null;

  const lines = [];
  efforts.forEach(label => {
    const override = calibrationOverrides?.[label];
    const s = stats[label];
    if (override) {
      lines.push(`- "${label}" → use "${override}" (manual override)`);
    } else if (s && s.count >= MIN_CALIBRATION_SAMPLES) {
      const avgMin   = Math.round(s.totalActual / s.count);
      const avgLabel = minutesToEffortLabel(avgMin) || label;
      const estMin   = effortToMinutes(label);
      const pct      = estMin ? Math.round(((avgMin - estMin) / estMin) * 100) : 0;
      lines.push(`- "${label}" → actual avg ~${avgLabel} (${pct > 0 ? "+" : ""}${pct}%, n=${s.count})`);
    } else if (s && s.count > 0) {
      lines.push(`- "${label}" → ${s.count} sample${s.count > 1 ? "s" : ""} so far (insufficient for calibration, need ${MIN_CALIBRATION_SAMPLES})`);
    }
  });

  if (!lines.length && globalRatioPct === null) return "";

  let globalNote = "";
  if (globalRatioPct !== null && completed.length >= MIN_CALIBRATION_SAMPLES) {
    globalNote = globalRatioPct > 0
      ? `\nOverall this user underestimates by ~${globalRatioPct}% on average — when in doubt, suggest the next label up.`
      : `\nOverall this user estimates accurately (avg ${globalRatioPct}% variance).`;
  }

  return `\n\n## User's effort estimation calibration\n${lines.join("\n")}${globalNote}\nAlways choose effort suggestions from the user's existing effort label list only.`;
}

// Recursively sums the effort of a task and all its descendants (via childIds).
// Used to compute the total effort shown on top-level project rows.
function sumDescendantEffort(taskId, allTasks, visited = new Set()) {
  if (visited.has(taskId)) return 0; // guard against cycles
  visited.add(taskId);
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return 0;
  const own = effortToMinutes(task.effort);
  const childTotal = (task.childIds || []).reduce(
    (sum, cid) => sum + sumDescendantEffort(cid, allTasks, visited), 0
  );
  return own + childTotal;
}

// Recursively counts all descendant tasks (via childIds).
// Returns { total, incomplete } so callers can display either or both.
function countDescendants(taskId, allTasks, visited = new Set()) {
  if (visited.has(taskId)) return { total: 0, incomplete: 0 };
  visited.add(taskId);
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return { total: 0, incomplete: 0 };
  const own = { total: 1, incomplete: task.done ? 0 : 1 };
  const childTotals = (task.childIds || []).reduce(
    (acc, cid) => {
      const c = countDescendants(cid, allTasks, visited);
      return { total: acc.total + c.total, incomplete: acc.incomplete + c.incomplete };
    },
    { total: 0, incomplete: 0 }
  );
  return { total: own.total + childTotals.total, incomplete: own.incomplete + childTotals.incomplete };
}

// Parses the →SUGGESTIONS: / ->SUGGESTIONS: block from a projectReview AI reply.
// Returns an array of suggestion strings, empty if none or block absent.
function extractSuggestions(text) {
  // Accept both → (U+2192) and -> prefixes; normalise \r\n → \n
  const normalised = text.replace(/\r\n/g, "\n").replace(/->/g, "→");
  const m = normalised.match(/→SUGGESTIONS:\n([\s\S]*)$/);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map(l => l.replace(/^\d+\.\s*|-\s*/, "").trim())
    .filter(l => l && l !== "(none)" && l !== "(none).");
}

// Parses the →METADATA: / ->METADATA: block from a projectMetadata AI reply.
// Returns an array of { taskId, fields: { effort?, dueDate?, deferUntil? } }.
function extractMetadata(text) {
  const normalised = text.replace(/\r\n/g, "\n").replace(/->/g, "→");
  const m = normalised.match(/→METADATA:\n([\s\S]*)$/);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && l !== "(none)" && l !== "(none)." && l.includes("|"))
    .map(l => {
      const [taskId, ...pairs] = l.split("|");
      const fields = {};
      pairs.forEach(p => {
        const [k, v] = p.split(":").map(s => s.trim());
        if (k === "effort")  fields.effort    = v;
        if (k === "due")     fields.dueDate   = v;
        if (k === "defer")   fields.deferUntil = v;
      });
      return { taskId: taskId.trim(), fields };
    })
    .filter(r => r.taskId && Object.keys(r.fields).length > 0);
}

// Returns children in display order.
// parentId === null → root projects (bucket "project", no parentId), ordered by tasks array position.
// otherwise → ordered by parent's childIds array.
function getOrderedChildren(parentId, allTasks) {
  if (parentId === null) {
    return allTasks.filter(t => t.bucket === "project" && !t.parentId);
  }
  const parent = allTasks.find(t => t.id === parentId);
  if (!parent) return [];
  return (parent.childIds || []).map(id => allTasks.find(t => t.id === id)).filter(Boolean);
}

// Pure function: returns a new tasks array after moving dragId to targetId at position.
// position: "before" | "inside" | "after"
// Handles: reorder within level, reparent, promote to root, demote into project.
function moveTaskInTree(allTasks, dragId, targetId, position) {
  if (dragId === targetId) return allTasks;
  const dragged = allTasks.find(t => t.id === dragId);
  const target  = allTasks.find(t => t.id === targetId);
  if (!dragged || !target) return allTasks;

  // Guard: don't allow dropping inside own descendant (would create a cycle).
  function isAncestorOf(ancestorId, nodeId, seen = new Set()) {
    if (seen.has(nodeId)) return false;
    seen.add(nodeId);
    const node = allTasks.find(t => t.id === nodeId);
    if (!node?.parentId) return false;
    if (node.parentId === ancestorId) return true;
    return isAncestorOf(ancestorId, node.parentId, seen);
  }
  if (isAncestorOf(dragId, targetId)) return allTasks;

  const newParentId = position === "inside" ? targetId : (target.parentId || null);
  const newBucket   = newParentId ? "next" : "project";

  // 1. Remove dragged from its current parent's childIds.
  let result = allTasks.map(t =>
    t.childIds?.includes(dragId) ? { ...t, childIds: t.childIds.filter(id => id !== dragId) } : t
  );

  // 2. Update dragged task's parentId and bucket.
  result = result.map(t => {
    if (t.id !== dragId) return t;
    if (newParentId) return { ...t, bucket: newBucket, parentId: newParentId };
    const { parentId: _drop, ...rest } = t;           // promote to root → remove parentId
    return { ...rest, bucket: newBucket };
  });

  // 3a. Inserting as child of newParentId → update parent's childIds.
  if (newParentId) {
    result = result.map(t => {
      if (t.id !== newParentId) return t;
      let ids = (t.childIds || []).filter(id => id !== dragId);
      if (position === "inside") {
        ids = [dragId, ...ids];                        // prepend as first child
      } else {
        const ref = ids.indexOf(targetId);
        const at  = ref === -1 ? ids.length : (position === "before" ? ref : ref + 1);
        ids.splice(at, 0, dragId);
      }
      return { ...t, childIds: ids };
    });
  } else {
    // 3b. Root-level reorder: splice into the tasks array.
    const draggedTask = result.find(t => t.id === dragId);
    result = result.filter(t => t.id !== dragId);
    const tIdx = result.findIndex(t => t.id === targetId);
    const at   = tIdx === -1 ? 0 : (position === "before" ? tIdx : tIdx + 1);
    result.splice(Math.max(0, at), 0, draggedTask);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Resizable panel utilities
// ---------------------------------------------------------------------------
function useResizer(storageKey, defaultSize, { min, max, direction = 'h', sign = 1 }) {
  const [size, setSize] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored, 10) : defaultSize;
  });
  // Keep a ref in sync so mousedown closures always see the current size.
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => { localStorage.setItem(storageKey, size); }, [storageKey, size]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const startPos  = direction === 'h' ? e.clientX : e.clientY;
    const startSize = sizeRef.current;
    const onMove = (ev) => {
      const delta = sign * ((direction === 'h' ? ev.clientX : ev.clientY) - startPos);
      setSize(Math.min(max, Math.max(min, startSize + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor     = direction === 'h' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [min, max, direction, sign]);

  return [size, handleMouseDown];
}

function ResizeHandle({ onMouseDown, direction = 'h' }) {
  const [hovered, setHovered] = useState(false);
  const isH = direction === 'h';
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flexShrink: 0,
        width:  isH ? 4 : '100%',
        height: isH ? '100%' : 4,
        cursor: isH ? 'col-resize' : 'row-resize',
        background: hovered ? COLORS.border2 : COLORS.border,
        transition: 'background 0.15s',
        zIndex: 10,
      }}
    />
  );
}

export default function GTDManager() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_tasks") || "[]"); } catch { return []; }
  });
  const [currentBucket, setCurrentBucket] = useState("inbox");
  const [addText, setAddText] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi! I'm your GTD Coach. I can see your task list and help you stay organized.\n\nAdd tasks to your **Inbox**, then hit **Process Inbox with AI** to sort them — or just ask me anything." }]);
  const [chatHistory, setChatHistory] = useState([]);
  const [coachMode, setCoachMode] = useState("chat");
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [moveMenu, setMoveMenu] = useState(null);
  const [pendingAction, setPendingAction] = useState(null); // { type, title, nextAction }
  const chatEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const [provider, setProvider] = useState(() => localStorage.getItem("gtd_provider") || "claude");
  const [localModel, setLocalModel] = useState(() => localStorage.getItem("gtd_local_model") || "llama3.3:70b");
  const [availableModels, setAvailableModels] = useState([]);
  const [locations, setLocations] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_locations") || "null") || ["Home", "Work", "Phone", "Computer"]; } catch { return ["Home", "Work", "Phone", "Computer"]; }
  });

  const DEFAULT_EFFORTS = ["2 min", "5 min", "10 min", "30 min", "1 hour", "2 hours", "6 hours", "1 day", "3 days", "1 week", "1 month"];
  const [efforts, setEfforts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_efforts") || "null") || DEFAULT_EFFORTS; } catch { return DEFAULT_EFFORTS; }
  });
  // calibrationOverrides: { [effortLabel]: overrideLabel | null }
  // Stores manual overrides set in Settings; auto-computed values are derived from tasks at runtime.
  const [calibrationOverrides, setCalibrationOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_effort_calibration") || "null") || {}; } catch { return {}; }
  });
  const [tagDisplay,  setTagDisplay]  = useState(() => localStorage.getItem("gtd_tag_display") || "below");
  const [showSettings, setShowSettings] = useState(false);
  const [nextGroupBy, setNextGroupBy] = useState("none");
  const [projectParentId, setProjectParentId] = useState("__new__");
  // Set of task IDs whose children are currently hidden in the Projects view.
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  // ID of the task whose detail panel is currently open (null = closed).
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [actualEffortPrompt, setActualEffortPrompt] = useState(null); // { taskId, taskText, estimatedEffort }
  const [pendingRollup, setPendingRollup] = useState(null);           // { taskId, taskText, notes, parentId, parentText }
  const [pendingDeferCheck, setPendingDeferCheck] = useState(null);    // { taskId, taskText, deferredChildren }
  const [dragId,             setDragId]             = useState(null);
  const [dropTarget,         setDropTarget]         = useState(null); // { id, position: "before"|"inside"|"after" }
  const [reviewProjectIdx,   setReviewProjectIdx]   = useState(0);
  const [reviewSuggestions,  setReviewSuggestions]  = useState([]);   // [{ text, checked }]
  const [reviewReady,        setReviewReady]        = useState(false); // true after AI responds for current project
  const [reviewMode,         setReviewMode]         = useState(null);  // null | "tasks" | "metadata"
  const [metadataSuggestions,setMetadataSuggestions] = useState([]);  // [{ taskId, taskText, fields: {effort?,dueDate?,deferUntil?}, overrides: {...}, accepted: bool }]

  // ── Auth ───────────────────────────────────────────────────────────────
  const [authUser,    setAuthUser]    = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail,   setAuthEmail]   = useState("");
  const [authSent,    setAuthSent]    = useState(false);

  const sendMagicLink = useCallback(async () => {
    if (!authEmail.trim()) return;
    await supabase.auth.signInWithOtp({ email: authEmail.trim() });
    setAuthSent(true);
  }, [authEmail]);

  // true once the initial Supabase read (or migration) has completed
  const [supabaseReady, setSupabaseReady] = useState(false);
  // tracks previous tasks snapshot for write-sync diffing
  const prevTasksRef = useRef(null);
  // 'synced' | 'offline'
  const [syncStatus, setSyncStatus] = useState('synced');

  // Panel resize state — persisted across sessions
  const [sidebarWidth, sidebarDragDown]      = useResizer("gtd_sidebar_w",     240,                                    { min: 160, max: 420, direction: 'h', sign:  1 });
  const [coachHeight,  coachDragDown]         = useResizer("gtd_coach_h",       Math.round(window.innerHeight * 0.42), { min: 80,  max: 650, direction: 'v', sign: -1 });
  const [detailWidth,  detailDragDown]        = useResizer("gtd_detail_w",      360,                                   { min: 240, max: 600, direction: 'h', sign: -1 });
  const [chatInputHeight, chatInputDragDown]  = useResizer("gtd_chat_input_h",  60,                                    { min: 36,  max: 300, direction: 'v', sign: -1 });

  useEffect(() => {
    localStorage.setItem("gtd_tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Auth: restore session on mount, listen for magic-link callback
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Supabase read: fetch tasks once auth resolves; auto-migrate localStorage if empty
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase read error:', error);
          setSupabaseReady(true);
          return;
        }
        if (data && data.length > 0) {
          // Supabase has data — use it as the source of truth
          setTasks(data.map(dbToTask));
          setSupabaseReady(true);
        } else {
          // Supabase is empty — migrate from localStorage
          const local = (() => {
            try { return JSON.parse(localStorage.getItem('gtd_tasks') || '[]'); } catch { return []; }
          })();
          if (local.length > 0) {
            const rows = local.map(t => taskToDb(t, authUser.id));
            supabase.from('tasks').insert(rows).then(({ error: e2 }) => {
              if (e2) console.error('Migration failed:', e2);
              else console.log(`Migrated ${rows.length} tasks to Supabase`);
              setSupabaseReady(true);
            });
          } else {
            setSupabaseReady(true);
          }
        }
      });
  }, [authUser]);

  // Supabase write: diff tasks on every change and sync inserts/updates/deletes
  useEffect(() => {
    if (!authUser || !supabaseReady) { prevTasksRef.current = tasks; return; }
    const prev = prevTasksRef.current;
    prevTasksRef.current = tasks;
    if (!prev) return;

    const prevMap = new Map(prev.map(t => [t.id, t]));
    const currMap = new Map(tasks.map(t => [t.id, t]));

    const upserts = tasks.filter(t => {
      const old = prevMap.get(t.id);
      return !old || JSON.stringify(old) !== JSON.stringify(t);
    });
    const deletes = prev.filter(t => !currMap.has(t.id));
    if (!upserts.length && !deletes.length) return;

    const queuePending = (ops) => {
      const existing = JSON.parse(localStorage.getItem('gtd_pending_writes') || '[]');
      localStorage.setItem('gtd_pending_writes', JSON.stringify([...existing, ...ops]));
      setSyncStatus('offline');
    };

    if (upserts.length) {
      supabase.from('tasks')
        .upsert(upserts.map(t => taskToDb(t, authUser.id)), { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Supabase upsert:', error);
            queuePending(upserts.map(t => ({ type: 'upsert', row: taskToDb(t, authUser.id) })));
          } else { setSyncStatus('synced'); }
        });
    }
    if (deletes.length) {
      supabase.from('tasks').delete()
        .in('id', deletes.map(t => t.id)).eq('user_id', authUser.id)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase delete:', error);
            queuePending(deletes.map(t => ({ type: 'delete', id: t.id })));
          } else if (!upserts.length) { setSyncStatus('synced'); }
        });
    }
  }, [tasks, authUser, supabaseReady]);

  // Phase 6 — offline resilience: flush pending writes when connectivity returns
  useEffect(() => {
    const flushPending = async () => {
      const raw = localStorage.getItem('gtd_pending_writes');
      if (!raw || !authUser) return;
      const pending = JSON.parse(raw);
      if (!pending?.length) return;
      const upserts = pending.filter(p => p.type === 'upsert');
      const deletes = pending.filter(p => p.type === 'delete');
      let ok = true;
      if (upserts.length) {
        const { error } = await supabase.from('tasks')
          .upsert(upserts.map(p => p.row), { onConflict: 'id' });
        if (error) { console.error('Flush upsert failed:', error); ok = false; }
      }
      if (ok && deletes.length) {
        const { error } = await supabase.from('tasks').delete()
          .in('id', deletes.map(p => p.id)).eq('user_id', authUser.id);
        if (error) { console.error('Flush delete failed:', error); ok = false; }
      }
      if (ok) {
        localStorage.removeItem('gtd_pending_writes');
        setSyncStatus('synced');
        console.log('Pending writes flushed successfully');
      }
    };
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    window.addEventListener('online', flushPending);
    window.addEventListener('offline', () => setSyncStatus('offline'));
    return () => {
      window.removeEventListener('online', flushPending);
      window.removeEventListener('offline', () => setSyncStatus('offline'));
    };
  }, [authUser]);

  // Phase 7 — realtime: receive changes from other devices
  useEffect(() => {
    if (!authUser || !supabaseReady) return;
    const channel = supabase
      .channel(`tasks-${authUser.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `user_id=eq.${authUser.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const incoming = dbToTask(payload.new);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === incoming.id);
            if (idx === -1) return [incoming, ...prev];
            const next = [...prev];
            next[idx] = incoming;
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [authUser, supabaseReady]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { localStorage.setItem("gtd_provider", provider); }, [provider]);
  useEffect(() => { localStorage.setItem("gtd_local_model", localModel); }, [localModel]);
  useEffect(() => { localStorage.setItem("gtd_locations", JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem("gtd_efforts",             JSON.stringify(efforts));             }, [efforts]);
  useEffect(() => { localStorage.setItem("gtd_effort_calibration", JSON.stringify(calibrationOverrides)); }, [calibrationOverrides]);
  useEffect(() => { localStorage.setItem("gtd_tag_display", tagDisplay); }, [tagDisplay]);
  useEffect(() => { if (currentBucket !== "project") setProjectParentId("__new__"); }, [currentBucket]);
  useEffect(() => { setSelectedTaskId(null); }, [currentBucket]);

  // Auto-surface: on mount, move any standalone deferred tasks whose wake date has passed into Inbox.
  // Only moves tasks with no parentId (project subtasks stay in place; their deferUntil just stops hiding them).
  useEffect(() => {
    const today = todayStr();
    setTasks(prev => {
      const wokeIds = new Set(
        prev.filter(t =>
          t.deferUntil && t.deferUntil <= today && !t.done && !t.parentId &&
          t.bucket !== "inbox" && t.bucket !== "done" && t.bucket !== "inboxHistory"
        ).map(t => t.id)
      );
      if (!wokeIds.size) return prev;
      return prev.map(t => wokeIds.has(t.id) ? { ...t, bucket: "inbox", deferUntil: null } : t);
    });
  }, []); // run once on mount

  const getTaskContext = useCallback(() => {
    const today = todayStr();
    const bucketNames = { inbox: "Inbox", next: "Next Actions", project: "Projects", waiting: "Waiting For", someday: "Someday/Maybe" };
    const sections = Object.entries(bucketNames).map(([k, label]) => {
      const items = tasks.filter(t => t.bucket === k && !t.done);
      if (!items.length) return `${label}: empty`;
      const lines = items.map(t => {
        const meta = [];
        if (t.dueDate)          meta.push(`due:${t.dueDate}`);
        if (t.deferUntil)       meta.push(`defer-until:${t.deferUntil}`);
        if (t.effort)           meta.push(`effort:${t.effort}`);
        if (t.actualEffort)     meta.push(`actual-effort:${t.actualEffort}`);
        if (t.location?.length) meta.push(`location:${t.location.join(",")}`);
        if (t.priority?.length) meta.push(`priority:${t.priority.join(",")}`);
        if (t.notes)            meta.push(`has-notes`);
        if (t.recurrence) {
          const r = t.recurrence;
          const days = r.weekDays?.length
            ? `:${r.weekDays.map(d => ["sun","mon","tue","wed","thu","fri","sat"][d]).join(",")}`
            : "";
          meta.push(`recur:${r.frequency}:${r.interval || 1}${days}`);
        }
        const idTag = `[id:${t.id}] `;
        return meta.length ? `- ${idTag}${t.text} [${meta.join("] [")}]` : `- ${idTag}${t.text}`;
      });
      return `${label} (${items.length}):\n${lines.join("\n")}`;
    });
    return `Today's date: ${today}\n\n${sections.join("\n\n")}`;
  }, [tasks]);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${OPENWEBUI_URL}/api/models`, {
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}` },
      });
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      if (models.length) setAvailableModels(models);
    } catch { /* Open WebUI not reachable — fail silently */ }
  }, []);

  useEffect(() => {
    if (provider === "local") fetchModels();
  }, [provider, fetchModels]);

  const callAI = useCallback(async (userMsg, mode, history) => {
    // Inject calibration context only for modes that suggest effort estimates
    const calibCtx = (mode === "process" || mode === "projectMetadata")
      ? buildCalibrationContext(tasks, efforts, calibrationOverrides)
      : "";
    const systemPrompt = SYSTEM_PROMPTS[mode] + calibCtx + "\n\n[Current Task List]\n" + getTaskContext();
    const newHistory = [...history, { role: "user", content: userMsg }];

    setLoading(true);
    try {
      let reply;

      if (provider === "claude") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            system: systemPrompt,
            messages: newHistory,
          }),
        });
        const data = await res.json();
        console.log("[Claude API response]", data);
        if (!res.ok || data.error) {
          throw new Error(`Anthropic error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
        }
        reply = data.content?.[0]?.text || "Sorry, something went wrong.";
      } else {
        const res = await fetch(`${OPENWEBUI_URL}/api/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}`,
          },
          body: JSON.stringify({
            model: localModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...newHistory,
            ],
          }),
        });
        const data = await res.json();
        console.log("[Open WebUI response]", data);
        if (!res.ok || data.error) {
          throw new Error(`Open WebUI error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
        }
        reply = data.choices?.[0]?.message?.content || "Sorry, something went wrong.";
      }

      const updatedHistory = [...newHistory, { role: "assistant", content: reply }];
      setChatHistory(updatedHistory);

      // Apply →ACTION:update, →ACTION:add, or →ACTION:create when in chat mode
      let updateChip = null;
      let actionError = null;
      if (mode === "chat") {
        const upd = extractUpdateAction(reply);
        if (upd) {
          const target = tasks.find(t => t.id === upd.taskId);
          if (target) {
            updateTask(upd.taskId, upd.changes);
            const fieldLabels = Object.keys(upd.changes).map(k => ({
              notes: 'notes', dueDate: 'due date', deferUntil: 'defer date',
              effort: 'effort', actualEffort: 'actual effort', text: 'title', bucket: 'bucket',
              priority: 'priority', location: 'location', recurrence: 'recurrence',
            }[k] || k));
            updateChip = { taskName: target.text, fields: fieldLabels };
          } else {
            actionError = `⚠ Action failed: no task found with ID "${upd.taskId}". The task may have been deleted or the ID is incorrect.`;
          }
        } else {
          const add = extractAddAction(reply);
          if (add) {
            const { title, parentId, bucket = "next", dueDate = null, deferUntil = null,
                    effort = null, location = [], recurrence = null } = add;
            const parent = tasks.find(t => t.id === parentId);
            if (parent) {
              const newId = genId();
              const newTask = {
                id: newId, text: title, bucket, done: false, created: Date.now(),
                parentId, priority: [], location, dueDate, effort, actualEffort: null,
                deferUntil, notes: null, recurrence,
              };
              setTasks(prev => [
                ...prev.map(t => t.id === parentId
                  ? { ...t, childIds: [...(t.childIds || []), newId] }
                  : t
                ),
                newTask,
              ]);
              updateChip = { taskName: title, fields: ["added under " + parent.text] };
            } else {
              actionError = `⚠ Action failed: no task found with parent ID "${parentId}". The parent may not exist or has been deleted.`;
            }
          } else {
            const create = extractCreateAction(reply);
            if (create) {
              const { title, bucket, dueDate = null, deferUntil = null,
                      effort = null, location = [], recurrence = null } = create;
              const newId = genId();
              const newTask = {
                id: newId, text: title, bucket, done: false, created: Date.now(),
                priority: [], location, dueDate, effort, actualEffort: null,
                deferUntil, notes: null, recurrence,
              };
              setTasks(prev => [newTask, ...prev]);
              updateChip = { taskName: title, fields: ["created in " + bucket] };
            }
          }
        }
      }

      if (actionError) {
        setMessages(prev => [...prev,
          { role: "assistant", text: reply, updateChip },
          { role: "assistant", text: actionError },
        ]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: reply, updateChip }]);
      }

      const action = extractAction(reply);
      if (action) setPendingAction(action);

      return reply;
    } catch (e) {
      console.error("[callAI error]", e);
      const err = `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: "assistant", text: err }]);
    } finally {
      setLoading(false);
    }
  }, [getTaskContext, tasks, efforts, calibrationOverrides, provider, localModel]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || loading) return;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    await callAI(text, coachMode, chatHistory);
  }, [chatInput, loading, coachMode, chatHistory, callAI]);

  const switchCoachMode = useCallback((mode, introMsg) => {
    setCoachMode(mode);
    setChatHistory([]);
    setPendingAction(null);
    setMessages([{ role: "assistant", text: introMsg }]);
  }, []);

  const processNextInboxItem = useCallback(async (task) => {
    setPendingAction(null);
    setChatHistory([]);
    const prompt = `Process this GTD inbox item: "${task.text}"`;
    setMessages(prev => [...prev, { role: "user", text: `Processing: **"${task.text}"**` }]);
    await callAI(prompt, "process", []);
  }, [callAI]);

  const handleConfirmMove = useCallback(() => {
    if (!pendingAction) return;
    const { type, title, nextAction, dueDate: aiDue, deferUntil: aiDefer } = pendingAction;

    const inboxItems = tasks.filter(t => t.bucket === "inbox");
    const current = inboxItems[0];
    const nextItem = inboxItems[1];

    if (!current) return;

    // Archive the original inbox item
    setTasks(prev => prev.map(t =>
      t.id === current.id ? { ...t, bucket: "inboxHistory" } : t
    ));

    // Create new tasks based on action type, applying any AI-suggested dates
    if (type === "next") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "next", done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null }, ...prev]);
    } else if (type === "project") {
      const projectId = genId();
      const actionId = genId();
      setTasks(prev => [
        { id: projectId, text: title || current.text, bucket: "project", done: false, created: Date.now(), childIds: [actionId], priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null },
        { id: actionId, text: nextAction || title, bucket: "next", done: false, created: Date.now(), parentId: projectId, priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null },
        ...prev,
      ]);
    } else if (type === "someday") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "someday", done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null }, ...prev]);
    } else if (type === "waiting") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "waiting", done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null }, ...prev]);
    }
    // type === "delete": just archive, no new task

    setPendingAction(null);

    // Auto-continue to next inbox item
    if (nextItem) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else {
      setMessages(prev => [...prev, { role: "assistant", text: "🎉 **Inbox is clear!** Every item has been processed. Well done." }]);
    }
  }, [pendingAction, tasks, processNextInboxItem]);

  const startProcessInbox = useCallback(async () => {
    setCurrentBucket("inbox");
    const inbox = tasks.filter(t => t.bucket === "inbox");
    if (inbox.length === 0) {
      switchCoachMode("process", "Your inbox is empty — nothing to process! Add some tasks first or do a Brain Dump.");
      return;
    }
    switchCoachMode("process", `You have **${inbox.length} item${inbox.length > 1 ? "s" : ""}** in your inbox. Processing them one by one…`);
    setTimeout(() => processNextInboxItem(inbox[0]), 100);
  }, [tasks, switchCoachMode, processNextInboxItem]);

  const startWeeklyReview = () => {
    const total = tasks.filter(t => t.bucket !== "done").length;
    switchCoachMode("review", `Let's do your Weekly Review. You have **${total} active tasks** across your lists.\n\n**Step 1: Capture loose ends.**\nLook around — any sticky notes, papers, or things not yet in your system?`);
  };

  const startBrainDump = () => {
    switchCoachMode("dump", "Let's surface everything in your head and get it into your inbox.\n\n**Starting with work:** What professional tasks, deadlines, or commitments have been on your mind that aren't written down anywhere?");
  };

  // ── Mode A: Task-completeness review ────────────────────────────────────
  const reviewProject = useCallback(async (project, idx, total) => {
    setCurrentBucket("project");
    const children = getOrderedChildren(project.id, tasks);
    const subtaskLines = children.length
      ? children.map(t => `- ${t.text}${t.done ? " ✓" : ""}`).join("\n")
      : "(none yet)";
    const meta = [
      project.dueDate                        ? `Due: ${project.dueDate}`                         : null,
      (project.priority || []).length        ? `Priority: ${project.priority.join(", ")}`         : null,
      (project.location || []).length        ? `Location: ${project.location.join(", ")}`         : null,
    ].filter(Boolean).join(" | ") || "No metadata set";

    const prompt =
      `Project ${idx + 1} of ${total}: "${project.text}"\n` +
      `Metadata: ${meta}\n` +
      `Current subtasks:\n${subtaskLines}`;

    setMessages(prev => [...prev, { role: "user", text: `🔍 Reviewing **"${project.text}"** (${idx + 1} of ${total})` }]);
    setReviewReady(false);
    const reply = await callAI(prompt, "projectReview", []);
    if (reply) {
      const suggestions = extractSuggestions(reply);
      setReviewSuggestions(suggestions.map(text => ({ text, checked: true })));
      setReviewProjectIdx(idx);
      setReviewReady(true);
    }
  }, [tasks, callAI]);

  const advanceProjectReview = useCallback(() => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const project = rootProjects[reviewProjectIdx];

    // Add checked suggestions as new subtasks of the current project
    if (project) {
      const selected = reviewSuggestions.filter(s => s.checked);
      if (selected.length) {
        const newSubtasks = selected.map(s => ({
          id: genId(), text: s.text, bucket: "next", done: false,
          created: Date.now(), parentId: project.id,
          priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null,
        }));
        const newIds = newSubtasks.map(t => t.id);
        setTasks(prev => [
          ...prev.map(t =>
            t.id === project.id ? { ...t, childIds: [...(t.childIds || []), ...newIds] } : t
          ),
          ...newSubtasks,
        ]);
      }
    }

    setReviewSuggestions([]);
    setReviewReady(false);
    const nextIdx = reviewProjectIdx + 1;

    if (nextIdx >= rootProjects.length) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `🎉 **All ${rootProjects.length} project${rootProjects.length !== 1 ? "s" : ""} reviewed!** Your project list is up to date. Switch to Next Actions to see what's ready to work on.`,
      }]);
      setCoachMode("chat");
    } else {
      reviewProject(rootProjects[nextIdx], nextIdx, rootProjects.length);
    }
  }, [reviewProjectIdx, reviewSuggestions, tasks, reviewProject]);

  // ── Mode B: Metadata-quality review ─────────────────────────────────────
  const reviewProjectMetadata = useCallback(async (project, idx, total) => {
    setCurrentBucket("project");
    const children = getOrderedChildren(project.id, tasks);
    const activeTasks = children.filter(t => !t.done);
    const taskLines = activeTasks.length
      ? activeTasks.map(t => {
          const meta = [
            `effort:${t.effort || "none"}`,
            `due:${t.dueDate || "none"}`,
            `defer:${t.deferUntil || "none"}`,
          ].join(", ");
          return `- [${t.id}] ${t.text} (${meta})`;
        }).join("\n")
      : "(no active subtasks)";

    const prompt =
      `Project ${idx + 1} of ${total}: "${project.text}"\n` +
      `Today: ${todayStr()}\n` +
      `Active subtasks:\n${taskLines}`;

    setMessages(prev => [...prev, { role: "user", text: `🏷 Reviewing metadata for **"${project.text}"** (${idx + 1} of ${total})` }]);
    setReviewReady(false);
    const reply = await callAI(prompt, "projectMetadata", []);
    if (reply) {
      const parsed = extractMetadata(reply);
      const suggestions = parsed.map(({ taskId, fields }) => {
        const task = tasks.find(t => t.id === taskId);
        return {
          taskId,
          taskText: task ? task.text : taskId,
          fields,                  // original AI suggestion
          overrides: { ...fields }, // user-editable copy shown in bar
          accepted: true,
        };
      });
      setMetadataSuggestions(suggestions);
      setReviewProjectIdx(idx);
      setReviewReady(true);
    }
  }, [tasks, callAI]);

  const updateTask = useCallback((id, changes) => {
    setTasks(prev => {
      // Fast path: no deferUntil change — simple single-task update
      if (!("deferUntil" in changes)) {
        return prev.map(t => t.id === id ? { ...t, ...changes } : t);
      }
      // Collect all descendant IDs recursively via childIds
      const getDescendants = (taskId) => {
        const task = prev.find(t => t.id === taskId);
        if (!task || !task.childIds?.length) return [];
        return task.childIds.flatMap(cid => [cid, ...getDescendants(cid)]);
      };
      const target = prev.find(t => t.id === id);
      if (!target) return prev.map(t => t.id === id ? { ...t, ...changes } : t);
      const oldDefer = target.deferUntil;
      const newDefer = changes.deferUntil ?? null;
      const descendants = new Set(getDescendants(id));
      return prev.map(t => {
        if (t.id === id) return { ...t, ...changes };
        if (!descendants.has(t.id)) return t;
        if (newDefer !== null) {
          // Setting: cascade new date to all descendants
          return { ...t, deferUntil: newDefer };
        } else {
          // Clearing: only clear descendants that shared the old value
          return t.deferUntil === oldDefer ? { ...t, deferUntil: null } : t;
        }
      });
    });
  }, []);

  const spawnNextOccurrence = useCallback((task) => {
    if (!task.recurrence) return;
    const newTask = buildNextOccurrence(task);
    if (newTask) setTasks(prev => [newTask, ...prev]);
  }, []);

  const skipRecurrence = useCallback((id) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task || !task.recurrence) return prev;
      const newTask = buildNextOccurrence(task);
      return newTask ? [newTask, ...prev.filter(t => t.id !== id)] : prev.filter(t => t.id !== id);
    });
  }, []);

  const advanceMetadataReview = useCallback(() => {
    // Apply all accepted metadata suggestions
    metadataSuggestions
      .filter(s => s.accepted)
      .forEach(s => updateTask(s.taskId, s.overrides));

    setMetadataSuggestions([]);
    setReviewReady(false);
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const nextIdx = reviewProjectIdx + 1;

    if (nextIdx >= rootProjects.length) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `🎉 **All ${rootProjects.length} project${rootProjects.length !== 1 ? "s" : ""} reviewed!** Metadata has been updated across your projects.`,
      }]);
      setCoachMode("chat");
    } else {
      reviewProjectMetadata(rootProjects[nextIdx], nextIdx, rootProjects.length);
    }
  }, [reviewProjectIdx, metadataSuggestions, tasks, reviewProjectMetadata, updateTask]);

  // ── Entry point + mode selection ────────────────────────────────────────
  const startProjectReview = useCallback(() => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    if (!rootProjects.length) {
      switchCoachMode("chat", "You have no active projects to review. Add some projects first, then come back!");
      return;
    }
    setCoachMode("projectReview");
    setChatHistory([]);
    setPendingAction(null);
    setReviewProjectIdx(0);
    setReviewSuggestions([]);
    setMetadataSuggestions([]);
    setReviewReady(false);
    setReviewMode(null);
    setMessages([{
      role: "assistant",
      text: `Let's review your **${rootProjects.length} active project${rootProjects.length !== 1 ? "s" : ""}**. What should we focus on?`,
    }]);
    // ReviewModeBar renders now; actual review starts after mode selection
  }, [tasks, switchCoachMode]);

  const selectReviewMode = useCallback((mode) => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    setReviewMode(mode);
    if (mode === "tasks") {
      reviewProject(rootProjects[0], 0, rootProjects.length);
    } else {
      reviewProjectMetadata(rootProjects[0], 0, rootProjects.length);
    }
  }, [tasks, reviewProject, reviewProjectMetadata]);

  const askAIAboutTask = useCallback(async (task) => {
    setCurrentBucket("inbox");
    switchCoachMode("process", `Let's clarify: **"${task.text}"**`);
    setTimeout(() => processNextInboxItem(task), 100);
  }, [switchCoachMode, processNextInboxItem]);

  const addTask = (bucket) => {
    const text = addText.trim();
    if (!text) return;
    setTasks(prev => [{ id: genId(), text, bucket: bucket || currentBucket, done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null }, ...prev]);
    setAddText("");
  };

  const addAndProcess = () => {
    const text = addText.trim();
    if (!text) return;
    const task = { id: genId(), text, bucket: "inbox", done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null };
    setTasks(prev => [task, ...prev]);
    setAddText("");
    setCurrentBucket("inbox");
    askAIAboutTask(task);
  };

  const addProjectTask = () => {
    const text = addText.trim();
    if (!text) return;
    if (projectParentId === "__new__") {
      // Create a new root project
      setTasks(prev => [
        { id: genId(), text, bucket: "project", done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [] },
        ...prev,
      ]);
    } else {
      // Add as next-action child of an existing project
      const childId = genId();
      setTasks(prev => [
        ...prev.map(t =>
          t.id === projectParentId
            ? { ...t, childIds: [...(t.childIds || []), childId] }
            : t
        ),
        { id: childId, text, bucket: "next", done: false, created: Date.now(), parentId: projectParentId, priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null },
      ]);
    }
    setAddText("");
  };

  const moveTask = (id, bucket) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, bucket, done: bucket === "done" } : t));
    setMoveMenu(null);
    setPendingAction(null);
  };

  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

  const completeTask = useCallback((id, options = {}) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // When marking DONE (not un-doing):
    if (!task.done) {
      // 1. Deferred/Someday child check — warn if any children are in defer or someday
      if (!options.skipDeferCheck) {
        const deferredKids = tasks.filter(t => t.parentId === id && (t.bucket === "deferred" || t.bucket === "someday") && !t.done);
        if (deferredKids.length > 0) {
          setPendingDeferCheck({ taskId: id, taskText: task.text, deferredChildren: deferredKids });
          return;
        }
      }
      // 2. Roll-up prompt: subtask with notes gets a chance to append to immediate parent
      if (task.notes && task.parentId) {
        const parent = tasks.find(t => t.id === task.parentId);
        if (parent) {
          setPendingRollup({ taskId: id, taskText: task.text, notes: task.notes, parentId: parent.id, parentText: parent.text });
          return;
        }
      }
      // 3. Effort prompt: task has estimate but no recorded actual time
      if (task.effort && !task.actualEffort) {
        setActualEffortPrompt({ taskId: id, taskText: task.text, estimatedEffort: task.effort });
        return;
      }
    }

    if (!task.done) {
      const nextOcc = task.recurrence ? buildNextOccurrence(task) : null;
      setTasks(prev => {
        const mapped = prev.map(t => t.id === id ? { ...t, done: true, bucket: "done" } : t);
        return nextOcc ? [nextOcc, ...mapped] : mapped;
      });
    } else {
      setTasks(prev => prev.map(t => t.id === id
        ? { ...t, done: false, bucket: "inbox", actualEffort: null }
        : t
      ));
    }
  }, [tasks]);

  // After roll-up decision, check if effort prompt is also needed, then complete the task.
  const finishComplete = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.effort && !task.actualEffort) {
      setActualEffortPrompt({ taskId, taskText: task.text, estimatedEffort: task.effort });
    } else {
      const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
      setTasks(prev => {
        const mapped = prev.map(t => t.id === taskId ? { ...t, done: true, bucket: "done" } : t);
        return nextOcc ? [nextOcc, ...mapped] : mapped;
      });
    }
  }, [tasks]);

  const handleRollupConfirm = useCallback((heading) => {
    if (!pendingRollup) return;
    const { taskId, notes, parentId } = pendingRollup;
    // heading is the (possibly edited) label line from NoteRollupPrompt
    const stamp = `${heading}\n${notes}`;
    setTasks(prev => prev.map(t => {
      if (t.id !== parentId) return t;
      const existing = t.notes ? t.notes.trim() : "";
      return { ...t, notes: existing ? `${existing}\n\n---\n${stamp}` : stamp };
    }));
    setPendingRollup(null);
    finishComplete(taskId);
  }, [pendingRollup, finishComplete]);

  const handleRollupSkip = useCallback(() => {
    if (!pendingRollup) return;
    const { taskId } = pendingRollup;
    setPendingRollup(null);
    finishComplete(taskId);
  }, [pendingRollup, finishComplete]);

  const handleDeferCheckSkip = useCallback(() => {
    if (!pendingDeferCheck) return;
    const { taskId } = pendingDeferCheck;
    setPendingDeferCheck(null);
    completeTask(taskId, { skipDeferCheck: true });
  }, [pendingDeferCheck, completeTask]);

  const handleDeferCheckReview = useCallback(() => {
    setPendingDeferCheck(null);
  }, []);

  const handleActualEffortSave = useCallback((actualEffort) => {
    if (!actualEffortPrompt) return;
    const task = tasks.find(t => t.id === actualEffortPrompt.taskId);
    const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
    setTasks(prev => {
      const mapped = prev.map(t =>
        t.id === actualEffortPrompt.taskId
          ? { ...t, done: true, bucket: "done", actualEffort }
          : t
      );
      return nextOcc ? [nextOcc, ...mapped] : mapped;
    });
    setActualEffortPrompt(null);
  }, [actualEffortPrompt, tasks]);

  const handleActualEffortSkip = useCallback(() => {
    if (!actualEffortPrompt) return;
    const task = tasks.find(t => t.id === actualEffortPrompt.taskId);
    const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
    setTasks(prev => {
      const mapped = prev.map(t =>
        t.id === actualEffortPrompt.taskId
          ? { ...t, done: true, bucket: "done" }
          : t
      );
      return nextOcc ? [nextOcc, ...mapped] : mapped;
    });
    setActualEffortPrompt(null);
  }, [actualEffortPrompt, tasks]);
  // Toggle collapse for a single node (subtask level: hides its children).
  const toggleCollapse = useCallback((id) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Toggle collapse for an array of child IDs (project level: fold/unfold to next level).
  // If all children are already collapsed, expands them; otherwise collapses all.
  const toggleCollapseLevel = useCallback((childIds) => {
    setCollapsedNodes(prev => {
      const allCollapsed = childIds.length > 0 && childIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allCollapsed) {
        childIds.forEach(id => next.delete(id));
      } else {
        childIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  // Move a task to a different project, or make it standalone (newProjectId === null).
  // Handles: removing from old parent's childIds, adding to new parent's childIds,
  // and guards against circular references (can't assign a task to one of its own descendants).
  const reassignProject = useCallback((taskId, newProjectId) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const oldProjectId = task.parentId || null;
      if (oldProjectId === newProjectId) return prev; // no-op

      // Guard: prevent circular reference — don't allow assigning to a descendant.
      if (newProjectId) {
        function isDescendant(ancestorId, nodeId, seen = new Set()) {
          if (seen.has(nodeId) || !nodeId) return false;
          seen.add(nodeId);
          const node = prev.find(t => t.id === nodeId);
          if (!node) return false;
          return (node.childIds || []).some(cid => cid === ancestorId || isDescendant(ancestorId, cid, seen));
        }
        if (isDescendant(taskId, newProjectId)) return prev;
      }

      return prev.map(t => {
        // Update the task itself
        if (t.id === taskId) return { ...t, parentId: newProjectId || null };
        // Remove from old parent's childIds
        if (oldProjectId && t.id === oldProjectId) {
          return { ...t, childIds: (t.childIds || []).filter(id => id !== taskId) };
        }
        // Add to new parent's childIds (avoid duplicates)
        if (newProjectId && t.id === newProjectId) {
          const existing = t.childIds || [];
          return existing.includes(taskId) ? t : { ...t, childIds: [...existing, taskId] };
        }
        return t;
      });
    });
  }, []);

  // Assign a Next Action (no parentId) to an existing or new project
  const assignToProject = useCallback((taskId, projectId, newProjectName) => {
    if (newProjectName) {
      const newProjId = genId();
      setTasks(prev => [
        ...prev.map(t => t.id === taskId ? { ...t, parentId: newProjId } : t),
        { id: newProjId, text: newProjectName.trim(), bucket: "project", done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [taskId] },
      ]);
    } else if (projectId) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId)   return { ...t, parentId: projectId };
        if (t.id === projectId) return { ...t, childIds: [...(t.childIds || []), taskId] };
        return t;
      }));
    }
  }, []);

  const addLocation = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLocations(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  }, []);

  const renameLocation = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setLocations(prev => prev.map(l => l === oldName ? trimmed : l));
    setTasks(prev => prev.map(t => ({
      ...t,
      location: (t.location || []).map(l => l === oldName ? trimmed : l),
    })));
  }, []);

  const handleProjectDragStart = useCallback((id) => {
    setDragId(id);
    setDropTarget(null);
  }, []);

  const handleProjectDragOver = useCallback((e, taskId) => {
    if (taskId === dragId) return;                          // don't target self
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const position = ratio < 0.33 ? "before" : ratio > 0.67 ? "after" : "inside";
    setDropTarget(prev =>
      prev?.id === taskId && prev?.position === position ? prev : { id: taskId, position }
    );
  }, [dragId]);

  const handleProjectDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);

  const handleProjectDrop = useCallback((targetId) => {
    setDropTarget(prev => {
      if (prev && dragId) {
        setTasks(all => moveTaskInTree(all, dragId, targetId, prev.position));
      }
      return null;
    });
    setDragId(null);
  }, [dragId]);

  const removeLocation = useCallback((name, replaceName) => {
    setLocations(prev => prev.filter(l => l !== name));
    setTasks(prev => prev.map(t => {
      const loc = t.location || [];
      if (!loc.includes(name)) return t;
      const next = loc.filter(l => l !== name);
      if (replaceName && !next.includes(replaceName)) next.push(replaceName);
      return { ...t, location: next };
    }));
  }, []);

  const addEffort = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEfforts(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed].sort((a, b) => effortToMinutes(a) - effortToMinutes(b));
    });
  }, []);

  const renameEffort = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setEfforts(prev => prev.map(e => e === oldName ? trimmed : e));
    setTasks(prev => prev.map(t => ({
      ...t,
      effort:       t.effort       === oldName ? trimmed : t.effort,
      actualEffort: t.actualEffort === oldName ? trimmed : t.actualEffort,
    })));
  }, []);

  const removeEffort = useCallback((name) => {
    setEfforts(prev => prev.filter(e => e !== name));
    setTasks(prev => prev.map(t => ({
      ...t,
      effort:       t.effort       === name ? null : t.effort,
      actualEffort: t.actualEffort === name ? null : t.actualEffort,
    })));
  }, []);

  const setCalibrationOverride = useCallback((label, overrideLabel) => {
    setCalibrationOverrides(prev => ({ ...prev, [label]: overrideLabel || null }));
  }, []);

  const clearCalibrationOverride = useCallback((label) => {
    setCalibrationOverrides(prev => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const data = { version: 1, exportedAt: new Date().toISOString(), tasks, locations, efforts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gtd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tasks, locations, efforts]);

  const handleImport = useCallback((data, mode = "replace") => {
    if (!data || !Array.isArray(data.tasks)) {
      alert("Invalid backup file — expected a tasks array.");
      return;
    }
    if (mode === "replace") {
      if (!window.confirm(`Replace all ${tasks.length} current tasks with ${data.tasks.length} imported tasks?`)) return;
      setTasks(data.tasks);
      if (Array.isArray(data.locations)) setLocations(data.locations);
      if (Array.isArray(data.efforts)) setEfforts(data.efforts);
    } else {
      const existingIds = new Set(tasks.map(t => t.id));
      const incoming = data.tasks.filter(t => !existingIds.has(t.id));
      if (!incoming.length) {
        alert("Nothing to merge — all tasks in this backup already exist.");
        return;
      }
      setTasks(prev => [...incoming, ...prev]);
      if (Array.isArray(data.locations))
        setLocations(prev => [...new Set([...prev, ...data.locations])]);
      if (Array.isArray(data.efforts))
        setEfforts(prev => { const s = new Set(prev); return [...prev, ...data.efforts.filter(e => !s.has(e))]; });
      alert(`Merged ${incoming.length} new task${incoming.length !== 1 ? "s" : ""}.`);
    }
  }, [tasks]);

  // "deferred" is a virtual view — tasks keep their original bucket, filtered by deferUntil > today.
  const bucketTasks = currentBucket === "deferred"
    ? tasks.filter(t => isDeferred(t) && !t.done).sort((a, b) => (a.deferUntil > b.deferUntil ? 1 : -1))
    : tasks.filter(t => t.bucket === currentBucket);
  const counts = Object.fromEntries(Object.keys(BUCKETS).map(k =>
    k === "deferred"
      ? [k, tasks.filter(t => isDeferred(t) && !t.done).length]
      : [k, tasks.filter(t => t.bucket === k).length]
  ));

  // Fuzzy dupe check: warn if what the user is typing resembles a deferred task.
  const deferredDupeWarning = (() => {
    const text = addText.toLowerCase().trim();
    if (text.length < 4) return null;
    const words = text.split(/\s+/).filter(w => w.length > 3);
    if (!words.length) return null;
    return tasks.find(t => isDeferred(t) && !t.done && words.some(w => t.text.toLowerCase().includes(w))) || null;
  })();

  const s = {
    app: { display: "flex", height: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif", fontSize: 14, overflow: "hidden" },
    sidebar: { width: sidebarWidth, background: COLORS.surface, display: "flex", flexDirection: "column", flexShrink: 0 },
    sidebarHeader: { padding: "18px 16px 14px", borderBottom: `1px solid ${COLORS.border}` },
    logo: { fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 300, color: COLORS.text },
    logoEm: { fontStyle: "italic", color: COLORS.inbox },
    sidebarSub: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
    bucketList: { flex: 1, padding: "8px 0", overflowY: "auto" },
    sidebarActions: { padding: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", gap: 6 },
    main: { flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" },
    mainLeft: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    taskRow: { flex: 1, display: "flex", overflow: "hidden" },
    taskPanel: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    detailPanel: { width: detailWidth, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" },
    panelHeader: { padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10 },
    addRow: { display: "flex", gap: 6, padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}` },
    taskList: { flex: 1, overflowY: "auto", padding: "4px 0" },
    coachPanel: { height: coachHeight, display: "flex", flexDirection: "column", flexShrink: 0 },
    coachHeader: { padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
    chatMessages: { flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 },
    chatInputRow: { display: "flex", gap: 6, padding: "8px 12px", borderTop: `1px solid ${COLORS.border}`, flexShrink: 0, alignItems: "flex-end" },
  };

  // ── Auth gate ────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
                  background: COLORS.bg, color: COLORS.muted,
                  fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif" }}>
      Loading…
    </div>
  );

  if (!authUser) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
                  background: COLORS.bg, fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif" }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                    padding: "36px 40px", width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>
          GTD <em style={{ fontStyle: "italic", color: COLORS.next }}>Manager</em>
        </div>
        <div style={{ fontSize: 13, color: COLORS.text2 }}>Sign in with a magic link — no password needed.</div>
        {authSent ? (
          <div style={{ fontSize: 13, color: COLORS.next, padding: "10px 14px",
                        background: COLORS.nextBg, borderRadius: 8 }}>
            Check your email for a login link.
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMagicLink(); }}
              autoFocus
              style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${COLORS.border}`,
                       background: COLORS.surface2, color: COLORS.text,
                       fontFamily: "inherit", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={sendMagicLink}
              style={{ padding: "9px 0", borderRadius: 7, border: "none", background: COLORS.next,
                       color: "#111", fontFamily: "inherit", fontSize: 13,
                       fontWeight: 600, cursor: "pointer" }}
            >Send login link</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={s.app} onClick={() => setMoveMenu(null)}>
      {/* SIDEBAR */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={s.logo}>GTD <em style={s.logoEm}>Manager</em></div>
            {supabaseReady && (
              <div title={syncStatus === 'synced' ? 'Synced to cloud' : 'Offline — changes queued'}
                   style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                               background: syncStatus === 'synced' ? COLORS.next : COLORS.waiting }} />
                <span style={{ fontSize: 10, color: syncStatus === 'synced' ? COLORS.next : COLORS.waiting }}>
                  {syncStatus === 'synced' ? 'synced' : 'offline'}
                </span>
              </div>
            )}
          </div>
          <div style={s.sidebarSub}>Knowledge Worker Edition</div>
        </div>

        <div style={s.bucketList}>
          {Object.entries(BUCKETS).map(([key, cfg]) => (
            <BucketItem key={key} bkey={key} cfg={cfg} count={counts[key]} active={currentBucket === key} onClick={() => setCurrentBucket(key)} />
          ))}
        </div>

        <div style={s.sidebarActions}>
          <SidebarBtn primary onClick={startProcessInbox}>🤖 Process Inbox with AI</SidebarBtn>
          <SidebarBtn onClick={startWeeklyReview}>📋 Weekly Review</SidebarBtn>
          <SidebarBtn onClick={startBrainDump}>🧠 Brain Dump</SidebarBtn>
        </div>

        <div style={{ padding: "8px 10px", borderTop: `1px solid ${COLORS.border}` }}>
          <SidebarBtn onClick={() => setShowSettings(v => !v)}>⚙ Settings</SidebarBtn>
        </div>
      </div>
      <ResizeHandle onMouseDown={sidebarDragDown} direction="h" />

      {/* MAIN */}
      <div style={s.main}>
        {/* LEFT COLUMN: task panel + coach panel */}
        <div style={s.mainLeft}>
        {/* TASK ROW */}
        <div style={s.taskRow}>
        {/* TASK PANEL */}
        <div style={s.taskPanel}>
          {showSettings ? (
            <SettingsPanel
              locations={locations}
              tasks={tasks}
              onAdd={addLocation}
              onRename={renameLocation}
              onRemove={removeLocation}
              efforts={efforts}
              onAddEffort={addEffort}
              onRenameEffort={renameEffort}
              onRemoveEffort={removeEffort}
              calibrationOverrides={calibrationOverrides}
              onSetCalibrationOverride={setCalibrationOverride}
              onClearCalibrationOverride={clearCalibrationOverride}
              tagDisplay={tagDisplay}
              onSetTagDisplay={setTagDisplay}
              onExport={handleExport}
              onImport={handleImport}
              onClose={() => setShowSettings(false)}
            />
          ) : (
            <>
              <div style={s.panelHeader}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>{BUCKETS[currentBucket].label}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{BUCKETS[currentBucket].desc}</div>
                </div>
                {currentBucket === "project" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        // Projects only: add every root project's own ID so its children are hidden.
                        const next = new Set();
                        tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done)
                          .forEach(p => next.add(p.id));
                        setCollapsedNodes(next);
                      }}
                      title="Show project names only"
                      style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                    >
                      ≡ Projects Only
                    </button>
                    <button
                      onClick={() => {
                        // Collapse all root projects to "next level" view: collapse every direct child.
                        const next = new Set();
                        tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done)
                          .forEach(p => (p.childIds || []).forEach(cid => next.add(cid)));
                        setCollapsedNodes(next);
                      }}
                      title="Collapse all projects to top-level tasks"
                      style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                    >
                      ⊖ Collapse All
                    </button>
                    <button
                      onClick={() => setCollapsedNodes(new Set())}
                      title="Expand all projects fully"
                      style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
                    >
                      ⊕ Expand All
                    </button>
                    <button
                      onClick={startProjectReview}
                      disabled={loading}
                      style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${COLORS.project}55`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      🔍 Review Projects
                    </button>
                  </div>
                )}
                {currentBucket === "next" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: COLORS.muted, marginRight: 2 }}>Group:</span>
                    {[
                      { key: "none",     label: "None" },
                      { key: "project",  label: "Project" },
                      { key: "location", label: "Location" },
                      { key: "dueDate",  label: "Due Date" },
                      { key: "priority", label: "Priority" },
                      { key: "effort",   label: "Effort" },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setNextGroupBy(opt.key)}
                        style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${nextGroupBy === opt.key ? COLORS.border2 : COLORS.border}`, background: nextGroupBy === opt.key ? COLORS.surface3 : "transparent", color: nextGroupBy === opt.key ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {currentBucket === "deferred" ? null : currentBucket === "project" ? (() => {
                const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
                const selectedProject = rootProjects.find(t => t.id === projectParentId);
                const placeholder = projectParentId === "__new__"
                  ? "New project name… (Enter to add)"
                  : `Subtask for "${selectedProject?.text ?? ""}"…`;
                return (
                  <div style={s.addRow}>
                    <input
                      value={addText}
                      onChange={e => setAddText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addProjectTask()}
                      placeholder={placeholder}
                      style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
                    />
                    <select
                      value={projectParentId}
                      onChange={e => setProjectParentId(e.target.value)}
                      style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 10px", fontFamily: "inherit", fontSize: 12, color: projectParentId === "__new__" ? COLORS.text2 : COLORS.project, outline: "none", cursor: "pointer", maxWidth: 180, colorScheme: "dark" }}
                    >
                      <option value="__new__">+ New project</option>
                      {rootProjects.map(p => (
                        <option key={p.id} value={p.id}>{p.text.length > 30 ? p.text.slice(0, 28) + "…" : p.text}</option>
                      ))}
                    </select>
                    <Btn onClick={addProjectTask} style={{ fontSize: 12, borderColor: projectParentId === "__new__" ? COLORS.border : COLORS.project, color: projectParentId === "__new__" ? COLORS.text2 : COLORS.project }}>
                      {projectParentId === "__new__" ? "+ Add Project" : "+ Add Task"}
                    </Btn>
                  </div>
                );
              })() : (
                <>
                  <div style={s.addRow}>
                    <input
                      value={addText}
                      onChange={e => setAddText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addTask()}
                      placeholder="Add a task… (Enter to add)"
                      style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
                    />
                    <Btn onClick={() => addTask()} style={{ fontSize: 12 }}>+ Add</Btn>
                    <Btn onClick={addAndProcess} style={{ fontSize: 12, borderColor: COLORS.inbox, color: COLORS.inbox }}>+ Add & Ask AI</Btn>
                  </div>
                  {deferredDupeWarning && (
                    <div style={{ padding: "3px 16px 6px", fontSize: 11, color: COLORS.deferred, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⏰</span>
                      <span>Similar deferred task: <strong>"{deferredDupeWarning.text}"</strong> (wakes {deferredDupeWarning.deferUntil})</span>
                      <button onClick={() => setCurrentBucket("deferred")} style={{ background: "none", border: "none", color: COLORS.deferred, cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: "0 2px", textDecoration: "underline" }}>View it</button>
                    </div>
                  )}
                </>
              )}

              <div style={s.taskList}>
                {bucketTasks.length === 0 ? (
                  <EmptyState bucket={currentBucket} />
                ) : currentBucket === "project" ? (
                  <div
                    onDragLeave={e => {
                      if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null);
                    }}
                  >
                    <ProjectTree
                      parentId={null}
                      depth={0}
                      allTasks={tasks}
                      dragId={dragId}
                      dropTarget={dropTarget}
                      onDragStart={handleProjectDragStart}
                      onDragOver={handleProjectDragOver}
                      onDragEnd={handleProjectDragEnd}
                      onDrop={handleProjectDrop}
                      rowProps={{
                        currentBucket,
                        moveMenu, setMoveMenu,
                        onComplete: completeTask,
                        onDelete: deleteTask,
                        onMove: moveTask,
                        onAskAI: askAIAboutTask,
                        onUpdateTask: updateTask,
                        pendingAction,
                        allTasks: tasks,
                        onNavigate: setCurrentBucket,
                        locations,
                        efforts,
                        onAssignToProject: assignToProject,
                        tagDisplay,
                        collapsedNodes,
                        onToggleCollapse: toggleCollapse,
                        onToggleCollapseLevel: toggleCollapseLevel,
                        onOpenDetail: setSelectedTaskId,
                        selectedTaskId,
                        onSkipRecurrence: skipRecurrence,
                      }}
                    />
                  </div>
                ) : currentBucket === "next" ? (() => {
                  // Deferred tasks are hidden from Next Actions; they live in the Deferred view.
                  const visible = waterfallFilter(bucketTasks, tasks).filter(t => !isDeferred(t));
                  if (!visible.length) {
                    return (
                      <div style={{ padding: "28px 24px", textAlign: "center", color: COLORS.muted, fontSize: 12 }}>
                        <div style={{ fontSize: 22, opacity: 0.3, marginBottom: 8 }}>○</div>
                        <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>All actions are waiting</strong>
                        Complete parent tasks to unlock the next step.
                      </div>
                    );
                  }
                  if (nextGroupBy === "none") {
                    return visible.map(task => (
                      <TaskRow key={task.id} task={task} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                        onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                        pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} locations={locations} efforts={efforts}
                        onAssignToProject={assignToProject} tagDisplay={tagDisplay} onOpenDetail={setSelectedTaskId} selectedTaskId={selectedTaskId} onSkipRecurrence={skipRecurrence} />
                    ));
                  }
                  return groupByField(visible, nextGroupBy, tasks).map(({ key, label, items }) => {
                    const groupMin = items.reduce((sum, t) => sum + effortToMinutes(t.effort), 0);
                    // Always show the effort chip for every group — use "0m" when no tasks have effort set.
                    const groupEffortLabel = minutesToEffortLabel(groupMin) || "0m";
                    return (
                      <div key={key}>
                        <GroupDivider label={label} count={items.length} effortTotal={groupEffortLabel} isUngrouped={key === "__ungrouped__"} />
                        {items.map(task => (
                          <TaskRow key={task.id} task={task} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                            onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                            pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} locations={locations} efforts={efforts}
                            onAssignToProject={assignToProject} tagDisplay={tagDisplay} onOpenDetail={setSelectedTaskId} selectedTaskId={selectedTaskId} onSkipRecurrence={skipRecurrence} />
                        ))}
                      </div>
                    );
                  });
                })() : currentBucket === "deferred" ? (
                  bucketTasks.length === 0 ? (
                    <EmptyState bucket="deferred" />
                  ) : (
                    <div>
                      <div style={{ padding: "6px 18px 4px", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 2 }}>
                        Sorted by wake date — earliest first. Tasks move to Inbox automatically when their date arrives.
                      </div>
                      {bucketTasks.map(task => (
                        <TaskRow key={task.id} task={task} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                          onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                          pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} locations={locations} efforts={efforts}
                          onAssignToProject={assignToProject} tagDisplay={tagDisplay} onOpenDetail={setSelectedTaskId} selectedTaskId={selectedTaskId} onSkipRecurrence={skipRecurrence} />
                      ))}
                    </div>
                  )
                ) : (
                  <>
                    {currentBucket === "done" && (() => {
                      const withBoth = bucketTasks.filter(t => t.effort && t.actualEffort);
                      if (!withBoth.length) return null;
                      const byLabel = {};
                      withBoth.forEach(t => {
                        if (!byLabel[t.effort]) byLabel[t.effort] = { totalActual: 0, count: 0 };
                        byLabel[t.effort].totalActual += effortToMinutes(t.actualEffort);
                        byLabel[t.effort].count += 1;
                      });
                      const entries = Object.entries(byLabel);
                      return (
                        <div style={{ padding: "6px 18px 6px", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                          <span style={{ color: COLORS.text2, fontWeight: 600 }}>⏱ Accuracy:</span>
                          {entries.map(([label, { totalActual, count }]) => {
                            const avgActual = totalActual / count;
                            const estMin = effortToMinutes(label);
                            const color = effortAccuracyColor(estMin, avgActual);
                            const pct = estMin ? Math.round(((avgActual - estMin) / estMin) * 100) : null;
                            const pctStr = pct === null ? "" : pct > 0 ? ` +${pct}%` : ` ${pct}%`;
                            return (
                              <span key={label} style={{ padding: "1px 7px", borderRadius: 10, background: COLORS.effortBg, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
                                {label} → avg {minutesToEffortLabel(Math.round(avgActual))}{pctStr} <span style={{ opacity: 0.6 }}>({count})</span>
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                    {currentBucket === "done" ? (
                      <CompletedTree
                        parentId={null}
                        depth={0}
                        allTasks={tasks}
                        rowProps={{
                          currentBucket,
                          moveMenu, setMoveMenu,
                          onComplete: completeTask,
                          onDelete: deleteTask,
                          onMove: moveTask,
                          onAskAI: askAIAboutTask,
                          onUpdateTask: updateTask,
                          pendingAction,
                          allTasks: tasks,
                          onNavigate: setCurrentBucket,
                          locations,
                          efforts,
                          onAssignToProject: assignToProject,
                          tagDisplay,
                          collapsedNodes,
                          onToggleCollapse: toggleCollapse,
                          onToggleCollapseLevel: toggleCollapseLevel,
                          onOpenDetail: setSelectedTaskId,
                          selectedTaskId,
                          onSkipRecurrence: skipRecurrence,
                        }}
                      />
                    ) : (
                      bucketTasks.map(task => (
                        <TaskRow key={task.id} task={task} currentBucket={currentBucket} moveMenu={moveMenu} setMoveMenu={setMoveMenu}
                          onComplete={completeTask} onDelete={deleteTask} onMove={moveTask} onAskAI={askAIAboutTask} onUpdateTask={updateTask}
                          pendingAction={pendingAction} allTasks={tasks} onNavigate={setCurrentBucket} locations={locations} efforts={efforts}
                          onAssignToProject={assignToProject} tagDisplay={tagDisplay} onOpenDetail={setSelectedTaskId} selectedTaskId={selectedTaskId} onSkipRecurrence={skipRecurrence} />
                      ))
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        </div>{/* end taskRow */}
        <ResizeHandle onMouseDown={coachDragDown} direction="v" />

        {/* COACH PANEL */}
        <div style={s.coachPanel}>
          <div style={s.coachHeader}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase" }}>🤖 AI Coach</span>
          <ProviderSelector
            provider={provider} setProvider={setProvider}
            localModel={localModel} setLocalModel={setLocalModel}
            availableModels={availableModels} fetchModels={fetchModels}
          />
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(COACH_MODES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => {
                    if (key === "process") startProcessInbox();
                    else if (key === "review") startWeeklyReview();
                    else if (key === "dump") startBrainDump();
                    else if (key === "projectReview") startProjectReview();  // mode picked in ReviewModeBar
                    else switchCoachMode("chat", "I can see your task list. Ask me anything — clarify a task, plan your day, or check in on your system.");
                  }}
                  style={{ padding: "3px 9px", borderRadius: 6, border: `1px solid ${coachMode === key ? COLORS.border2 : COLORS.border}`, background: coachMode === key ? COLORS.surface3 : "transparent", color: coachMode === key ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div style={s.chatMessages}>
            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            {pendingAction && (
              <PendingActionBar
                action={pendingAction}
                onConfirm={handleConfirmMove}
                onDismiss={() => setPendingAction(null)}
              />
            )}
            {coachMode === "projectReview" && reviewMode === null && !loading && (
              <ReviewModeBar onSelect={selectReviewMode} />
            )}
            {coachMode === "projectReview" && reviewMode === "tasks" && reviewReady && (
              <ProjectReviewBar
                suggestions={reviewSuggestions}
                onToggle={idx => setReviewSuggestions(prev =>
                  prev.map((s, i) => i === idx ? { ...s, checked: !s.checked } : s)
                )}
                onNext={advanceProjectReview}
                projectIdx={reviewProjectIdx}
                totalProjects={tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done).length}
              />
            )}
            {coachMode === "projectReview" && reviewMode === "metadata" && reviewReady && (
              <MetadataReviewBar
                suggestions={metadataSuggestions}
                onToggleAccepted={idx => setMetadataSuggestions(prev =>
                  prev.map((s, i) => i === idx ? { ...s, accepted: !s.accepted } : s)
                )}
                onChangeOverride={(idx, field, value) => setMetadataSuggestions(prev =>
                  prev.map((s, i) => i === idx ? { ...s, overrides: { ...s.overrides, [field]: value } } : s)
                )}
                onNext={advanceMetadataReview}
                projectIdx={reviewProjectIdx}
                totalProjects={tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done).length}
              />
            )}
            <div ref={chatEndRef} />
          </div>

          <ResizeHandle onMouseDown={chatInputDragDown} direction="v" />
          <div style={s.chatInputRow}>
            <textarea
              ref={chatInputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="Ask the coach anything…"
              style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none", resize: "none", height: chatInputHeight, minHeight: 36 }}
            />
            <button
              onClick={sendChat}
              disabled={loading}
              style={{ width: 34, height: 34, background: loading ? COLORS.surface3 : COLORS.inbox, color: "#111", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >↑</button>
          </div>
        </div>{/* end coachPanel */}
        </div>{/* end mainLeft */}

        {/* TASK DETAIL PANEL — full height alongside both task list and coach */}
        {selectedTaskId && (() => {
          const selTask = tasks.find(t => t.id === selectedTaskId);
          return selTask ? (
            <>
              <ResizeHandle onMouseDown={detailDragDown} direction="h" />
              <TaskDetailPanel
                task={selTask}
                allTasks={tasks}
                locations={locations}
                efforts={efforts}
                onUpdate={updateTask}
                onComplete={(id) => { completeTask(id); setSelectedTaskId(null); }}
                onDelete={(id) => { setTasks(prev => prev.filter(t => t.id !== id)); setSelectedTaskId(null); }}
                onReassignProject={reassignProject}
                onSkipRecurrence={(id) => { skipRecurrence(id); setSelectedTaskId(null); }}
                onClose={() => setSelectedTaskId(null)}
                style={s.detailPanel}
              />
            </>
          ) : null;
        })()}
      </div>{/* end main */}

      {/* Note roll-up prompt — shown when completing a subtask that has notes */}
      {pendingRollup && (
        <NoteRollupPrompt
          taskText={pendingRollup.taskText}
          notes={pendingRollup.notes}
          parentText={pendingRollup.parentText}
          onConfirm={handleRollupConfirm}
          onSkip={handleRollupSkip}
        />
      )}

      {/* Deferred child check — shown when completing a task with deferred or someday subtasks */}
      {pendingDeferCheck && (
        <DeferCheckPrompt
          taskText={pendingDeferCheck.taskText}
          deferredChildren={pendingDeferCheck.deferredChildren}
          onSkip={handleDeferCheckSkip}
          onReview={handleDeferCheckReview}
        />
      )}

      {/* Actual effort prompt — modal overlay shown when completing a task with an estimate */}
      {actualEffortPrompt && (
        <ActualEffortPrompt
          taskText={actualEffortPrompt.taskText}
          estimatedEffort={actualEffortPrompt.estimatedEffort}
          efforts={efforts}
          onSave={handleActualEffortSave}
          onSkip={handleActualEffortSkip}
        />
      )}
    </div>
  );
}

function BucketItem({ bkey, cfg, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: active ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${active ? cfg.color : "transparent"}`, transition: "background 0.1s" }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: active ? COLORS.text : COLORS.text2 }}>{cfg.label}</span>
      <span style={{ fontSize: 11, background: COLORS.surface3, color: COLORS.muted, padding: "1px 7px", borderRadius: 10, minWidth: 22, textAlign: "center" }}>{count}</span>
    </div>
  );
}

function SidebarBtn({ children, onClick, primary }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 11px", borderRadius: 7, border: `1px solid ${primary ? COLORS.inbox : COLORS.border}`, background: primary ? (hover ? "#f0d060" : COLORS.inbox) : (hover ? COLORS.surface2 : "transparent"), color: primary ? "#111" : (hover ? COLORS.text : COLORS.text2), fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, fontWeight: primary ? 600 : 400, transition: "all 0.12s" }}
    >
      {children}
    </button>
  );
}

function Btn({ children, onClick, style = {} }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: hover ? COLORS.surface3 : COLORS.surface2, color: COLORS.text2, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", ...style }}
    >
      {children}
    </button>
  );
}

const PRIORITIES = ["Imperative", "As Possible", "Financial", "External"];

function TaskRow({ task, currentBucket, moveMenu, setMoveMenu, onComplete, onDelete, onMove, onAskAI, onUpdateTask, pendingAction, allTasks, onNavigate, isSubtask, locations, efforts, onAssignToProject, tagDisplay, indentOverride, depth = 0, collapsedNodes, onToggleCollapse, onToggleCollapseLevel, onOpenDetail, selectedTaskId, onSkipRecurrence }) {
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState("__new__");
  const [newProjName, setNewProjName] = useState("");
  const [editTitle, setEditTitle] = useState(task.text);
  // Keep draft in sync if the task text is changed externally
  useEffect(() => { setEditTitle(task.text); }, [task.text]);
  const highlight = pendingAction && task.bucket === "inbox";
  const parentProject = task.parentId ? (allTasks || []).find(t => t.id === task.parentId) : null;
  const indent = indentOverride !== undefined ? indentOverride : (isSubtask ? 28 : 0);

  const taskPriority = task.priority || [];
  const taskLocation = task.location || [];
  const taskDueDate  = task.dueDate  || "";
  const taskEffort   = task.effort   || null;
  const deferred     = isDeferred(task);

  // Collapse toggle — only relevant in the project view for tasks that have children.
  const childIds = task.childIds || [];
  const hasChildren = currentBucket === "project" && childIds.length > 0;
  // Root projects (depth=0): collapsed when the project's own ID is in collapsedNodes
  // ("projects only" mode) OR when all direct children are collapsed ("next level" mode).
  // Subtasks (depth>0): collapsed when the task's own ID is in collapsedNodes.
  const isCollapsed = hasChildren && (
    depth === 0
      ? !!(collapsedNodes?.has(task.id)) || childIds.every(cid => collapsedNodes?.has(cid))
      : !!(collapsedNodes?.has(task.id))
  );
  const handleCollapseToggle = (e) => {
    e.stopPropagation();
    if (!hasChildren) return;
    if (depth === 0) {
      if (collapsedNodes?.has(task.id)) {
        // "Projects only" state — clicking expands fully (removes the project's own ID).
        onToggleCollapse?.(task.id);
      } else {
        // Expanded or "next level" state — toggle direct children.
        onToggleCollapseLevel?.(childIds);
      }
    } else {
      onToggleCollapse?.(task.id);
    }
  };

  // Computed effort total for project-bucket rows (recursive sum across all descendants).
  const projectEffortTotal = (() => {
    if (task.bucket !== "project" || currentBucket !== "project") return null;
    if (!(task.childIds || []).length) return null;
    const totalMin = (task.childIds || []).reduce(
      (sum, cid) => sum + sumDescendantEffort(cid, allTasks || []), 0
    );
    return minutesToEffortLabel(totalMin);
  })();

  // Descendant task counts — shown as "incomplete / total" badge on rows with children.
  const descendantCounts = hasChildren
    ? (task.childIds || []).reduce(
        (acc, cid) => {
          const c = countDescendants(cid, allTasks || []);
          return { total: acc.total + c.total, incomplete: acc.incomplete + c.incomplete };
        },
        { total: 0, incomplete: 0 }
      )
    : null;

  const togglePriority = (p) => {
    const next = taskPriority.includes(p) ? taskPriority.filter(x => x !== p) : [...taskPriority, p];
    onUpdateTask(task.id, { priority: next });
  };

  const toggleLocation = (loc) => {
    const next = taskLocation.includes(loc) ? taskLocation.filter(x => x !== loc) : [...taskLocation, loc];
    onUpdateTask(task.id, { location: next });
  };

  const toggleEffort = (e) => {
    onUpdateTask(task.id, { effort: taskEffort === e ? null : e });
  };

  const saveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.text) {
      onUpdateTask(task.id, { text: trimmed });
    } else {
      setEditTitle(task.text); // revert empties / whitespace-only
    }
  };

  const rootProjects = (allTasks || []).filter(t => t.bucket === "project" && !t.parentId && !t.done);

  const handleAssign = () => {
    if (assignTarget === "__new__") {
      if (!newProjName.trim()) return;
      onAssignToProject && onAssignToProject(task.id, null, newProjName.trim());
    } else {
      onAssignToProject && onAssignToProject(task.id, assignTarget, null);
    }
    setShowAssign(false);
    setNewProjName("");
    setAssignTarget("__new__");
  };

  const hasMetadata = taskPriority.length > 0 || taskLocation.length > 0 || taskDueDate || !!taskEffort || !!task.deferUntil;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderLeft: `3px solid ${highlight ? COLORS.inbox : isSubtask ? COLORS.project + "55" : "transparent"}`, opacity: task.done ? 0.4 : (deferred && currentBucket === "project") ? 0.55 : 1, transition: "all 0.12s" }}
    >
      {/* Main task row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: `8px 18px 8px ${18 + indent}px`, background: highlight ? COLORS.inboxBg : (selectedTaskId === task.id ? COLORS.surface3 : hover ? COLORS.surface2 : "transparent") }}>
        {isSubtask && <span style={{ color: COLORS.project, fontSize: 10, marginTop: 3, flexShrink: 0 }}>↳</span>}
        {currentBucket === "project" && (
          <span style={{ color: COLORS.muted, fontSize: 12, marginTop: 1, flexShrink: 0, cursor: "grab", userSelect: "none", opacity: hover ? 0.6 : 0, transition: "opacity 0.1s", lineHeight: 1 }}>⠿</span>
        )}
        {/* Collapse / expand toggle — shown only for tasks with children in the project view */}
        {hasChildren && (
          <button
            onClick={handleCollapseToggle}
            title={isCollapsed ? "Expand" : "Collapse"}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.project, fontSize: 11, flexShrink: 0, marginTop: 2, lineHeight: 1, opacity: hover ? 1 : 0.45, transition: "opacity 0.1s", width: 14, textAlign: "center" }}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        )}
        {/* Spacer to keep alignment for rows without children */}
        {!hasChildren && currentBucket === "project" && (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <div
          onClick={() => onComplete(task.id)}
          style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${task.done ? COLORS.next : COLORS.border2}`, background: task.done ? COLORS.next : "transparent", flexShrink: 0, marginTop: 2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#111", transition: "all 0.15s" }}
        >
          {task.done ? "✓" : ""}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: COLORS.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span
              onClick={(e) => { e.stopPropagation(); onOpenDetail?.(task.id); }}
              title="Open detail panel"
              style={{ cursor: "pointer" }}
            >{task.text}</span>
            {task.notes && (
              <span title="Has notes" style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>📝</span>
            )}
            {task.recurrence && (
              <span title="Recurring task" style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>↻</span>
            )}
            {descendantCounts && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.surface3, color: COLORS.text2, border: `1px solid ${COLORS.border}`, flexShrink: 0, whiteSpace: "nowrap" }}>
                ↓ {descendantCounts.incomplete} / {descendantCounts.total}
              </span>
            )}
            {projectEffortTotal && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44`, flexShrink: 0 }}>⏱ {projectEffortTotal}</span>
            )}
            {deferred && currentBucket === "project" && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.deferredBg, color: COLORS.deferred, border: `1px solid ${COLORS.deferred}44`, flexShrink: 0 }}>⏰ {task.deferUntil}</span>
            )}
          </div>
          {/* Metadata summary chips — below-text mode */}
          {tagDisplay !== "inline" && !expanded && hasMetadata && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {taskLocation.map(loc => (
                <span key={loc} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.project, border: `1px solid ${COLORS.project}44` }}>{loc}</span>
              ))}
              {taskDueDate && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.waiting, border: `1px solid ${COLORS.waiting}44` }}>📅 {taskDueDate}</span>
              )}
              {taskPriority.map(p => (
                <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.inbox, border: `1px solid ${COLORS.inbox}44` }}>{p}</span>
              ))}
              {taskEffort && task.actualEffort ? (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort)), border: `1px solid ${effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort))}44` }}>⏱ {taskEffort} → {task.actualEffort}</span>
              ) : taskEffort ? (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44` }}>⏱ {taskEffort}</span>
              ) : null}
              {task.deferUntil && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.deferredBg, color: COLORS.deferred, border: `1px solid ${COLORS.deferred}44` }}>⏰ {task.deferUntil}</span>
              )}
            </div>
          )}
          {/* Parent project link for Next Actions */}
          {parentProject && currentBucket === "next" && hover && (
            <div
              onClick={() => onNavigate("project")}
              style={{ marginTop: 3, fontSize: 11, color: COLORS.project, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, opacity: 0.85 }}
              title="Go to project"
            >
              <span>↑</span>
              <span style={{ textDecoration: "underline" }}>{parentProject.text}</span>
            </div>
          )}
        </div>

        {/* Metadata chips — inline mode: sit between text and chevron */}
        {tagDisplay === "inline" && !expanded && hasMetadata && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flexShrink: 0, alignSelf: "center" }}>
            {taskLocation.map(loc => (
              <span key={loc} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.project, border: `1px solid ${COLORS.project}44`, whiteSpace: "nowrap" }}>{loc}</span>
            ))}
            {taskDueDate && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.waiting, border: `1px solid ${COLORS.waiting}44`, whiteSpace: "nowrap" }}>📅 {taskDueDate}</span>
            )}
            {taskPriority.map(p => (
              <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.inbox, border: `1px solid ${COLORS.inbox}44`, whiteSpace: "nowrap" }}>{p}</span>
            ))}
            {taskEffort && task.actualEffort ? (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort)), border: `1px solid ${effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort))}44`, whiteSpace: "nowrap" }}>⏱ {taskEffort} → {task.actualEffort}</span>
            ) : taskEffort ? (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44`, whiteSpace: "nowrap" }}>⏱ {taskEffort}</span>
            ) : null}
            {task.deferUntil && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.deferredBg, color: COLORS.deferred, border: `1px solid ${COLORS.deferred}44`, whiteSpace: "nowrap" }}>⏰ {task.deferUntil}</span>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
          {/* Chevron — always visible if has metadata, else on hover */}
          {(hover || expanded || hasMetadata) && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
              title="Task details"
              style={{ padding: "2px 5px", borderRadius: 5, border: `1px solid ${expanded ? COLORS.border2 : COLORS.border}`, background: expanded ? COLORS.surface3 : "transparent", color: expanded ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", lineHeight: 1, transition: "all 0.1s" }}
            >
              {expanded ? "▾" : "›"}
            </button>
          )}
          {hover && (
            <>
              {currentBucket === "inbox" && (
                <ActionBtn onClick={() => onAskAI(task)} color={COLORS.inbox}>✦ AI</ActionBtn>
              )}
              {currentBucket === "next" && !task.parentId && onAssignToProject && (
                <ActionBtn onClick={() => setShowAssign(x => !x)} color={showAssign ? COLORS.project : undefined}>📁</ActionBtn>
              )}
              {task.recurrence && onSkipRecurrence && (
                <ActionBtn onClick={() => onSkipRecurrence(task.id)} color={COLORS.deferred} title="Skip — advance schedule without completing">↻ Skip</ActionBtn>
              )}
              <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                <ActionBtn onClick={() => setMoveMenu(moveMenu === task.id ? null : task.id)}>Move ▾</ActionBtn>
                {moveMenu === task.id && (
                  <div style={{ position: "absolute", right: 0, top: "100%", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                    {Object.entries(BUCKETS).filter(([k]) => k !== currentBucket && k !== "done" && k !== "inboxHistory").map(([k, cfg]) => (
                      <div
                        key={k}
                        onClick={() => onMove(task.id, k)}
                        style={{ padding: "7px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer", color: COLORS.text2, display: "flex", alignItems: "center", gap: 7 }}
                        onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ color: cfg.color }}>●</span> {cfg.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ActionBtn onClick={() => onDelete(task.id)} color="#d45a5a">✕</ActionBtn>
            </>
          )}
        </div>
      </div>

      {/* Expanded metadata panel */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ margin: `0 18px 8px ${18 + indent + 24}px`, padding: "10px 12px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}
        >
          {/* Title */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Title</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditTitle(task.text);
                }}
                style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${editTitle !== task.text ? COLORS.project : COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none", transition: "border-color 0.1s" }}
              />
              {editTitle !== task.text && (
                <>
                  <button
                    onClick={saveTitle}
                    disabled={!editTitle.trim()}
                    style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: editTitle.trim() ? "pointer" : "not-allowed", opacity: editTitle.trim() ? 1 : 0.4 }}
                  >Save</button>
                  <button
                    onClick={() => setEditTitle(task.text)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                  >✕</button>
                </>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Location</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(locations || []).map(loc => {
                const active = taskLocation.includes(loc);
                return (
                  <button
                    key={loc}
                    onClick={() => toggleLocation(loc)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : "transparent", color: active ? COLORS.project : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Due Date</div>
            <input
              type="date"
              value={taskDueDate}
              onChange={e => onUpdateTask(task.id, { dueDate: e.target.value || null })}
              style={{ background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
            />
            {taskDueDate && (
              <button
                onClick={() => onUpdateTask(task.id, { dueDate: null })}
                style={{ marginLeft: 6, padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
              >✕</button>
            )}
          </div>

          {/* Defer Until */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Defer Until</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={task.deferUntil || ""}
                onChange={e => onUpdateTask(task.id, { deferUntil: e.target.value || null })}
                style={{ background: COLORS.surface3, border: `1px solid ${task.deferUntil ? COLORS.deferred : COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
              />
              {task.deferUntil && (
                <button
                  onClick={() => onUpdateTask(task.id, { deferUntil: null })}
                  style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                >✕ Clear</button>
              )}
            </div>
            {/* Quick-pick offsets — only shown when a due date is also set */}
            {taskDueDate && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: COLORS.muted }}>Before due date:</span>
                {[
                  { label: "1 wk",  months: 0, weeks: 1 },
                  { label: "2 wks", months: 0, weeks: 2 },
                  { label: "1 mo",  months: 1, weeks: 0 },
                  { label: "2 mo",  months: 2, weeks: 0 },
                  { label: "3 mo",  months: 3, weeks: 0 },
                ].map(({ label, months, weeks }) => {
                  const d = subtractFromDate(taskDueDate, { months, weeks });
                  const active = task.deferUntil === d;
                  return (
                    <button
                      key={label}
                      onClick={() => onUpdateTask(task.id, { deferUntil: active ? null : d })}
                      style={{ padding: "2px 8px", borderRadius: 8, border: `1px solid ${active ? COLORS.deferred : COLORS.border}`, background: active ? COLORS.deferred + "22" : "transparent", color: active ? COLORS.deferred : COLORS.text2, fontFamily: "inherit", fontSize: 10, cursor: "pointer", transition: "all 0.1s" }}
                    >{label}</button>
                  );
                })}
              </div>
            )}
            {deferred && (
              <div style={{ marginTop: 5, fontSize: 11, color: COLORS.deferred, opacity: 0.85 }}>
                ⏰ Hidden from active views until {task.deferUntil}
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Priority</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PRIORITIES.map(p => {
                const active = taskPriority.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePriority(p)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.inbox : COLORS.border}`, background: active ? COLORS.inbox + "22" : "transparent", color: active ? COLORS.inbox : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Effort */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Effort</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(efforts || []).map(e => {
                const active = taskEffort === e;
                return (
                  <button
                    key={e}
                    onClick={() => toggleEffort(e)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.effort : COLORS.border}`, background: active ? COLORS.effort + "22" : "transparent", color: active ? COLORS.effort : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Assign to project panel */}
      {showAssign && currentBucket === "next" && !task.parentId && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ margin: `0 18px 8px ${18 + indent + 24}px`, padding: "10px 12px", background: COLORS.surface2, border: `1px solid ${COLORS.project}44`, borderRadius: 8 }}
        >
          <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Assign to Project</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={assignTarget}
              onChange={e => setAssignTarget(e.target.value)}
              style={{ flex: 1, minWidth: 140, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: "5px 8px", color: assignTarget === "__new__" ? COLORS.text2 : COLORS.project, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
            >
              <option value="__new__">+ New project…</option>
              {rootProjects.map(p => (
                <option key={p.id} value={p.id}>{p.text.length > 40 ? p.text.slice(0, 38) + "…" : p.text}</option>
              ))}
            </select>
            {assignTarget === "__new__" && (
              <input
                autoFocus
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAssign(); if (e.key === "Escape") setShowAssign(false); }}
                placeholder="Project name…"
                style={{ flex: 1, minWidth: 120, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
              />
            )}
            <button
              onClick={handleAssign}
              disabled={assignTarget === "__new__" && !newProjName.trim()}
              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: (assignTarget !== "__new__" || newProjName.trim()) ? "pointer" : "not-allowed", opacity: (assignTarget !== "__new__" || newProjName.trim()) ? 1 : 0.4 }}
            >Assign</button>
            <button
              onClick={() => setShowAssign(false)}
              style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, color }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${color ? color + "44" : COLORS.border}`, background: hover ? COLORS.surface3 : COLORS.surface2, color: color || COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
    >
      {children}
    </button>
  );
}

function ChatBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", gap: 7, flexDirection: isUser ? "row-reverse" : "row", maxWidth: "100%" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: isUser ? COLORS.surface3 : COLORS.inbox, color: isUser ? COLORS.text2 : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isUser ? 9 : 11, fontFamily: "Georgia, serif", flexShrink: 0, marginTop: 1 }}>
        {isUser ? "Y" : "G"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: "calc(100% - 70px)" }}>
        <div style={{ padding: "8px 11px", borderRadius: 11, fontSize: 13, lineHeight: 1.55, background: isUser ? COLORS.surface3 : COLORS.surface2, color: isUser ? COLORS.text2 : COLORS.text, borderTopLeftRadius: isUser ? 11 : 3, borderTopRightRadius: isUser ? 3 : 11 }}>
          {formatBubble(msg.text)}
        </div>
        {msg.updateChip && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 20, background: COLORS.surface3, border: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.text2, alignSelf: "flex-start" }}>
            <span>✏️</span>
            <span>Updated <strong style={{ color: COLORS.text }}>{msg.updateChip.taskName}</strong> — {msg.updateChip.fields.join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 7 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS.inbox, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "Georgia, serif", flexShrink: 0 }}>G</div>
      <div style={{ padding: "9px 13px", borderRadius: 11, borderTopLeftRadius: 3, background: COLORS.surface2, display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.muted, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.3} 30%{transform:translateY(-4px);opacity:1} }`}</style>
    </div>
  );
}

function PendingActionBar({ action, onConfirm, onDismiss }) {
  if (!action) return null;
  const { type, title, nextAction } = action;

  const configs = {
    next:    { color: COLORS.next,    label: "Next Actions", confirmText: "Create ✓" },
    project: { color: COLORS.project, label: "Project + Next Action", confirmText: "Create ✓" },
    someday: { color: COLORS.someday, label: "Someday / Maybe", confirmText: "Move ✓" },
    waiting: { color: COLORS.waiting, label: "Waiting For", confirmText: "Move ✓" },
    delete:  { color: COLORS.muted,   label: "Archive (not actionable)", confirmText: "Archive ✓" },
  };
  const cfg = configs[type] || configs.next;

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${cfg.color}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>→ {cfg.label}</div>
      {type === "project" ? (
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.5 }}>
          <div><span style={{ color: COLORS.muted }}>Project: </span><strong style={{ color: COLORS.text }}>{title}</strong></div>
          <div><span style={{ color: COLORS.muted }}>Next action: </span><strong style={{ color: COLORS.next }}>{nextAction}</strong></div>
        </div>
      ) : type !== "delete" ? (
        <div style={{ fontSize: 12, color: COLORS.text2 }}>
          <strong style={{ color: cfg.color }}>{title}</strong>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onConfirm} style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${cfg.color}`, background: "transparent", color: cfg.color, fontFamily: "inherit", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {cfg.confirmText}
        </button>
        <button onClick={onDismiss} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function DeferCheckPrompt({ taskText, deferredChildren, onSkip, onReview }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 12, padding: "22px 26px", maxWidth: 440, width: "90%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.deferred }}>⏳ Deferred subtasks remain</div>
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.text, fontWeight: 500 }}>&#8220;{taskText}&#8221;</span> has {deferredChildren.length} deferred or someday subtask{deferredChildren.length !== 1 ? "s" : ""}:
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: COLORS.text2, lineHeight: 1.9 }}>
          {deferredChildren.map(c => (
            <li key={c.id}>
              <span style={{ color: c.bucket === "deferred" ? COLORS.deferred : COLORS.someday }}>({c.bucket})</span> {c.text}
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            autoFocus
            onClick={onReview}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.deferred}`, background: "transparent", color: COLORS.deferred, fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            Review first
          </button>
          <button
            onClick={onSkip}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Complete anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteRollupPrompt({ taskText, notes, parentText, onConfirm, onSkip }) {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const defaultHeading = `\u2713 ${taskText} (${months[d.getMonth()]} ${d.getDate()}):`;
  const [heading, setHeading] = useState(defaultHeading);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 12, padding: "22px 26px", maxWidth: 400, width: "90%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.project }}>📋 Roll up notes?</div>
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.text, fontWeight: 500 }}>&#8220;{taskText}&#8221;</span> has notes.
          Add them to the parent task <span style={{ color: COLORS.text, fontWeight: 500 }}>&#8220;{parentText}&#8221;</span>?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 11, color: COLORS.muted }}>Heading (editable)</div>
          <input
            value={heading}
            onChange={e => setHeading(e.target.value)}
            style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 7, padding: "7px 10px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
          />
        </div>
        <div style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "9px 11px", fontSize: 12, color: COLORS.text2, lineHeight: 1.6, maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
          {notes}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            autoFocus
            onClick={() => onConfirm(heading)}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            Add to parent notes
          </button>
          <button
            onClick={onSkip}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ActualEffortPrompt({ taskText, estimatedEffort, efforts, onSave, onSkip }) {
  const [selected, setSelected] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 12, padding: "22px 26px", maxWidth: 380, width: "90%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.next }}>✓ Task complete!</div>
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.text, fontWeight: 500 }}>"{taskText}"</span>
          <br />
          Estimated: <span style={{ color: COLORS.effort }}>⏱ {estimatedEffort}</span>
          <br />
          How long did it actually take?
        </div>
        <select
          autoFocus
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 7, padding: "7px 10px", color: selected ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 13, outline: "none", colorScheme: "dark" }}
        >
          <option value="">— Select actual time —</option>
          {(efforts || []).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => selected && onSave(selected)}
            disabled={!selected}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.next}`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 13, cursor: selected ? "pointer" : "not-allowed", opacity: selected ? 1 : 0.4, fontWeight: 600 }}
          >
            Save &amp; Complete
          </button>
          <button
            onClick={onSkip}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModeBar({ onSelect }) {
  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Choose review focus
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSelect("tasks")}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.next}55`, background: COLORS.nextBg, color: COLORS.next, fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 3 }}>📋 Task completeness</div>
          <div style={{ fontSize: 11, color: COLORS.text2 }}>Find missing next actions for each project</div>
        </button>
        <button
          onClick={() => onSelect("metadata")}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.project}55`, background: COLORS.projectBg, color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 3 }}>🏷 Metadata quality</div>
          <div style={{ fontSize: 11, color: COLORS.text2 }}>Fill in effort, due dates, and defer dates</div>
        </button>
      </div>
    </div>
  );
}

function MetadataReviewBar({ suggestions, onToggleAccepted, onChangeOverride, onNext, projectIdx, totalProjects }) {
  const isEmpty = suggestions.length === 0;
  const isLast  = projectIdx + 1 >= totalProjects;
  const acceptedCount = suggestions.filter(s => s.accepted).length;

  const nextLabel = isLast
    ? (acceptedCount > 0 ? `Apply ${acceptedCount} & Finish ✓` : "Finish Review ✓")
    : (acceptedCount > 0 ? `Apply ${acceptedCount} & Next →` : "Next →");

  const FIELD_LABELS = { effort: "Effort", dueDate: "Due", deferUntil: "Defer until" };

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {isEmpty ? "✓ Metadata looks good" : "🏷 Metadata suggestions — edit values if needed"}
      </div>

      {isEmpty ? (
        <div style={{ fontSize: 12, color: COLORS.muted }}>All tasks already have adequate metadata — nothing to add.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((s, idx) => (
            <div key={s.taskId} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 9px", borderRadius: 7, background: s.accepted ? COLORS.surface2 : COLORS.surface, border: `1px solid ${s.accepted ? COLORS.border2 : COLORS.border}`, opacity: s.accepted ? 1 : 0.5 }}>
              {/* Task row header */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <input
                  type="checkbox"
                  checked={s.accepted}
                  onChange={() => onToggleAccepted(idx)}
                  style={{ accentColor: COLORS.project, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, lineHeight: 1.35 }}>{s.taskText}</span>
              </div>
              {/* Field chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 22 }}>
                {Object.entries(s.overrides).map(([field, value]) => (
                  <div key={field} style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.surface3, borderRadius: 5, padding: "2px 6px", border: `1px solid ${COLORS.border2}` }}>
                    <span style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{FIELD_LABELS[field] || field}</span>
                    <input
                      value={value || ""}
                      onChange={e => onChangeOverride(idx, field, e.target.value)}
                      disabled={!s.accepted}
                      style={{ width: field === "effort" ? 52 : 96, fontSize: 11, background: "transparent", border: "none", color: COLORS.text, fontFamily: "inherit", outline: "none", padding: 0 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={onNext}
          style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
        >
          {nextLabel}
        </button>
        <span style={{ fontSize: 11, color: COLORS.muted }}>
          Project {projectIdx + 1} of {totalProjects}
        </span>
      </div>
    </div>
  );
}

function ProjectReviewBar({ suggestions, onToggle, onNext, projectIdx, totalProjects }) {
  const selectedCount = suggestions.filter(s => s.checked).length;
  const isEmpty = suggestions.length === 0;
  const isLast = projectIdx + 1 >= totalProjects;

  const nextLabel = isLast
    ? (selectedCount > 0 ? `Add ${selectedCount} & Finish ✓` : "Finish Review ✓")
    : (selectedCount > 0 ? `Add ${selectedCount} & Next →` : "Next →");

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {isEmpty ? "✓ Project looks good" : "→ Suggested next actions — check to add"}
      </div>
      {isEmpty ? (
        <div style={{ fontSize: 12, color: COLORS.muted }}>No missing actions identified — this project is on track.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {suggestions.map((s, idx) => (
            <label key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={s.checked}
                onChange={() => onToggle(idx)}
                style={{ marginTop: 2, accentColor: COLORS.project, flexShrink: 0 }}
              />
              <span style={{ fontSize: 12, color: s.checked ? COLORS.text : COLORS.muted, textDecoration: s.checked ? "none" : "line-through", lineHeight: 1.45 }}>
                {s.text}
              </span>
            </label>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={onNext}
          style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
        >
          {nextLabel}
        </button>
        <span style={{ fontSize: 11, color: COLORS.muted }}>
          Project {projectIdx + 1} of {totalProjects}
        </span>
      </div>
    </div>
  );
}

function ProviderSelector({ provider, setProvider, localModel, setLocalModel, availableModels, fetchModels }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) fetchModels();
    setOpen(o => !o);
  };

  const activeLabel = provider === "claude" ? "Claude" : localModel;
  const activeColor = provider === "claude" ? COLORS.inbox : COLORS.next;

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={handleOpen}
        style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${activeColor}55`, background: COLORS.surface2, color: activeColor, fontFamily: "inherit", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
      >
        <span>{provider === "claude" ? "✦" : "◈"}</span>
        <span>{activeLabel}</span>
        <span style={{ opacity: 0.5, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 9, padding: 4, zIndex: 200, minWidth: 200, boxShadow: "0 8px 28px rgba(0,0,0,0.55)" }}>
          <div style={{ padding: "4px 8px 3px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>Claude API</div>
          <ProviderOption label="Claude Sonnet" icon="✦" color={COLORS.inbox} active={provider === "claude"}
            onClick={() => { setProvider("claude"); setOpen(false); }} />

          <div style={{ margin: "4px 0", borderTop: `1px solid ${COLORS.border}` }} />
          <div style={{ padding: "4px 8px 3px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>Open WebUI</div>

          {availableModels.length === 0
            ? <div style={{ padding: "6px 10px", fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>Fetching models…</div>
            : availableModels.map(m => (
              <ProviderOption key={m} label={m} icon="◈" color={COLORS.next} active={provider === "local" && localModel === m}
                onClick={() => { setProvider("local"); setLocalModel(m); setOpen(false); }} />
            ))
          }
        </div>
      )}
    </div>
  );
}

function ProviderOption({ label, icon, color, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: active || hover ? COLORS.surface2 : "transparent", color: active ? color : COLORS.text2, display: "flex", alignItems: "center", gap: 7, transition: "background 0.1s" }}
    >
      <span style={{ color: active ? color : COLORS.muted }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {active && <span style={{ color, fontSize: 9 }}>●</span>}
    </div>
  );
}

function SettingsSection({ label, storageKey, children }) {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) === "1");
  const toggle = () => setOpen(v => {
    const next = !v;
    localStorage.setItem(storageKey, next ? "1" : "0");
    return next;
  });
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <button
        onClick={toggle}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", background: "transparent", border: "none", cursor: "pointer", color: COLORS.text, fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ paddingBottom: 20 }}>{children}</div>}
    </div>
  );
}

function SettingsPanel({ locations, tasks, onAdd, onRename, onRemove, efforts, onAddEffort, onRenameEffort, onRemoveEffort, calibrationOverrides, onSetCalibrationOverride, onClearCalibrationOverride, tagDisplay, onSetTagDisplay, onExport, onImport, onClose }) {
  const fileInputRef = useRef(null);

  const [importMode, setImportMode] = useState("replace");
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onImport(data, importMode);
      } catch {
        alert("Could not parse backup file — make sure it's a valid GTD JSON export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>⚙ Settings</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Configure your GTD system</div>
        </div>
        <button
          onClick={onClose}
          style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
        >✕ Close</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
        <SettingsSection label="Tag Display" storageKey="gtd_settings_tag_display">
          <TagDisplaySetting value={tagDisplay} onChange={onSetTagDisplay} />
        </SettingsSection>
        <SettingsSection label="Locations" storageKey="gtd_settings_locations">
          <LocationManager locations={locations} tasks={tasks} onAdd={onAdd} onRename={onRename} onRemove={onRemove} />
        </SettingsSection>
        <SettingsSection label="Effort Levels" storageKey="gtd_settings_efforts">
          <EffortManager efforts={efforts} tasks={tasks} onAdd={onAddEffort} onRename={onRenameEffort} onRemove={onRemoveEffort} />
        </SettingsSection>
        <SettingsSection label="Effort Calibration" storageKey="gtd_settings_calibration">
          <EffortCalibrationManager
            efforts={efforts}
            tasks={tasks}
            calibrationOverrides={calibrationOverrides}
            onSetOverride={onSetCalibrationOverride}
            onClearOverride={onClearCalibrationOverride}
          />
        </SettingsSection>
        <SettingsSection label="Backup & Restore" storageKey="gtd_settings_backup">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14, lineHeight: 1.5 }}>
            Export all tasks, locations, and effort labels to a JSON file.{" "}
            <strong style={{ color: COLORS.text2 }}>Replace</strong> overwrites all current tasks;{" "}
            <strong style={{ color: COLORS.text2 }}>Merge</strong> adds only tasks from the backup that don't already exist.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={onExport}
              style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >⬇ Export</button>
            <button
              onClick={() => { setImportMode("replace"); fileInputRef.current?.click(); }}
              style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >⬆ Import (Replace)</button>
            <button
              onClick={() => { setImportMode("merge"); fileInputRef.current?.click(); }}
              style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >⬆ Import (Merge)</button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleFileChange} />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

function TagDisplaySetting({ value, onChange }) {
  const opts = [
    { key: "below",  label: "Below text",  desc: "Tags appear on a new line beneath the task name" },
    { key: "inline", label: "Inline",       desc: "Tags sit between the task name and the chevron" },
  ];
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14, lineHeight: 1.5 }}>
        Controls where metadata tags (location, due date, priority, effort) appear on collapsed task rows.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {opts.map(opt => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : COLORS.surface2, color: active ? COLORS.project : COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
            >
              <div style={{ fontWeight: 600, marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: active ? COLORS.project + "cc" : COLORS.muted }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocationManager({ locations, tasks, onAdd, onRename, onRemove }) {
  const [newLocText, setNewLocText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);   // index into locations
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);  // location being removed
  const [replaceWith, setReplaceWith] = useState("");

  const usedByCount = (name) => tasks.filter(t => (t.location || []).includes(name)).length;

  const handleAdd = () => {
    const trimmed = newLocText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewLocText("");
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(locations[idx]);
    setRemovingName(null);
  };

  const confirmEdit = () => {
    if (editingIdx !== null) {
      onRename(locations[editingIdx], editText);
      setEditingIdx(null);
      setEditText("");
    }
  };

  const startRemove = (name) => {
    setRemovingName(name);
    setReplaceWith("");
    setEditingIdx(null);
  };

  const confirmRemove = () => {
    onRemove(removingName, replaceWith || null);
    setRemovingName(null);
    setReplaceWith("");
  };

  const inUse = removingName ? usedByCount(removingName) : 0;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Locations tag where a task can be done. Changes cascade to all existing tasks.
      </div>

      {/* Location list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {locations.map((loc, idx) => {
          const count = usedByCount(loc);
          const isEditing = editingIdx === idx;
          const isRemoving = removingName === loc;

          return (
            <div key={loc} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? "#d45a5a55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              {/* Main row */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.project, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{loc}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} task{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(idx)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => startRemove(loc)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid #d45a5a44`, background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {/* Remove confirmation sub-row */}
              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: "#d45a5a" }}>{inUse} task{inUse !== 1 ? "s" : ""}</strong> use this location. Replace with:
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          value={replaceWith}
                          onChange={e => setReplaceWith(e.target.value)}
                          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
                        >
                          <option value="">— remove tag only —</option>
                          {locations.filter(l => l !== loc).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d45a5a", background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{loc}</strong>? No tasks use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #d45a5a", background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new location */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newLocText}
          onChange={e => setNewLocText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New location…"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newLocText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: newLocText.trim() ? "pointer" : "not-allowed", opacity: newLocText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

function EffortManager({ efforts, tasks, onAdd, onRename, onRemove }) {
  const [newText, setNewText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");

  const usedByCount = (name) => tasks.filter(t => t.effort === name || t.actualEffort === name).length;

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText("");
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(efforts[idx]);
  };

  const confirmEdit = () => {
    if (editingIdx !== null) {
      onRename(efforts[editingIdx], editText);
      setEditingIdx(null);
      setEditText("");
    }
  };

  const handleRemove = (name) => {
    if (window.confirm(`Remove "${name}"? It will be cleared from any tasks that use it.`)) {
      onRemove(name);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Effort estimates for tasks. Changes cascade to all existing tasks. Values are parsed for project totals (e.g. "2 hours", "1 day").
      </div>

      {/* Effort list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {(efforts || []).map((eff, idx) => {
          const count = usedByCount(eff);
          const isEditing = editingIdx === idx;

          return (
            <div key={eff} style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.effort, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{eff}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} task{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(idx)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => handleRemove(eff)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid #d45a5a44`, background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new effort */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New effort level… (e.g. 4 hours)"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.effort}`, background: "transparent", color: COLORS.effort, fontFamily: "inherit", fontSize: 12, cursor: newText.trim() ? "pointer" : "not-allowed", opacity: newText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

function EffortCalibrationManager({ efforts, tasks, calibrationOverrides, onSetOverride, onClearOverride }) {
  // Compute auto stats from completed tasks
  const stats = {};
  efforts.forEach(label => { stats[label] = { totalActual: 0, count: 0 }; });
  tasks.filter(t => t.done && t.effort && t.actualEffort).forEach(t => {
    if (stats[t.effort]) {
      stats[t.effort].totalActual += effortToMinutes(t.actualEffort);
      stats[t.effort].count       += 1;
    }
  });

  const totalCompleted = tasks.filter(t => t.done && t.effort && t.actualEffort).length;

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.6 }}>
        When you record actual effort on completed tasks, this table updates automatically.
        The AI uses these averages to give better effort suggestions during inbox processing and project review.
        Set a manual override to seed a label before you have {MIN_CALIBRATION_SAMPLES} data points.
      </div>

      {totalCompleted === 0 && Object.values(calibrationOverrides || {}).every(v => !v) ? (
        <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", marginBottom: 16 }}>
          No calibration data yet. Complete tasks with both estimated and actual effort to build your history.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px", gap: 8, padding: "4px 10px", fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Label</span>
          <span>Auto avg</span>
          <span>Manual override</span>
          <span>AI uses</span>
        </div>

        {efforts.map(label => {
          const s = stats[label] || { totalActual: 0, count: 0 };
          const override = calibrationOverrides?.[label] || "";
          const hasEnough = s.count >= MIN_CALIBRATION_SAMPLES;
          const avgMin    = hasEnough ? Math.round(s.totalActual / s.count) : null;
          const avgLabel  = avgMin ? minutesToEffortLabel(avgMin) : null;
          const estMin    = effortToMinutes(label);
          const pct       = avgMin && estMin ? Math.round(((avgMin - estMin) / estMin) * 100) : null;
          const color     = avgMin ? effortAccuracyColor(estMin, avgMin) : COLORS.muted;

          // What the AI will use
          let aiUses, aiColor;
          if (override) {
            aiUses = override; aiColor = COLORS.project;
          } else if (hasEnough && avgLabel) {
            aiUses = avgLabel; aiColor = color;
          } else {
            aiUses = "global avg"; aiColor = COLORS.muted;
          }

          return (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px", gap: 8, alignItems: "center", padding: "8px 10px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
              {/* Label */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.effort, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: COLORS.text }}>{label}</span>
              </div>

              {/* Auto avg */}
              <div style={{ fontSize: 12 }}>
                {hasEnough && avgLabel ? (
                  <span style={{ color }}>
                    {avgLabel}{pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}
                    <span style={{ color: COLORS.muted, fontSize: 10, marginLeft: 4 }}>n={s.count}</span>
                  </span>
                ) : s.count > 0 ? (
                  <span style={{ color: COLORS.muted }}>{s.count}/{MIN_CALIBRATION_SAMPLES} samples</span>
                ) : (
                  <span style={{ color: COLORS.muted }}>—</span>
                )}
              </div>

              {/* Manual override */}
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <select
                  value={override}
                  onChange={e => e.target.value ? onSetOverride(label, e.target.value) : onClearOverride(label)}
                  style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${override ? COLORS.project : COLORS.border}`, borderRadius: 5, padding: "3px 6px", color: override ? COLORS.project : COLORS.muted, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
                >
                  <option value="">— none —</option>
                  {efforts.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                {override && (
                  <button
                    onClick={() => onClearOverride(label)}
                    title="Clear override"
                    style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                  >✕</button>
                )}
              </div>

              {/* AI uses */}
              <div style={{ fontSize: 11, color: aiColor, fontWeight: 500 }}>{aiUses}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
        Auto avg requires {MIN_CALIBRATION_SAMPLES}+ completed tasks per label. Manual overrides take priority.
      </div>
    </div>
  );
}

function DropLine({ depth }) {
  return (
    <div style={{ height: 2, background: COLORS.project, margin: `1px 18px 1px ${18 + depth * 22}px`, borderRadius: 2, pointerEvents: "none" }} />
  );
}

// Read-only hierarchical view for completed tasks.
// parentId === null  → virtual roots: done tasks whose parent is not also done.
// parentId !== null  → done children of parentId in childIds order.
function CompletedTree({ parentId, depth, allTasks, rowProps }) {
  if (depth > 5) return null;

  let children;
  if (parentId === null) {
    const doneIds = new Set(allTasks.filter(t => t.done).map(t => t.id));
    children = allTasks.filter(t => t.done && (!t.parentId || !doneIds.has(t.parentId)));
  } else {
    children = getOrderedChildren(parentId, allTasks).filter(t => t.done);
  }

  if (!children.length) return null;

  return (
    <>
      {children.map(task => (
        <div key={task.id}>
          <TaskRow
            task={task}
            isSubtask={depth > 0}
            indentOverride={depth * 22}
            depth={depth}
            {...rowProps}
          />
          {!rowProps.collapsedNodes?.has(task.id) && (
            <CompletedTree
              parentId={task.id}
              depth={depth + 1}
              allTasks={allTasks}
              rowProps={rowProps}
            />
          )}
        </div>
      ))}
    </>
  );
}

function ProjectTree({ parentId, depth, allTasks, dragId, dropTarget, onDragStart, onDragOver, onDragEnd, onDrop, rowProps }) {
  if (depth > 5) return null;
  const children = getOrderedChildren(parentId, allTasks);
  if (!children.length) return null;

  return (
    <>
      {children.map(task => {
        const dt = dropTarget;
        const isTarget   = dt?.id === task.id;
        const isDragging = dragId === task.id;

        return (
          <div key={task.id}>
            {isTarget && dt.position === "before" && <DropLine depth={depth} />}

            <div
              draggable
              onDragStart={e => { e.stopPropagation(); onDragStart(task.id); }}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOver(e, task.id); }}
              onDragEnd={e => { e.stopPropagation(); onDragEnd(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(task.id); }}
              style={{
                opacity: isDragging ? 0.35 : 1,
                outline: isTarget && dt.position === "inside" ? `2px solid ${COLORS.project}66` : "none",
                outlineOffset: -1,
                borderRadius: 4,
                transition: "opacity 0.1s",
              }}
            >
              <TaskRow
                task={task}
                isSubtask={depth > 0}
                indentOverride={depth * 22}
                depth={depth}
                {...rowProps}
              />
            </div>

            {/* Recurse into children — skipped when this node is collapsed. */}
            {!rowProps.collapsedNodes?.has(task.id) && (
              <ProjectTree
                parentId={task.id}
                depth={depth + 1}
                allTasks={allTasks}
                dragId={dragId}
                dropTarget={dropTarget}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                rowProps={rowProps}
              />
            )}

            {isTarget && dt.position === "after" && <DropLine depth={depth} />}
          </div>
        );
      })}
    </>
  );
}

function GroupDivider({ label, count, effortTotal, isUngrouped }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px 5px", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: isUngrouped ? COLORS.muted : COLORS.text2, letterSpacing: "0.06em", textTransform: isUngrouped ? "none" : "uppercase" }}>
        {isUngrouped ? `— ${label}` : label}
      </span>
      <span style={{ fontSize: 10, color: COLORS.muted, background: COLORS.surface3, padding: "1px 6px", borderRadius: 8 }}>{count}</span>
      {effortTotal && (
        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44` }}>⏱ {effortTotal}</span>
      )}
    </div>
  );
}

function EmptyState({ bucket }) {
  const msgs = {
    inbox:     ["Your inbox is clear", "Add tasks above, or use Brain Dump to surface open loops."],
    next:      ["No next actions", "Process your inbox and move concrete actions here."],
    project:   ["No projects", "Multi-step goals go here."],
    waiting:   ["Nothing waiting", "Track delegated items here."],
    someday:   ["No someday items", "Capture future ideas without committing to them."],
    deferred:  ["No deferred tasks", "Open any task's chevron → set a 'Defer Until' date to hide it until you need it."],
    done:      ["Nothing completed yet", "Complete tasks and they'll appear here."],
  };
  const [title, sub] = msgs[bucket] || ["Empty", ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 40, textAlign: "center", gap: 6, color: COLORS.muted, minHeight: 120 }}>
      <div style={{ fontSize: 28, opacity: 0.3 }}>○</div>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailPanel — side panel showing full task detail + notes editor
// ---------------------------------------------------------------------------
function TaskDetailPanel({ task, allTasks, locations, efforts, onUpdate, onComplete, onDelete, onReassignProject, onSkipRecurrence, onClose, style }) {
  const [titleDraft, setTitleDraft] = useState(task.text);
  const [notesDraft, setNotesDraft] = useState(task.notes || "");

  // Sync drafts if task changes (e.g. another panel opens a different task)
  useEffect(() => { setTitleDraft(task.text); }, [task.id, task.text]);
  useEffect(() => { setNotesDraft(task.notes || ""); }, [task.id, task.notes]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== task.text) onUpdate(task.id, { text: t });
    else setTitleDraft(task.text);
  };

  const saveNotes = () => {
    const val = notesDraft.trim() || null;
    if (val !== (task.notes || null)) onUpdate(task.id, { notes: val });
  };

  const parentProject = task.parentId ? allTasks.find(t => t.id === task.parentId) : null;
  const bucketColor = BUCKETS[task.bucket]?.color || COLORS.muted;
  const bucketLabel = BUCKETS[task.bucket]?.label || task.bucket;
  const rec = task.recurrence || null;

  // Build the list of projects the task can be assigned to.
  // Excludes: the task itself, and any of its descendants (would create a cycle).
  const getDescendantIds = (taskId, tasks, seen = new Set()) => {
    if (seen.has(taskId)) return seen;
    seen.add(taskId);
    const t = tasks.find(x => x.id === taskId);
    (t?.childIds || []).forEach(cid => getDescendantIds(cid, tasks, seen));
    return seen;
  };
  const excludedIds = getDescendantIds(task.id, allTasks);
  const eligibleProjects = allTasks.filter(
    t => t.bucket === "project" && !excludedIds.has(t.id)
  );

  const fieldLabel = { fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 };
  const fieldInput = { width: "100%", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ ...style, background: COLORS.surface, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>Task Detail</span>
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
        >×</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Title */}
        <div>
          <div style={fieldLabel}>Title</div>
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } if (e.key === "Escape") { setTitleDraft(task.text); e.target.blur(); } }}
            style={{ ...fieldInput, fontSize: 13, fontWeight: 500 }}
          />
        </div>

        {/* Notes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 140 }}>
          <div style={fieldLabel}>Notes</div>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes, context, links…"
            style={{ ...fieldInput, flex: 1, resize: "none", lineHeight: 1.5, minHeight: 120 }}
          />
        </div>

        {/* Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={fieldLabel}>Info</div>

          {/* Bucket */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Bucket</span>
            <span style={{ color: bucketColor, fontWeight: 500 }}>{bucketLabel}</span>
          </div>

          {/* Parent project — dropdown allows moving to another project or going standalone */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Project</span>
            <select
              value={task.parentId || ""}
              onChange={e => onReassignProject(task.id, e.target.value || null)}
              style={{ ...fieldInput, flex: 1, fontSize: 12, color: task.parentId ? COLORS.project : COLORS.muted }}
            >
              <option value="">— Standalone</option>
              {eligibleProjects.map(p => (
                <option key={p.id} value={p.id}>{p.text}</option>
              ))}
            </select>
          </div>

          {/* Due date */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Due</span>
            <input
              type="date"
              value={task.dueDate || ""}
              onChange={e => onUpdate(task.id, { dueDate: e.target.value || null })}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px" }}
            />
          </div>

          {/* Recurrence */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: COLORS.muted, width: 64, flexShrink: 0, fontSize: 12 }}>Repeat</span>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={!!rec}
                  onChange={e => onUpdate(task.id, { recurrence: e.target.checked
                    ? { frequency: "weekly", interval: 1, rescheduleFrom: "completion", sendToInbox: false }
                    : null })}
                />
                {rec ? "Enabled" : "Off"}
              </label>
            </div>
            {rec && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Every</span>
                  <input
                    type="number" min={1} max={99}
                    value={rec.interval || 1}
                    onChange={e => onUpdate(task.id, { recurrence: { ...rec, interval: Math.max(1, parseInt(e.target.value) || 1) } })}
                    style={{ ...fieldInput, width: 46, textAlign: "center", padding: "3px 4px", fontSize: 12 }}
                  />
                  <select
                    value={rec.frequency}
                    onChange={e => onUpdate(task.id, { recurrence: { ...rec, frequency: e.target.value, weekDays: e.target.value !== "weekly" ? undefined : rec.weekDays } })}
                    style={{ ...fieldInput, flex: 1, fontSize: 12, padding: "3px 6px" }}
                  >
                    <option value="daily">day(s)</option>
                    <option value="weekly">week(s)</option>
                    <option value="monthly">month(s)</option>
                    <option value="yearly">year(s)</option>
                  </select>
                </div>
                {rec.frequency === "weekly" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>On</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {["Su","Mo","Tu","We","Th","Fr","Sa"].map((day, i) => {
                        const active = (rec.weekDays || []).includes(i);
                        return (
                          <button key={i} onClick={() => {
                            const cur = rec.weekDays || [];
                            const next = active ? cur.filter(x => x !== i) : [...cur, i].sort((a,b) => a-b);
                            onUpdate(task.id, { recurrence: { ...rec, weekDays: next.length ? next : undefined } });
                          }}
                          style={{ width: 26, height: 22, borderRadius: 4, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : "transparent", color: active ? COLORS.project : COLORS.muted, fontSize: 10, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                          >{day}</button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Base on</span>
                  <select
                    value={rec.rescheduleFrom || "completion"}
                    onChange={e => onUpdate(task.id, { recurrence: { ...rec, rescheduleFrom: e.target.value } })}
                    style={{ ...fieldInput, flex: 1, fontSize: 12, padding: "3px 6px" }}
                  >
                    <option value="completion">Completion date</option>
                    <option value="dueDate">Original due date</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>On spawn</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!rec.sendToInbox}
                      onChange={e => onUpdate(task.id, { recurrence: { ...rec, sendToInbox: e.target.checked } })} />
                    Send to Inbox
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Defer until */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Defer</span>
            <input
              type="date"
              value={task.deferUntil || ""}
              onChange={e => onUpdate(task.id, { deferUntil: e.target.value || null })}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px" }}
            />
          </div>

          {/* Effort (expected) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Estimated</span>
            <select
              value={task.effort || ""}
              onChange={e => onUpdate(task.id, { effort: e.target.value || null })}
              style={{ ...fieldInput, width: 'auto', fontSize: 12, padding: '3px 6px' }}
            >
              <option value=''>—</option>
              {(efforts || []).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Actual effort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0 }}>Actual</span>
            <select
              value={task.actualEffort || ""}
              onChange={e => onUpdate(task.id, { actualEffort: e.target.value || null })}
              style={{ ...fieldInput, width: 'auto', fontSize: 12, padding: '3px 6px', color: task.actualEffort ? effortAccuracyColor(effortToMinutes(task.effort), effortToMinutes(task.actualEffort)) : undefined }}
            >
              <option value=''>—</option>
              {(efforts || []).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {task.effort && task.actualEffort && (() => {
              const estMin = effortToMinutes(task.effort);
              const actMin = effortToMinutes(task.actualEffort);
              const pct = estMin ? Math.round(((actMin - estMin) / estMin) * 100) : null;
              const color = effortAccuracyColor(estMin, actMin);
              return pct !== null ? (
                <span style={{ fontSize: 11, color, fontWeight: 500 }}>
                  {pct > 0 ? `+${pct}%` : `${pct}%`}
                </span>
              ) : null;
            })()}
          </div>

          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.muted, width: 64, flexShrink: 0, paddingTop: 2 }}>Location</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(locations || []).map(loc => {
                const active = (task.location || []).includes(loc);
                return (
                  <button
                    key={loc}
                    onClick={() => {
                      const cur = task.location || [];
                      onUpdate(task.id, { location: active ? cur.filter(l => l !== loc) : [...cur, loc] });
                    }}
                    style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + '22' : 'transparent', color: active ? COLORS.project : COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
                  >{loc}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Move to bucket */}
        <div>
          <div style={fieldLabel}>Move to</div>
          <select
            value={task.bucket}
            onChange={e => onUpdate(task.id, { bucket: e.target.value })}
            style={{ ...fieldInput, fontSize: 12 }}
          >
            {Object.entries(BUCKETS).filter(([k]) => k !== 'inboxHistory').map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: `1px solid ${COLORS.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          onClick={() => onComplete(task.id)}
          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${COLORS.next}`, background: 'transparent', color: COLORS.next, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
        >✓ Complete</button>
        {task.recurrence && onSkipRecurrence && (
          <button
            onClick={() => onSkipRecurrence(task.id)}
            title="Skip this occurrence — advances schedule without completing"
            style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${COLORS.deferred}`, background: 'transparent', color: COLORS.deferred, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >↻ Skip</button>
        )}
        <button
          onClick={() => { if (window.confirm(`Delete "${task.text}"?`)) onDelete(task.id); }}
          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
        >🗑 Delete</button>
      </div>
    </div>
  );
}
