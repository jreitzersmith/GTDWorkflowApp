// src/features/habits/SkillHoursPanel.jsx
// FR#195 — Skill Hour cumulative tracker: total hours per skill, 250h milestone, weekly sparkline.

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { getTrackedSkills } from './habitsUtils.js';
import { totalHoursForSkill, computeWeeklySkillHours } from './analyticsUtils.js';

const MILESTONE_HOURS = 250;
const SPARKLINE_WEEKS = 12;

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ weekly, color }) {
  const W = 200;
  const H = 36;
  const pad = { l: 2, r: 2, t: 4, b: 4 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const maxHours = Math.max(...weekly.map(w => w.hours), 1);
  const n        = weekly.length;

  if (n < 2) return null;

  const points = weekly.map((w, i) => {
    const x = pad.l + (i / (n - 1)) * plotW;
    const y = pad.t + plotH - (w.hours / maxHours) * plotH;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H, display: 'block' }}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
      {weekly.map((w, i) => {
        if (w.hours === 0) return null;
        const [x, y] = points[i].split(',').map(Number);
        return <circle key={w.weekStart} cx={x} cy={y} r={2} fill={color} opacity={0.9} />;
      })}
    </svg>
  );
}

Sparkline.propTypes = {
  weekly: PropTypes.array.isRequired,
  color:  PropTypes.string.isRequired,
};

// ── Skill row ─────────────────────────────────────────────────────────────────

function SkillRow({ skillName, entries, today, color }) {
  const totalHours = useMemo(() => totalHoursForSkill(entries, skillName), [entries, skillName]);
  const weekly     = useMemo(
    () => computeWeeklySkillHours(entries, skillName, today, SPARKLINE_WEEKS),
    [entries, skillName, today]
  );

  const pct       = Math.min((totalHours / MILESTONE_HOURS) * 100, 100);
  const remaining = Math.max(MILESTONE_HOURS - totalHours, 0);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{skillName}</span>
        <span style={{ fontSize: 11, color: COLORS.text2 }}>
          {totalHours.toFixed(1)} / {MILESTONE_HOURS} h
          {remaining > 0 && (
            <span style={{ color: COLORS.muted, marginLeft: 6 }}>({remaining.toFixed(0)} remaining)</span>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, borderRadius: 4, background: COLORS.surface3, overflow: 'hidden', marginBottom: 8 }}>
        <div
          style={{
            width:        `${pct}%`,
            height:       '100%',
            background:   color,
            borderRadius: 4,
            transition:   'width 0.4s ease',
          }}
        />
      </div>

      {/* Sparkline + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkline weekly={weekly} color={color} />
        <span style={{ fontSize: 10, color: COLORS.muted, whiteSpace: 'nowrap' }}>12-week</span>
      </div>
    </div>
  );
}

SkillRow.propTypes = {
  skillName: PropTypes.string.isRequired,
  entries:   PropTypes.array.isRequired,
  today:     PropTypes.instanceOf(Date).isRequired,
  color:     PropTypes.string.isRequired,
};

// ── Main panel ────────────────────────────────────────────────────────────────

function SkillHoursPanel({ entries, habitsConfig, today }) {
  const skills = useMemo(
    () => getTrackedSkills(entries, habitsConfig.skills ?? []),
    [entries, habitsConfig.skills]
  );

  const SKILL_COLOR = '#7986cb'; // skill_hour habit color

  if (skills.length === 0) {
    return (
      <div style={{ padding: 24, fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
        No skills tracked yet — log a Skill Hour entry to get started.
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 12px' }}>
      {skills.map(skill => (
        <SkillRow
          key={skill}
          skillName={skill}
          entries={entries}
          today={today}
          color={SKILL_COLOR}
        />
      ))}
    </div>
  );
}

SkillHoursPanel.propTypes = {
  entries:      PropTypes.array.isRequired,
  habitsConfig: PropTypes.object.isRequired,
  today:        PropTypes.instanceOf(Date).isRequired,
};

export { SkillHoursPanel };
