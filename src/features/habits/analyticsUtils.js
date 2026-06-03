// src/features/habits/analyticsUtils.js
// Pure computation functions for all Habits analytics panels (FR#194-198).
// No side effects — all functions take data as arguments and return computed results.

import { HABIT_ORDER, getWeekBounds, toDateString } from './habitsUtils.js';

// ── Week windows ──────────────────────────────────────────────────────────────

/**
 * Build an array of week windows (Mon–Sun), oldest first, ending on the week
 * that contains `today`. The last window is always the current week.
 *
 * @param {Date}   today
 * @param {number} numWeeks
 * @returns {Array<{ weekStart: string, weekEnd: string, label: string }>}
 */
export function buildWeekWindows(today, numWeeks) {
  const { weekStart: currentWeekStart } = getWeekBounds(today);
  const windows = [];
  for (let i = numWeeks - 1; i >= 0; i--) {
    const startDate = new Date(currentWeekStart + 'T00:00:00');
    startDate.setDate(startDate.getDate() - i * 7);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const weekStart = toDateString(startDate);
    const weekEnd   = toDateString(endDate);
    const label     = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    windows.push({ weekStart, weekEnd, label });
  }
  return windows;
}

// ── Habit completion thresholds ───────────────────────────────────────────────

/**
 * Minimum entry count for a habit to be considered "done" in a given week.
 * - Periodic (weekly) habits: any 1 entry.
 * - skill_hour (weekdays, 5/week): majority = 3.
 * - evidence_journal (daily, 7/week): majority = 4.
 */
function weekDoneThreshold(habitId) {
  if (habitId === 'evidence_journal') return 4;
  if (habitId === 'skill_hour')       return 3;
  return 1;
}

/**
 * Returns true if a habit was "done" for a given week window.
 *
 * @param {string} habitId
 * @param {Array}  entries
 * @param {string} weekStart  YYYY-MM-DD
 * @param {string} weekEnd    YYYY-MM-DD
 * @returns {boolean}
 */
export function habitDoneForWeek(habitId, entries, weekStart, weekEnd) {
  const count = entries.filter(
    e => e.habit_id === habitId && e.entry_date >= weekStart && e.entry_date <= weekEnd
  ).length;
  return count >= weekDoneThreshold(habitId);
}

// ── FR#194 — 12-week compliance matrix ───────────────────────────────────────

/**
 * Build a compliance matrix for the heatmap.
 * Each row represents a week; each habit column is true (done) or false (missed).
 *
 * @param {Array}  entries
 * @param {Date}   today
 * @param {number} numWeeks
 * @returns {Array<{ weekStart: string, weekEnd: string, label: string, done: Object<string, boolean> }>}
 */
export function buildComplianceMatrix(entries, today, numWeeks = 12) {
  const windows = buildWeekWindows(today, numWeeks);
  return windows.map(w => ({
    ...w,
    done: Object.fromEntries(
      HABIT_ORDER.map(id => [id, habitDoneForWeek(id, entries, w.weekStart, w.weekEnd)])
    ),
  }));
}

// ── FR#197 — Weekly habits score trend ───────────────────────────────────────

/**
 * Compute a weekly score (0–5) for each week: count of habits "done".
 *
 * @param {Array}  entries
 * @param {Date}   today
 * @param {number} numWeeks
 * @returns {Array<{ weekStart: string, weekEnd: string, label: string, score: number }>}
 */
export function computeWeeklyScores(entries, today, numWeeks = 24) {
  const windows = buildWeekWindows(today, numWeeks);
  return windows.map(w => ({
    ...w,
    score: HABIT_ORDER.reduce(
      (sum, id) => sum + (habitDoneForWeek(id, entries, w.weekStart, w.weekEnd) ? 1 : 0),
      0
    ),
  }));
}

// ── FR#195 — Skill Hour cumulative tracker ────────────────────────────────────

/**
 * Total hours logged for a skill (converts minutes to hours).
 *
 * @param {Array}  entries
 * @param {string} skillName
 * @returns {number}
 */
export function totalHoursForSkill(entries, skillName) {
  return entries
    .filter(e => e.habit_id === 'skill_hour' && e.content?.skill === skillName)
    .reduce((sum, e) => sum + (e.content?.duration_minutes ?? 0), 0) / 60;
}

/**
 * Weekly hours logged for a specific skill over the last numWeeks weeks.
 *
 * @param {Array}  entries
 * @param {string} skillName
 * @param {Date}   today
 * @param {number} numWeeks
 * @returns {Array<{ weekStart: string, weekEnd: string, label: string, hours: number }>}
 */
export function computeWeeklySkillHours(entries, skillName, today, numWeeks = 12) {
  const windows      = buildWeekWindows(today, numWeeks);
  const skillEntries = entries.filter(e => e.habit_id === 'skill_hour' && e.content?.skill === skillName);
  return windows.map(w => {
    const minutes = skillEntries
      .filter(e => e.entry_date >= w.weekStart && e.entry_date <= w.weekEnd)
      .reduce((sum, e) => sum + (e.content?.duration_minutes ?? 0), 0);
    return { ...w, hours: minutes / 60 };
  });
}

// ── FR#196 — Energy ecology panel ────────────────────────────────────────────

/**
 * Group energy_audit entries by week, newest first.
 * Weeks with no entries are omitted.
 *
 * @param {Array}  entries
 * @param {Date}   today
 * @param {number} numWeeks
 * @returns {Array<{ weekStart: string, weekEnd: string, label: string, drain: string[], regenerate: string[] }>}
 */
export function computeWeeklyEnergy(entries, today, numWeeks = 12) {
  const windows      = buildWeekWindows(today, numWeeks).reverse(); // newest first
  const energyEntries = entries.filter(e => e.habit_id === 'energy_audit');
  return windows
    .map(w => {
      const weekEntries = energyEntries.filter(
        e => e.entry_date >= w.weekStart && e.entry_date <= w.weekEnd
      );
      return {
        ...w,
        drain:      weekEntries.map(e => e.content?.drain).filter(Boolean),
        regenerate: weekEntries.map(e => e.content?.regenerate).filter(Boolean),
      };
    })
    .filter(w => w.drain.length > 0 || w.regenerate.length > 0);
}

// ── FR#198 — Task throughput ─────────────────────────────────────────────────

/**
 * Count tasks completed (via completedDate) per week.
 * Tasks without completedDate are excluded.
 *
 * @param {Array}  tasks
 * @param {Date}   today
 * @param {number} numWeeks
 * @returns {Array<{ weekStart: string, weekEnd: string, label: string, count: number }>}
 */
export function computeWeeklyThroughput(tasks, today, numWeeks = 24) {
  const windows        = buildWeekWindows(today, numWeeks);
  const completedTasks = tasks.filter(t => t.done && t.completedDate);
  return windows.map(w => ({
    ...w,
    count: completedTasks.filter(
      t => t.completedDate >= w.weekStart && t.completedDate <= w.weekEnd
    ).length,
  }));
}
