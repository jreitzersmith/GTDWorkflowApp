// src/features/habits/ScoreVsThroughput.jsx
// FR#198 — Overlay chart: habits score vs task throughput per week.
// Stacked layout: score line (top), shared x-axis, throughput bars (bottom).

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { computeWeeklyScores, computeWeeklyThroughput } from './analyticsUtils.js';

const NUM_WEEKS    = 24;
const SVG_W        = 520;
const PAD          = { l: 32, r: 12 };
const PLOT_W       = SVG_W - PAD.l - PAD.r;
const SCORE_H      = 100;  // height of score section
const AXIS_H       = 24;   // shared x-axis labels section
const BARS_H       = 70;   // height of throughput bars section
const SVG_H        = SCORE_H + AXIS_H + BARS_H;
const SCORE_COLOR  = '#5a8fd4'; // accent
const BAR_COLOR    = '#81c784'; // green

function ScoreVsThroughput({ entries, tasks, today }) {
  const scores     = useMemo(() => computeWeeklyScores(entries, today, NUM_WEEKS),     [entries, today]);
  const throughput = useMemo(() => computeWeeklyThroughput(tasks, today, NUM_WEEKS),   [tasks, today]);

  const n          = scores.length;
  const maxScore   = 5;
  const maxCount   = Math.max(...throughput.map(w => w.count), 1);

  // No data at all
  const hasAnyScore      = scores.some(w => w.score > 0);
  const hasAnyThroughput = throughput.some(w => w.count > 0);

  const labelFreq = 4;
  const barW      = PLOT_W / n * 0.6;

  const xOf = i => PAD.l + (i + 0.5) * (PLOT_W / n);

  // Score section (0=top of score area, positive=down)
  const syOf = score => SCORE_H * 0.08 + (SCORE_H * 0.84) - (score / maxScore) * (SCORE_H * 0.84);

  // Throughput bars (bottom section, measured from its own top)
  const barTopY  = SCORE_H + AXIS_H;
  const barsPlot = BARS_H * 0.85;

  const scorePoints = scores.map((w, i) => `${xOf(i)},${syOf(w.score)}`).join(' ');

  // Compute correlation coefficient for annotation
  const correlation = useMemo(() => {
    if (n < 3 || !hasAnyScore || !hasAnyThroughput) return null;
    const xs   = scores.map(w => w.score);
    const ys   = throughput.map(w => w.count);
    const xMean = xs.reduce((a, b) => a + b, 0) / n;
    const yMean = ys.reduce((a, b) => a + b, 0) / n;
    const num   = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0);
    const den   = Math.sqrt(
      xs.reduce((s, x) => s + (x - xMean) ** 2, 0) *
      ys.reduce((s, y) => s + (y - yMean) ** 2, 0)
    );
    return den === 0 ? 0 : num / den;
  }, [scores, throughput, n, hasAnyScore, hasAnyThroughput]);

  if (!hasAnyScore && !hasAnyThroughput) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
        Start logging habits and completing tasks to see the SOrg correlation chart.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Score vs Task Throughput
        </div>
        {correlation !== null && (
          <div style={{ fontSize: 11, color: COLORS.text2 }}>
            r = <span style={{ color: Math.abs(correlation) > 0.4 ? SCORE_COLOR : COLORS.muted, fontWeight: 500 }}>
              {correlation.toFixed(2)}
            </span>
            <span style={{ color: COLORS.muted, marginLeft: 6 }}>
              ({Math.abs(correlation) > 0.6 ? 'strong' : Math.abs(correlation) > 0.3 ? 'moderate' : 'weak'}{correlation >= 0 ? ' positive' : ' negative'})
            </span>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', maxWidth: SVG_W, height: SVG_H, display: 'block' }}>
        {/* Score section Y axis label */}
        <text x={PAD.l - 4} y={syOf(5)} fontSize={8} fill={COLORS.muted} textAnchor="end">5</text>
        <text x={PAD.l - 4} y={syOf(0) + 3} fontSize={8} fill={COLORS.muted} textAnchor="end">0</text>
        <text x={PAD.l - 4} y={SCORE_H / 2} fontSize={7} fill={COLORS.muted} textAnchor="end" transform={`rotate(-90,${PAD.l - 14},${SCORE_H / 2})`}>Score</text>

        {/* Score gridlines */}
        {[0, 1, 2, 3, 4, 5].map(s => (
          <line key={s}
            x1={PAD.l} y1={syOf(s)} x2={PAD.l + PLOT_W} y2={syOf(s)}
            stroke={COLORS.border} strokeWidth={0.4}
          />
        ))}

        {/* Score line */}
        {hasAnyScore && (
          <>
            <polyline
              points={scorePoints}
              fill="none"
              stroke={SCORE_COLOR}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {scores.map((w, i) => w.score > 0 && (
              <circle key={w.weekStart} cx={xOf(i)} cy={syOf(w.score)} r={2.5}
                fill={COLORS.surface} stroke={SCORE_COLOR} strokeWidth={1.2} />
            ))}
          </>
        )}

        {/* Divider line between sections */}
        <line
          x1={PAD.l} y1={SCORE_H + AXIS_H - 1} x2={PAD.l + PLOT_W} y2={SCORE_H + AXIS_H - 1}
          stroke={COLORS.border} strokeWidth={0.5}
        />

        {/* Shared X axis labels */}
        {scores.map((w, i) => {
          if (i % labelFreq !== 0) return null;
          return (
            <text key={w.weekStart}
              x={xOf(i)} y={SCORE_H + AXIS_H - 6}
              fontSize={8} fill={COLORS.muted} textAnchor="middle"
            >
              {w.label}
            </text>
          );
        })}

        {/* Throughput bars */}
        {throughput.map((w, i) => {
          if (w.count === 0) return null;
          const barH = (w.count / maxCount) * barsPlot;
          return (
            <rect key={w.weekStart}
              x={xOf(i) - barW / 2}
              y={barTopY + barsPlot - barH}
              width={barW}
              height={barH}
              fill={BAR_COLOR}
              opacity={0.7}
              rx={2}
            />
          );
        })}

        {/* Throughput Y axis label */}
        <text x={PAD.l - 4} y={barTopY + 8} fontSize={8} fill={COLORS.muted} textAnchor="end">{maxCount}</text>
        <text x={PAD.l - 4} y={barTopY + barsPlot} fontSize={8} fill={COLORS.muted} textAnchor="end">0</text>
        <text x={PAD.l - 4} y={barTopY + barsPlot / 2} fontSize={7} fill={COLORS.muted} textAnchor="end" transform={`rotate(-90,${PAD.l - 14},${barTopY + barsPlot / 2})`}>Tasks</text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 11, color: COLORS.text2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 16, height: 2, background: SCORE_COLOR, borderRadius: 1 }} />
          Habits score (0–5)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 10, background: BAR_COLOR, opacity: 0.7, borderRadius: 2 }} />
          Tasks completed
        </div>
        {!hasAnyThroughput && (
          <div style={{ color: COLORS.muted, fontStyle: 'italic' }}>
            No task completion dates logged yet
          </div>
        )}
      </div>
    </div>
  );
}

ScoreVsThroughput.propTypes = {
  entries: PropTypes.array.isRequired,
  tasks:   PropTypes.array.isRequired,
  today:   PropTypes.instanceOf(Date).isRequired,
};

export { ScoreVsThroughput };
