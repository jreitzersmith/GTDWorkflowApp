// src/features/habits/analyticsUtils.test.js
import { describe, it, expect } from 'vitest';
import {
  buildWeekWindows,
  habitDoneForWeek,
  buildComplianceMatrix,
  computeWeeklyScores,
  totalHoursForSkill,
  computeWeeklySkillHours,
  computeWeeklyEnergy,
  computeWeeklyThroughput,
} from './analyticsUtils.js';

const TODAY = new Date('2026-06-03T12:00:00'); // Wednesday — week: 2026-06-01 to 2026-06-07

// ── buildWeekWindows ──────────────────────────────────────────────────────────

describe('buildWeekWindows', () => {
  it('returns the correct number of windows', () => {
    expect(buildWeekWindows(TODAY, 4)).toHaveLength(4);
    expect(buildWeekWindows(TODAY, 12)).toHaveLength(12);
  });

  it('last window ends on the current week (Mon-Sun containing today)', () => {
    const windows = buildWeekWindows(TODAY, 4);
    const last = windows[windows.length - 1];
    expect(last.weekStart).toBe('2026-06-01');
    expect(last.weekEnd).toBe('2026-06-07');
  });

  it('windows are in ascending order (oldest first)', () => {
    const windows = buildWeekWindows(TODAY, 4);
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i].weekStart > windows[i - 1].weekStart).toBe(true);
    }
  });

  it('each window is exactly 7 days wide', () => {
    const windows = buildWeekWindows(TODAY, 4);
    windows.forEach(w => {
      const start = new Date(w.weekStart + 'T00:00:00');
      const end   = new Date(w.weekEnd   + 'T00:00:00');
      const diff  = (end - start) / 86400000;
      expect(diff).toBe(6);
    });
  });

  it('consecutive windows are adjacent (no gaps)', () => {
    const windows = buildWeekWindows(TODAY, 3);
    for (let i = 1; i < windows.length; i++) {
      const prevEnd  = new Date(windows[i - 1].weekEnd   + 'T00:00:00');
      const currStart = new Date(windows[i].weekStart    + 'T00:00:00');
      expect((currStart - prevEnd) / 86400000).toBe(1);
    }
  });
});

// ── habitDoneForWeek ──────────────────────────────────────────────────────────

describe('habitDoneForWeek', () => {
  const WEEK_START = '2026-06-01';
  const WEEK_END   = '2026-06-07';

  it('periodic habit (friction_audit): done with 1 entry', () => {
    const entries = [{ habit_id: 'friction_audit', entry_date: '2026-06-02', content: {} }];
    expect(habitDoneForWeek('friction_audit', entries, WEEK_START, WEEK_END)).toBe(true);
  });

  it('periodic habit: not done with 0 entries', () => {
    expect(habitDoneForWeek('friction_audit', [], WEEK_START, WEEK_END)).toBe(false);
  });

  it('skill_hour: done with 3+ entries', () => {
    const entries = [
      { habit_id: 'skill_hour', entry_date: '2026-06-01', content: {} },
      { habit_id: 'skill_hour', entry_date: '2026-06-02', content: {} },
      { habit_id: 'skill_hour', entry_date: '2026-06-03', content: {} },
    ];
    expect(habitDoneForWeek('skill_hour', entries, WEEK_START, WEEK_END)).toBe(true);
  });

  it('skill_hour: not done with fewer than 3 entries', () => {
    const entries = [
      { habit_id: 'skill_hour', entry_date: '2026-06-01', content: {} },
      { habit_id: 'skill_hour', entry_date: '2026-06-02', content: {} },
    ];
    expect(habitDoneForWeek('skill_hour', entries, WEEK_START, WEEK_END)).toBe(false);
  });

  it('evidence_journal: done with 4+ entries', () => {
    const entries = [
      { habit_id: 'evidence_journal', entry_date: '2026-06-01', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-02', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-03', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-04', content: {} },
    ];
    expect(habitDoneForWeek('evidence_journal', entries, WEEK_START, WEEK_END)).toBe(true);
  });

  it('evidence_journal: not done with fewer than 4 entries', () => {
    const entries = [
      { habit_id: 'evidence_journal', entry_date: '2026-06-01', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-02', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-03', content: {} },
    ];
    expect(habitDoneForWeek('evidence_journal', entries, WEEK_START, WEEK_END)).toBe(false);
  });

  it('ignores entries outside the window', () => {
    const entries = [{ habit_id: 'friction_audit', entry_date: '2026-05-31', content: {} }];
    expect(habitDoneForWeek('friction_audit', entries, WEEK_START, WEEK_END)).toBe(false);
  });

  it('ignores entries for other habits', () => {
    const entries = [{ habit_id: 'energy_audit', entry_date: '2026-06-02', content: {} }];
    expect(habitDoneForWeek('friction_audit', entries, WEEK_START, WEEK_END)).toBe(false);
  });
});

// ── computeWeeklyScores ───────────────────────────────────────────────────────

describe('computeWeeklyScores', () => {
  it('returns 0 for all weeks when no entries', () => {
    const scores = computeWeeklyScores([], TODAY, 4);
    expect(scores).toHaveLength(4);
    scores.forEach(w => expect(w.score).toBe(0));
  });

  it('score is 5 when all habits are done in a week', () => {
    const entries = [
      // friction_audit — 1 entry (periodic, threshold 1)
      { habit_id: 'friction_audit', entry_date: '2026-06-02', content: {} },
      // strategic_review
      { habit_id: 'strategic_review', entry_date: '2026-06-02', content: {} },
      // energy_audit
      { habit_id: 'energy_audit', entry_date: '2026-06-02', content: {} },
      // evidence_journal — 4 entries (daily, threshold 4)
      { habit_id: 'evidence_journal', entry_date: '2026-06-01', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-02', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-03', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-04', content: {} },
      // skill_hour — 3 entries (weekday, threshold 3)
      { habit_id: 'skill_hour', entry_date: '2026-06-01', content: { skill: 'writing' } },
      { habit_id: 'skill_hour', entry_date: '2026-06-02', content: { skill: 'writing' } },
      { habit_id: 'skill_hour', entry_date: '2026-06-03', content: { skill: 'writing' } },
    ];
    const scores = computeWeeklyScores(entries, TODAY, 1);
    expect(scores[0].score).toBe(5);
  });

  it('score is 1 when only one periodic habit done', () => {
    const entries = [{ habit_id: 'friction_audit', entry_date: '2026-06-02', content: {} }];
    const scores = computeWeeklyScores(entries, TODAY, 1);
    expect(scores[0].score).toBe(1);
  });
});

// ── totalHoursForSkill ────────────────────────────────────────────────────────

describe('totalHoursForSkill', () => {
  const entries = [
    { habit_id: 'skill_hour', content: { skill: 'writing', duration_minutes: 60  } },
    { habit_id: 'skill_hour', content: { skill: 'writing', duration_minutes: 30  } },
    { habit_id: 'skill_hour', content: { skill: 'coding',  duration_minutes: 120 } },
  ];

  it('converts minutes to hours correctly', () => {
    expect(totalHoursForSkill(entries, 'writing')).toBe(1.5);
  });

  it('only counts the requested skill', () => {
    expect(totalHoursForSkill(entries, 'coding')).toBe(2);
  });

  it('returns 0 for unknown skill', () => {
    expect(totalHoursForSkill(entries, 'design')).toBe(0);
  });

  it('handles missing duration_minutes gracefully', () => {
    const sparse = [{ habit_id: 'skill_hour', content: { skill: 'writing' } }];
    expect(totalHoursForSkill(sparse, 'writing')).toBe(0);
  });
});

// ── computeWeeklySkillHours ───────────────────────────────────────────────────

describe('computeWeeklySkillHours', () => {
  it('sums hours for the correct week', () => {
    const entries = [
      { habit_id: 'skill_hour', entry_date: '2026-06-01', content: { skill: 'writing', duration_minutes: 60 } },
      { habit_id: 'skill_hour', entry_date: '2026-06-02', content: { skill: 'writing', duration_minutes: 30 } },
    ];
    const weekly = computeWeeklySkillHours(entries, 'writing', TODAY, 1);
    expect(weekly[0].hours).toBeCloseTo(1.5);
  });

  it('returns 0 hours for weeks with no entries', () => {
    const weekly = computeWeeklySkillHours([], 'writing', TODAY, 4);
    weekly.forEach(w => expect(w.hours).toBe(0));
  });
});

// ── computeWeeklyEnergy ───────────────────────────────────────────────────────

describe('computeWeeklyEnergy', () => {
  it('returns only weeks with entries', () => {
    const entries = [
      { habit_id: 'energy_audit', entry_date: '2026-06-02', content: { drain: 'meetings', regenerate: 'running' } },
    ];
    const energy = computeWeeklyEnergy(entries, TODAY, 12);
    expect(energy).toHaveLength(1);
    expect(energy[0].drain).toEqual(['meetings']);
    expect(energy[0].regenerate).toEqual(['running']);
  });

  it('returns newest week first', () => {
    const entries = [
      { habit_id: 'energy_audit', entry_date: '2026-06-02', content: { drain: 'recent', regenerate: '' } },
      { habit_id: 'energy_audit', entry_date: '2026-05-26', content: { drain: 'older',  regenerate: '' } },
    ];
    const energy = computeWeeklyEnergy(entries, TODAY, 12);
    expect(energy[0].drain[0]).toBe('recent');
    expect(energy[1].drain[0]).toBe('older');
  });

  it('filters out empty content fields', () => {
    const entries = [
      { habit_id: 'energy_audit', entry_date: '2026-06-02', content: { drain: '', regenerate: 'walking' } },
    ];
    const energy = computeWeeklyEnergy(entries, TODAY, 12);
    expect(energy[0].drain).toHaveLength(0);
    expect(energy[0].regenerate).toEqual(['walking']);
  });
});

// ── computeWeeklyThroughput ───────────────────────────────────────────────────

describe('computeWeeklyThroughput', () => {
  it('counts tasks by completedDate', () => {
    const tasks = [
      { done: true,  completedDate: '2026-06-02', id: '1' },
      { done: true,  completedDate: '2026-06-03', id: '2' },
      { done: false, completedDate: null,          id: '3' },
    ];
    const throughput = computeWeeklyThroughput(tasks, TODAY, 1);
    expect(throughput[0].count).toBe(2);
  });

  it('excludes tasks without completedDate', () => {
    const tasks = [{ done: true, id: '1' }]; // no completedDate
    const throughput = computeWeeklyThroughput(tasks, TODAY, 1);
    expect(throughput[0].count).toBe(0);
  });

  it('returns 0 for weeks with no completions', () => {
    const throughput = computeWeeklyThroughput([], TODAY, 4);
    throughput.forEach(w => expect(w.count).toBe(0));
  });
});
