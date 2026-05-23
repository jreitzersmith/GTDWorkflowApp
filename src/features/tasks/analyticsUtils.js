import { effortToMinutes, isDeferred } from './taskUtils.jsx';

// --- Helpers ---

// Days between a Unix-ms timestamp and now.
function ageDays(createdMs) {
  return Math.floor((Date.now() - createdMs) / 86400000);
}

// Recursively collect all descendant IDs (including start node) from a Map.
function getDescendantIds(taskId, taskMap, visited = new Set()) {
  if (visited.has(taskId)) return visited;
  visited.add(taskId);
  const task = taskMap.get(taskId);
  (task?.childIds || []).forEach(cid => getDescendantIds(cid, taskMap, visited));
  return visited;
}

// --- Existing analytics functions ---

function buildBucketStats(tasks) {
  return {
    inbox:        tasks.filter(t => t.bucket === 'inbox').length,
    project:      tasks.filter(t => t.bucket === 'project').length,
    next:         tasks.filter(t => t.isNextAction && !t.isSomeday && !t.isWaitingFor && !t.done).length,
    waiting:      tasks.filter(t => t.isWaitingFor && !t.done).length,
    someday:      tasks.filter(t => t.isSomeday && !t.done).length,
    deferred:     tasks.filter(t => isDeferred(t) && !t.done).length,
    done:         tasks.filter(t => t.bucket === 'done').length,
    inboxHistory: tasks.filter(t => t.bucket === 'inboxHistory').length,
  };
}

function buildWeeklyCompletions(tasks, weeks = 12) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const labels = [];
  const weekStarts = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7 - d.getDay());
    d.setHours(0, 0, 0, 0);
    weekStarts.push(new Date(d));
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  const counts = new Array(weeks).fill(0);
  for (const t of tasks) {
    if (!t.completedDate) continue;
    const cd = new Date(t.completedDate + 'T00:00:00');
    for (let i = 0; i < weeks; i++) {
      const end = new Date(weekStarts[i]);
      end.setDate(end.getDate() + 7);
      if (cd >= weekStarts[i] && cd < end) { counts[i]++; break; }
    }
  }
  return { labels, counts };
}

function buildEffortAccuracy(tasks) {
  let under = 0, onTarget = 0, over = 0;
  for (const t of tasks) {
    if (!t.effort || !t.actualEffort) continue;
    const est = effortToMinutes(t.effort);
    const actual = effortToMinutes(t.actualEffort);
    if (!est || !actual) continue;
    const ratio = actual / est;
    if (ratio < 0.8) under++;
    else if (ratio <= 1.2) onTarget++;
    else over++;
  }
  return { under, onTarget, over, total: under + onTarget + over };
}

function buildDueDateCompliance(tasks) {
  const withDeadline = tasks.filter(t => t.done && t.completedDate && t.dueDate);
  let onTime = 0, late = 0;
  for (const t of withDeadline) {
    if (t.completedDate <= t.dueDate) onTime++;
    else late++;
  }
  const slipped = tasks.filter(t => t.done && t.originalDueDate && t.dueDate && t.originalDueDate < t.dueDate).length;
  const noDeadline = tasks.filter(t => t.done && t.completedDate && !t.dueDate).length;
  return { onTime, late, slipped, noDeadline, total: withDeadline.length };
}

function buildDeferralFrequency(tasks) {
  const counts = { once: 0, twice: 0, thrice: 0, more: 0 };
  let total = 0;
  for (const t of tasks) {
    const n = t.deferCount || 0;
    if (n === 0) continue;
    total++;
    if (n === 1) counts.once++;
    else if (n === 2) counts.twice++;
    else if (n === 3) counts.thrice++;
    else counts.more++;
  }
  return { ...counts, total };
}

// --- FR#120: Throughput trend ---

// Returns 8-week completion data split into current and prior 4-week windows.
function buildThroughputTrend(tasks) {
  const { labels, counts } = buildWeeklyCompletions(tasks, 8);
  const prior4wk   = counts.slice(0, 4).reduce((s, n) => s + n, 0);
  const current4wk = counts.slice(4).reduce((s, n) => s + n, 0);
  const change = prior4wk === 0 ? null : Math.round(((current4wk - prior4wk) / prior4wk) * 100);
  return { labels, counts, current4wk, prior4wk, change };
}

// --- FR#121: Project health ---

// Actionable node types — categories/subcategories are containers, not reviewable projects.
const ACTIONABLE_NODE_TYPES = new Set(['project', 'subproject', undefined, null]);

// Returns { stalled, allWaiting, inactive, total } where each is an array of { id, text }.
// stalled   = no active next-action descendants
// allWaiting = all active descendants are isWaitingFor
// inactive  = no completed descendants within inactiveDays
function buildProjectHealth(tasks, inactiveDays = 30) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - inactiveDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const projectNodes = tasks.filter(t =>
    t.bucket === 'project' &&
    !t.done &&
    ACTIONABLE_NODE_TYPES.has(t.nodeType)
  );

  const stalled = [], allWaiting = [], inactive = [];

  for (const proj of projectNodes) {
    const allIds = getDescendantIds(proj.id, taskMap, new Set());
    allIds.delete(proj.id);
    const descendants = [...allIds].map(id => taskMap.get(id)).filter(Boolean);
    const activeDeps = descendants.filter(t => !t.done);
    if (activeDeps.length === 0) continue;

    const hasNextAction  = activeDeps.some(t => t.isNextAction && !t.isSomeday);
    const allAreWaiting  = activeDeps.every(t => t.isWaitingFor);
    const recentCompletion = descendants.some(t => t.done && t.completedDate && t.completedDate >= cutoffStr);

    if (!hasNextAction && !allAreWaiting) stalled.push({ id: proj.id, text: proj.text });
    if (allAreWaiting)                   allWaiting.push({ id: proj.id, text: proj.text });
    if (!recentCompletion)               inactive.push({ id: proj.id, text: proj.text });
  }

  return { stalled, allWaiting, inactive, total: projectNodes.length };
}

// --- FR#123: Effort accuracy by period and by project ---

// Returns last `periods` months of effort accuracy: [{ label, under, onTarget, over, total }]
function buildEffortAccuracyByPeriod(tasks, periods = 6) {
  const now = new Date();
  const months = [];
  for (let i = periods - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year:  d.getFullYear(),
      month: d.getMonth(),
      under: 0, onTarget: 0, over: 0, total: 0,
    });
  }
  for (const t of tasks) {
    if (!t.done || !t.completedDate || !t.effort || !t.actualEffort) continue;
    const est    = effortToMinutes(t.effort);
    const actual = effortToMinutes(t.actualEffort);
    if (!est || !actual) continue;
    const cd = new Date(t.completedDate + 'T00:00:00');
    const bucket = months.find(m => m.year === cd.getFullYear() && m.month === cd.getMonth());
    if (!bucket) continue;
    const ratio = actual / est;
    bucket.total++;
    if (ratio < 0.8) bucket.under++;
    else if (ratio <= 1.2) bucket.onTarget++;
    else bucket.over++;
  }
  return months;
}

// Returns per-project effort accuracy for completed tasks (min 2 data points).
function buildEffortAccuracyByProject(tasks) {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const byProject = {};
  for (const t of tasks) {
    if (!t.done || !t.effort || !t.actualEffort) continue;
    const est    = effortToMinutes(t.effort);
    const actual = effortToMinutes(t.actualEffort);
    if (!est || !actual) continue;
    let cur = t;
    let projectText = null;
    while (cur.parentId) {
      const parent = taskMap.get(cur.parentId);
      if (!parent) break;
      if (parent.bucket === 'project') { projectText = parent.text; break; }
      cur = parent;
    }
    const key = projectText || '(no project)';
    if (!byProject[key]) byProject[key] = { projectText: key, under: 0, onTarget: 0, over: 0, total: 0 };
    const ratio = actual / est;
    byProject[key].total++;
    if (ratio < 0.8) byProject[key].under++;
    else if (ratio <= 1.2) byProject[key].onTarget++;
    else byProject[key].over++;
  }
  return Object.values(byProject)
    .filter(p => p.total >= 2)
    .sort((a, b) => b.total - a.total);
}

// --- FR#124: Context/location utilization ---

// Returns [{ context, active, completed }] per location tag, sorted by active count desc.
// completed counts only tasks finished within the last 90 days.
function buildContextUtilization(tasks) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const ctxMap = {};
  for (const t of tasks) {
    if (!t.location || !t.location.length) continue;
    for (const loc of t.location) {
      if (!loc) continue;
      if (!ctxMap[loc]) ctxMap[loc] = { context: loc, active: 0, completed: 0 };
      if (!t.done) {
        ctxMap[loc].active++;
      } else if (t.completedDate && t.completedDate >= cutoffStr) {
        ctxMap[loc].completed++;
      }
    }
  }
  return Object.values(ctxMap)
    .filter(c => c.active > 0 || c.completed > 0)
    .sort((a, b) => b.active - a.active);
}

// --- FR#125: Someday/Maybe decay ---

// Returns { flagged: [{id, text, ageDays}], threshold, total }
// flagged = isSomeday active tasks older than thresholdDays, sorted oldest first.
function buildSomedayDecay(tasks, thresholdDays = 90) {
  const somedayActive = tasks.filter(t => t.isSomeday && !t.done);
  const flagged = somedayActive
    .map(t => ({ id: t.id, text: t.text, ageDays: ageDays(t.created) }))
    .filter(t => t.ageDays >= thresholdDays)
    .sort((a, b) => b.ageDays - a.ageDays);
  return { flagged, threshold: thresholdDays, total: somedayActive.length };
}

export {
  buildBucketStats, buildWeeklyCompletions, buildEffortAccuracy,
  buildDueDateCompliance, buildDeferralFrequency,
  buildThroughputTrend, buildProjectHealth,
  buildEffortAccuracyByPeriod, buildEffortAccuracyByProject,
  buildContextUtilization, buildSomedayDecay,
};
