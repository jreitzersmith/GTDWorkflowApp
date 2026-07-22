// src/features/habits/habitsUtils.js
// Pure utility functions for habit tracking logic.
// No side effects — all functions take data as arguments and return computed results.

// ── Habit definitions ───────────────────────────────────────────────────────

export const HABITS = {
  friction_audit: {
    id: 'friction_audit',
    label: 'Friction Audit',
    description: 'What is making good behaviour harder than it needs to be?',
    cadence: 'weekly',
    color: '#ff8a65',
    emoji: '🔧',
    type: 'periodic',
  },
  skill_hour: {
    id: 'skill_hour',
    label: 'Skill Hour',
    description: '60 minutes of deliberate practice on your chosen skill.',
    cadence: 'weekdays',
    color: '#7986cb',
    emoji: '🎯',
    type: 'streak',
  },
  evidence_journal: {
    id: 'evidence_journal',
    label: 'Evidence Journal',
    description: 'Three specific pieces of evidence you acted in alignment with your values.',
    cadence: 'daily',
    color: '#4db6ac',
    emoji: '📓',
    type: 'streak',
  },
  strategic_review: {
    id: 'strategic_review',
    label: 'Strategic Review',
    description: 'Weekly confrontation with the gap between who you are being and who you are committed to becoming.',
    cadence: 'weekly',
    color: '#81c784',
    emoji: '🧭',
    type: 'periodic',
  },
  energy_audit: {
    id: 'energy_audit',
    label: 'Energy Audit',
    description: 'One drain, one regenerator. Build your personal energy ecology.',
    cadence: 'weekly',
    color: '#f48fb1',
    emoji: '⚡',
    type: 'periodic',
  },
};

export const HABIT_ORDER = [
  'friction_audit',
  'skill_hour',
  'evidence_journal',
  'strategic_review',
  'energy_audit',
];

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Format a Date as 'YYYY-MM-DD' in local time.
 * @param {Date} date
 * @returns {string}
 */
export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Return the Monday and Sunday bounding the week that contains `date`.
 * @param {Date} date
 * @returns {{ weekStart: string, weekEnd: string }}
 */
export function getWeekBounds(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon … 6=Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { weekStart: toDateString(monday), weekEnd: toDateString(sunday) };
}

/**
 * Returns true when `dateStr` (YYYY-MM-DD) falls on a Saturday or Sunday.
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

/**
 * Returns true when the given date is a required day for the habit.
 * skill_hour skips weekends; evidence_journal is every day.
 * @param {string} habitId
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {boolean}
 */
export function isRequiredDay(habitId, dateStr) {
  if (habitId === 'skill_hour') return !isWeekend(dateStr);
  return true;
}

// ── Streak computation ────────────────────────────────────────────────────────

/**
 * Build a Set of entry_date strings for a given habitId from the entries array.
 * @param {Array<{habit_id: string, entry_date: string, content: object}>} entries
 * @param {string} habitId
 * @returns {Set<string>}
 */
export function entryDateSet(entries, habitId) {
  return new Set(
    entries
      .filter(e => e.habit_id === habitId)
      .map(e => e.entry_date)
  );
}

/**
 * Compute streak metrics for a streak-type habit.
 * A "day" only counts if isRequiredDay returns true for that habitId.
 *
 * @param {string} habitId
 * @param {Set<string>} doneDates  - set of YYYY-MM-DD strings with entries
 * @param {Date}   today
 * @returns {{ currentStreak: number, bestStreak: number }}
 */
export function computeStreakMetrics(habitId, doneDates, today) {
  const todayStr = toDateString(today);

  // Walk backwards from today to measure current streak
  let currentStreak = 0;
  const cursor = new Date(today);
  while (true) {
    const ds = toDateString(cursor);
    if (!isRequiredDay(habitId, ds)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (doneDates.has(ds)) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      // Allow a miss on today without breaking the streak — treat today as still pending
      if (ds === todayStr) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
  }

  // Walk all dates in doneDates to find best streak
  if (doneDates.size === 0) return { currentStreak: 0, bestStreak: 0 };

  const sorted = [...doneDates].sort();
  let best = 0;
  let run = 0;
  let prevDate = null;

  for (const ds of sorted) {
    if (!isRequiredDay(habitId, ds)) continue;
    if (prevDate === null) {
      run = 1;
    } else {
      // Check consecutive required days
      const prev = new Date(prevDate + 'T00:00:00');
      const curr = new Date(ds + 'T00:00:00');
      const gap = (curr - prev) / 86400000;
      if (gap === 1) {
        run++;
      } else if (gap === 2 && !isRequiredDay(habitId, toDateString(new Date(prev.getTime() + 86400000)))) {
        // gap day is a weekend skip — still consecutive
        run++;
      } else {
        run = 1;
      }
    }
    if (run > best) best = run;
    prevDate = ds;
  }

  return { currentStreak, bestStreak: best };
}

// ── Status computation ────────────────────────────────────────────────────────

/**
 * Compute the display status for a habit.
 *
 * Streak habits: 'done' if has entry today (or today is not required), 'due' otherwise.
 * Periodic habits: 'done' if has entry this week, 'due' if none this week,
 *                  'overdue' if no entry in the past 14 days.
 *
 * @param {string} habitId
 * @param {Array}  entries
 * @param {Date}   today
 * @returns {{ status: 'done'|'due'|'overdue', currentStreak: number, bestStreak: number }}
 */
export function computeHabitStatus(habitId, entries, today) {
  const habit = HABITS[habitId];
  const done = entryDateSet(entries, habitId);
  const todayStr = toDateString(today);

  if (habit.type === 'streak') {
    const { currentStreak, bestStreak } = computeStreakMetrics(habitId, done, today);
    const todayRequired = isRequiredDay(habitId, todayStr);
    const doneToday = done.has(todayStr);
    const status = (!todayRequired || doneToday) ? 'done' : 'due';
    return { status, currentStreak, bestStreak };
  }

  // Periodic habit
  const { weekStart, weekEnd } = getWeekBounds(today);
  const hasThisWeek = [...done].some(ds => ds >= weekStart && ds <= weekEnd);
  if (hasThisWeek) return { status: 'done', currentStreak: 0, bestStreak: 0 };

  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);
  const twoWeeksAgoStr = toDateString(twoWeeksAgo);
  const hasRecent = [...done].some(ds => ds >= twoWeeksAgoStr);
  const status = hasRecent ? 'due' : 'overdue';
  return { status, currentStreak: 0, bestStreak: 0 };
}

// ── Heatmap data ──────────────────────────────────────────────────────────────

/**
 * Build an array of 90 day-objects for the heatmap, ending on `today`.
 * Each object: { date: 'YYYY-MM-DD', completed: boolean, required: boolean }
 *
 * @param {string} habitId
 * @param {Array}  entries
 * @param {Date}   today
 * @returns {Array<{ date: string, completed: boolean, required: boolean }>}
 */
export function buildHeatmapData(habitId, entries, today) {
  const done = entryDateSet(entries, habitId);
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = toDateString(d);
    days.push({
      date: ds,
      completed: done.has(ds),
      required: isRequiredDay(habitId, ds),
    });
  }
  return days;
}

// ── Multi-entry habit classification ─────────────────────────────────────────

/**
 * Habits that allow multiple entries per day/week.
 * All others allow exactly one entry per period (today for streak, this week for periodic).
 */
export const MULTI_ENTRY_HABITS = new Set(['friction_audit', 'skill_hour']);

/** Returns true if this habit allows multiple entries per period. */
export function isMultiEntry(habitId) {
  return MULTI_ENTRY_HABITS.has(habitId);
}

// ── Skill Hour helpers ────────────────────────────────────────────────────────

/**
 * All unique skills that appear in skill_hour entries, merged with config skills.
 * Config skills are listed first (preserving user-defined order).
 *
 * @param {Array}    entries
 * @param {string[]} configSkills  - from habitsConfig.skills
 * @returns {string[]}
 */
export function getTrackedSkills(entries, configSkills = []) {
  const fromEntries = entries
    .filter(e => e.habit_id === 'skill_hour' && e.content?.skill)
    .map(e => e.content.skill);
  const merged = [...configSkills];
  fromEntries.forEach(s => { if (!merged.includes(s)) merged.push(s); });
  return merged;
}

/**
 * Build 90-day heatmap data for a single skill within skill_hour entries.
 * Days where that skill was practiced are marked completed.
 *
 * @param {Array}  entries
 * @param {string} skillName
 * @param {Date}   today
 * @returns {Array<{ date: string, completed: boolean, required: boolean }>}
 */
export function buildSkillHeatmapData(entries, skillName, today) {
  const skillEntries = entries.filter(
    e => e.habit_id === 'skill_hour' && e.content?.skill === skillName
  );
  return buildHeatmapData('skill_hour', skillEntries, today);
}

/**
 * Total minutes logged for a specific skill.
 * @param {Array}  entries
 * @param {string} skillName
 * @returns {number}
 */
export function totalSkillMinutes(entries, skillName) {
  return entries
    .filter(e => e.habit_id === 'skill_hour' && e.content?.skill === skillName)
    .reduce((sum, e) => sum + (e.content?.duration_minutes ?? 0), 0);
}
