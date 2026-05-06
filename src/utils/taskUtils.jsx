// Pure task utilities: date helpers, recurrence, action-line parsers,
// waterfall filter, group-by, effort helpers, and calibration context.
// No React or API dependencies.

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
    if (key === 'recur') changes.recurrence = parseRecurrenceValue(val);
    if (key === 'dueTime') changes.dueTime = val;
  });
  if (notesRaw !== null) changes.notes = notesRaw.replace(/\\n/g, '\n');

  return Object.keys(changes).length ? { taskId, changes } : null;
}

// Parse →ACTION:add from AI reply; returns { title, parentId, ...fields } or null.
function extractAddAction(text) {
  const m = text.match(/→ACTION:add\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const title = m[1].trim().replace(/`/g, '');
  const rest = m[2];
  const fields = {};
  rest.split('|').filter(Boolean).forEach(pair => {
    const colon = pair.indexOf(':');
    if (colon === -1) return;
    const key = pair.slice(0, colon).trim();
    const val = pair.slice(colon + 1).trim();
    if (key === 'parent')   fields.parentId   = val.replace(/`/g, '').trim();
    if (key === 'bucket')   fields.bucket     = val;
    if (key === 'due')      fields.dueDate    = val;
    if (key === 'defer')    fields.deferUntil = val;
    if (key === 'effort')   fields.effort     = val;
    if (key === 'location') fields.location   = val.split(',').map(s => s.trim()).filter(Boolean);
    if (key === 'recur') fields.recurrence = parseRecurrenceValue(val);
    if (key === 'dueTime') fields.dueTime = val;
  });
  if (!fields.parentId || !title) return null;
  return { title, ...fields };
}

// Parse →ACTION:create from AI reply; returns { title, bucket, ...fields } or null.
function extractCreateAction(text) {
  const m = text.match(/→ACTION:create\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const title = m[1].trim().replace(/`/g, '');
  const rest = m[2];
  const VALID_BUCKETS = new Set(['inbox', 'next', 'project', 'someday', 'waiting']);
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
    if (key === 'recur') fields.recurrence = parseRecurrenceValue(val);
    if (key === 'dueTime') fields.dueTime = val;
  });
  if (!title || !fields.bucket) return null;
  return { title, ...fields };
}

// Parse →ACTION:calendar_create from AI reply
function extractCalendarCreateAction(text) {
  const m = text.match(/→ACTION:calendar_create\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const title = m[1].trim();
  const fields = {};
  m[2].split('|').filter(Boolean).forEach(pair => {
    const colon = pair.indexOf(':');
    if (colon === -1) return;
    const key = pair.slice(0, colon).trim();
    const val = pair.slice(colon + 1).trim();
    if (key === 'date')        fields.date        = val;
    if (key === 'startTime')   fields.startTime   = val;
    if (key === 'endTime')     fields.endTime     = val;
    if (key === 'description') fields.description = val;
    if (key === 'taskId')      fields.taskId      = val;
    if (key === 'attendees')   fields.attendees   = val.split(',').map(e => ({ email: e.trim() })).filter(e => e.email);
    if (key === 'sendUpdates') fields.sendUpdates = val;
    if (key === 'recur')        fields.recurrence = parseRecurrenceValue(val);
  });
  if (!title || !fields.date) return null;
  return { title, ...fields };
}

// Parse →ACTION:calendar_update from AI reply
function extractCalendarUpdateAction(text) {
  const m = text.match(/→ACTION:calendar_update\|([^|\n]+)\|(.*)/s);
  if (!m) return null;
  const eventId = m[1].trim();
  const fields = {};
  m[2].split('|').filter(Boolean).forEach(pair => {
    const colon = pair.indexOf(':');
    if (colon === -1) return;
    const key = pair.slice(0, colon).trim();
    const val = pair.slice(colon + 1).trim();
    if (key === 'date')        fields.date        = val;
    if (key === 'startTime')   fields.startTime   = val;
    if (key === 'endTime')     fields.endTime     = val;
    if (key === 'title')       fields.title       = val;
    if (key === 'taskId')      fields.taskId      = val;
    if (key === 'attendees')   fields.attendees   = val.split(',').map(e => ({ email: e.trim() })).filter(e => e.email);
    if (key === 'sendUpdates') fields.sendUpdates = val;
  });
  if (!eventId) return null;
  return { eventId, ...fields };
}

// Parse →ACTION:calendar_delete from AI reply
function extractCalendarDeleteAction(text) {
  const m = text.match(/→ACTION:calendar_delete\|([^\n]+)/);
  if (!m) return null;
  return { eventId: m[1].trim() };
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


export { todayStr, isDeferred, subtractFromDate, buildNextOccurrence, formatBubble, extractAction, extractUpdateAction, extractAddAction, extractCreateAction, extractCalendarCreateAction, extractCalendarUpdateAction, extractCalendarDeleteAction, waterfallFilter, groupByField, effortToMinutes, effortAccuracyColor, minutesToEffortLabel, MIN_CALIBRATION_SAMPLES, buildCalibrationContext, sumDescendantEffort, countDescendants, extractSuggestions, extractMetadata, getOrderedChildren, moveTaskInTree, useResizer };
