// src/features/habits/ScoreTrend.jsx
// FR#197 — Weekly habits score trend: 0-5 score per week line chart over 24 weeks.

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { computeWeeklyScores } from './analyticsUtils.js';

const NUM_WEEKS  = 24;
const SVG_W      = 520;
const SVG_H      = 160;
const PAD        = { l: 28, r: 12, t: 12, b: 32 };
const PLOT_W     = SVG_W - PAD.l - PAD.r;
const PLOT_H     = SVG_H - PAD.t - PAD.b;
const MAX_SCORE  = 5;
const LINE_COLOR = '#5a8fd4'; // accent

function ScoreTrend({ entries, today }) {
  const weekly = useMemo(
    () => computeWeeklyScores(entries, today, NUM_WEEKS),
    [entries, today]
  );

  const n = weekly.length;
  if (n === 0) return null;

  // Coordinate helpers
  const xOf = i => PAD.l + (i / (n - 1)) * PLOT_W;
  const yOf = score => PAD.t + PLOT_H - (score / MAX_SCORE) * PLOT_H;

  // Build polyline points
  const points = weekly.map((w, i) => `${xOf(i)},${yOf(w.score)}`).join(' ');

  // Y gridlines at 0,1,2,3,4,5
  const yGridLines = [0, 1, 2, 3, 4, 5];

  // X axis: show label every 4 weeks
  const labelFreq = 4;

  // Average
  const avg = weekly.reduce((s, w) => s + w.score, 0) / n;

  return (
    <div style={{ padding: '16px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Weekly Score Trend
        </div>
        <div style={{ fontSize: 11, color: COLORS.text2 }}>
          Avg: <span style={{ color: LINE_COLOR, fontWeight: 500 }}>{avg.toFixed(1)}</span> / 5 over {NUM_WEEKS} weeks
        </div>
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', maxWidth: SVG_W, height: SVG_H, display: 'block' }}>
        {/* Y gridlines + labels */}
        {yGridLines.map(score => {
          const y = yOf(score);
          return (
            <g key={score}>
              <line
                x1={PAD.l} y1={y} x2={PAD.l + PLOT_W} y2={y}
                stroke={COLORS.border} strokeWidth={0.4} strokeOpacity={0.45}
              />
              <text
                x={PAD.l - 4} y={y + 4}
                fontSize={9} fill={COLORS.muted} textAnchor="end" opacity={0.6}
              >
                {score}
              </text>
            </g>
          );
        })}

        {/* Average line */}
        <line
          x1={PAD.l} y1={yOf(avg)} x2={PAD.l + PLOT_W} y2={yOf(avg)}
          stroke={LINE_COLOR} strokeWidth={0.8} strokeDasharray="3,3" opacity={0.4}
        />

        {/* Score line */}
        <polyline
          points={points}
          fill="none"
          stroke={LINE_COLOR}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data dots */}
        {weekly.map((w, i) => (
          <circle
            key={w.weekStart}
            cx={xOf(i)}
            cy={yOf(w.score)}
            r={w.score === 5 ? 4 : 2.5}
            fill={w.score === 5 ? LINE_COLOR : COLORS.surface}
            stroke={LINE_COLOR}
            strokeWidth={1.2}
          />
        ))}

        {/* X axis week labels */}
        {weekly.map((w, i) => {
          if (i % labelFreq !== 0) return null;
          return (
            <text
              key={w.weekStart}
              x={xOf(i)}
              y={SVG_H - 4}
              fontSize={8}
              fill={COLORS.muted}
              textAnchor="middle"
            >
              {w.label}
            </text>
          );
        })}

        {/* X baseline */}
        <line
          x1={PAD.l} y1={PAD.t + PLOT_H} x2={PAD.l + PLOT_W} y2={PAD.t + PLOT_H}
          stroke={COLORS.border} strokeWidth={0.4} strokeOpacity={0.45}
        />
      </svg>

      {/* Score legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: COLORS.muted }}>
        {[0,1,2,3,4,5].map(s => (
          <span key={s} style={{ color: s <= Math.round(avg) ? LINE_COLOR : COLORS.muted }}>
            {s} = {['none','1 habit','2 habits','3 habits','4 habits','all 5'][s]}
          </span>
        ))}
      </div>
    </div>
  );
}

ScoreTrend.propTypes = {
  entries: PropTypes.array.isRequired,
  today:   PropTypes.instanceOf(Date).isRequired,
};

export { ScoreTrend };
