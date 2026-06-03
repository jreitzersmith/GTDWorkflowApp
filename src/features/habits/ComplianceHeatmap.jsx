// src/features/habits/ComplianceHeatmap.jsx
// FR#194 — 12-week compliance heatmap: one row per habit, weekly done/missed cells.

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { HABITS, HABIT_ORDER } from './habitsUtils.js';
import { buildComplianceMatrix } from './analyticsUtils.js';

const NUM_WEEKS = 12;

function ComplianceHeatmap({ entries, today }) {
  const matrix = useMemo(
    () => buildComplianceMatrix(entries, today, NUM_WEEKS),
    [entries, today]
  );

  const cellW    = 32;
  const cellH    = 26;
  const labelW   = 108;
  const headerH  = 28;
  const rowGap   = 4;
  const colGap   = 3;

  const gridW  = NUM_WEEKS * cellW + (NUM_WEEKS - 1) * colGap;
  const gridH  = HABIT_ORDER.length * cellH + (HABIT_ORDER.length - 1) * rowGap;

  // Show every-other week label to avoid overlap
  const labelFreq = 2;

  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.text2, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        12-Week Compliance
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', overflowX: 'auto' }}>
        {/* Row labels */}
        <div style={{ flexShrink: 0, width: labelW }}>
          {/* Spacer for week header */}
          <div style={{ height: headerH }} />
          {HABIT_ORDER.map((habitId, ri) => {
            const habit = HABITS[habitId];
            return (
              <div
                key={habitId}
                style={{
                  height: cellH,
                  marginBottom: ri < HABIT_ORDER.length - 1 ? rowGap : 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>{habit.emoji}</span>
                <span style={{ fontSize: 11, color: COLORS.text2, whiteSpace: 'nowrap' }}>
                  {habit.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div style={{ flexShrink: 0 }}>
          {/* Week headers */}
          <div style={{ display: 'flex', gap: colGap, height: headerH, alignItems: 'flex-end', paddingBottom: 4 }}>
            {matrix.map((w, ci) => (
              <div
                key={w.weekStart}
                style={{
                  width: cellW,
                  fontSize: 9,
                  color: COLORS.muted,
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  opacity: ci % labelFreq === 0 ? 1 : 0,
                }}
              >
                {w.label}
              </div>
            ))}
          </div>

          {/* Habit rows */}
          {HABIT_ORDER.map((habitId, ri) => {
            const habit = HABITS[habitId];
            return (
              <div
                key={habitId}
                style={{
                  display: 'flex',
                  gap: colGap,
                  marginBottom: ri < HABIT_ORDER.length - 1 ? rowGap : 0,
                }}
              >
                {matrix.map(w => {
                  const done = w.done[habitId];
                  return (
                    <div
                      key={w.weekStart}
                      title={`${habit.label} — week of ${w.label}: ${done ? 'Done' : 'Missed'}`}
                      style={{
                        width:        cellW,
                        height:       cellH,
                        borderRadius: 4,
                        background:   done ? habit.color : COLORS.surface3,
                        opacity:      done ? 0.85 : 1,
                        flexShrink:   0,
                        cursor:       'default',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: COLORS.text2 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#7986cb' }} />
          Done
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: COLORS.text2 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: COLORS.surface3 }} />
          Missed
        </div>
      </div>
    </div>
  );
}

ComplianceHeatmap.propTypes = {
  entries: PropTypes.array.isRequired,
  today:   PropTypes.instanceOf(Date).isRequired,
};

export { ComplianceHeatmap };
