// src/features/habits/habitsUtils.test.js
import { describe, it, expect } from 'vitest';
import {
  toDateString,
  getWeekBounds,
  isWeekend,
  isRequiredDay,
  computeHabitStatus,
  buildHeatmapData,
  entryDateSet,
  computeStreakMetrics,
} from './habitsUtils.js';

// ── toDateString ─────────────────────────────────────────────────────────────

describe('toDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateString(new Date('2026-06-03T12:00:00'))).toBe('2026-06-03');
  });
  it('zero-pads month and day', () => {
    expect(toDateString(new Date('2026-01-05T00:00:00'))).toBe('2026-01-05');
  });
});

// ── getWeekBounds ─────────────────────────────────────────────────────────────

describe('getWeekBounds', () => {
  it('returns Mon-Sun for a Wednesday', () => {
    const { weekStart, weekEnd } = getWeekBounds(new Date('2026-06-03T00:00:00')); // Wednesday
    expect(weekStart).toBe('2026-06-01');
    expect(weekEnd).toBe('2026-06-07');
  });
  it('handles Sunday correctly (Sunday is end of week)', () => {
    const { weekStart, weekEnd } = getWeekBounds(new Date('2026-06-07T00:00:00')); // Sunday
    expect(weekStart).toBe('2026-06-01');
    expect(weekEnd).toBe('2026-06-07');
  });
  it('handles Monday correctly', () => {
    const { weekStart, weekEnd } = getWeekBounds(new Date('2026-06-01T00:00:00')); // Monday
    expect(weekStart).toBe('2026-06-01');
    expect(weekEnd).toBe('2026-06-07');
  });
});

// ── isWeekend ─────────────────────────────────────────────────────────────────

describe('isWeekend', () => {
  it('Saturday is weekend', () => expect(isWeekend('2026-06-06')).toBe(true));
  it('Sunday is weekend',   () => expect(isWeekend('2026-06-07')).toBe(true));
  it('Monday is not weekend', () => expect(isWeekend('2026-06-01')).toBe(false));
  it('Friday is not weekend', () => expect(isWeekend('2026-06-05')).toBe(false));
});

// ── isRequiredDay ─────────────────────────────────────────────────────────────

describe('isRequiredDay', () => {
  it('skill_hour: weekday is required', () => {
    expect(isRequiredDay('skill_hour', '2026-06-03')).toBe(true); // Wednesday
  });
  it('skill_hour: Saturday is not required', () => {
    expect(isRequiredDay('skill_hour', '2026-06-06')).toBe(false);
  });
  it('skill_hour: Sunday is not required', () => {
    expect(isRequiredDay('skill_hour', '2026-06-07')).toBe(false);
  });
  it('evidence_journal: every day is required', () => {
    expect(isRequiredDay('evidence_journal', '2026-06-07')).toBe(true); // Sunday
    expect(isRequiredDay('evidence_journal', '2026-06-06')).toBe(true); // Saturday
  });
});

// ── computeHabitStatus — streak habits ───────────────────────────────────────

describe('computeHabitStatus — evidence_journal (daily streak)', () => {
  const today = new Date('2026-06-03T12:00:00'); // Wednesday

  it('status is done when entry exists for today', () => {
    const entries = [{ habit_id: 'evidence_journal', entry_date: '2026-06-03', content: {} }];
    const { status } = computeHabitStatus('evidence_journal', entries, today);
    expect(status).toBe('done');
  });

  it('status is due when no entry for today', () => {
    const { status } = computeHabitStatus('evidence_journal', [], today);
    expect(status).toBe('due');
  });

  it('currentStreak counts consecutive days ending yesterday when today is missing', () => {
    const entries = [
      { habit_id: 'evidence_journal', entry_date: '2026-06-01', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-02', content: {} },
    ];
    const { currentStreak } = computeHabitStatus('evidence_journal', entries, today);
    expect(currentStreak).toBe(2);
  });

  it('currentStreak is 5 with 5 consecutive completed days including today', () => {
    const entries = [
      { habit_id: 'evidence_journal', entry_date: '2026-05-30', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-05-31', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-01', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-02', content: {} },
      { habit_id: 'evidence_journal', entry_date: '2026-06-03', content: {} },
    ];
    const { currentStreak } = computeHabitStatus('evidence_journal', entries, today);
    expect(currentStreak).toBe(5);
  });
});

describe('computeHabitStatus — skill_hour (weekday streak)', () => {
  // Today is Wednesday 2026-06-03
  const today = new Date('2026-06-03T12:00:00');

  it('status is done when entry exists for today (weekday)', () => {
    const entries = [{ habit_id: 'skill_hour', entry_date: '2026-06-03', content: {} }];
    const { status } = computeHabitStatus('skill_hour', entries, today);
    expect(status).toBe('done');
  });

  it('status is due when no entry today (weekday)', () => {
    const { status } = computeHabitStatus('skill_hour', [], today);
    expect(status).toBe('due');
  });
});

// ── computeHabitStatus — periodic habits ─────────────────────────────────────

describe('computeHabitStatus — friction_audit (weekly periodic)', () => {
  // Today is Wednesday 2026-06-03 (week: Mon Jun 1 – Sun Jun 7)
  const today = new Date('2026-06-03T12:00:00');

  it('status is done when entry exists this week', () => {
    const entries = [{ habit_id: 'friction_audit', entry_date: '2026-06-02', content: {} }];
    const { status } = computeHabitStatus('friction_audit', entries, today);
    expect(status).toBe('done');
  });

  it('status is due when no entry this week but has entry within 14 days', () => {
    const entries = [{ habit_id: 'friction_audit', entry_date: '2026-05-27', content: {} }];
    const { status } = computeHabitStatus('friction_audit', entries, today);
    expect(status).toBe('due');
  });

  it('status is overdue when last entry was more than 14 days ago', () => {
    const entries = [{ habit_id: 'friction_audit', entry_date: '2026-05-15', content: {} }];
    const { status } = computeHabitStatus('friction_audit', entries, today);
    expect(status).toBe('overdue');
  });

  it('status is overdue when no entries exist', () => {
    const { status } = computeHabitStatus('friction_audit', [], today);
    expect(status).toBe('overdue');
  });
});

// ── buildHeatmapData ──────────────────────────────────────────────────────────

describe('buildHeatmapData', () => {
  const today = new Date('2026-06-03T12:00:00');

  it('returns exactly 90 entries', () => {
    const data = buildHeatmapData('evidence_journal', [], today);
    expect(data).toHaveLength(90);
  });

  it('last entry is today', () => {
    const data = buildHeatmapData('evidence_journal', [], today);
    expect(data[data.length - 1].date).toBe('2026-06-03');
  });

  it('marks completed days correctly', () => {
    const entries = [{ habit_id: 'evidence_journal', entry_date: '2026-06-01', content: {} }];
    const data = buildHeatmapData('evidence_journal', entries, today);
    const june1 = data.find(d => d.date === '2026-06-01');
    expect(june1.completed).toBe(true);
  });

  it('marks non-required days for skill_hour on weekends', () => {
    const data = buildHeatmapData('skill_hour', [], today);
    const saturday = data.find(d => d.date === '2026-05-30');
    expect(saturday.required).toBe(false);
  });

  it('marks required days for skill_hour on weekdays', () => {
    const data = buildHeatmapData('skill_hour', [], today);
    const wednesday = data.find(d => d.date === '2026-06-03');
    expect(wednesday.required).toBe(true);
  });
});
