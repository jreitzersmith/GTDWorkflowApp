// src/features/habits/habitsAnalyticsConfig.jsx
// Section definitions and layout persistence for the Habits Analytics tab.
// Mirrors the pattern in src/features/tasks/analyticsConfig.jsx.

import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';

export const HABITS_SECTION_DEFS = [
  { id: 'compliance',  label: '12-week compliance heatmap' },
  { id: 'skill_hours', label: 'Skill Hour — cumulative tracker' },
  { id: 'energy',      label: 'Energy ecology' },
  { id: 'score',       label: 'Weekly score trend' },
  { id: 'vs_tasks',    label: 'Score vs task throughput' },
];

const LS_KEY = 'gtd_habits_analytics_layout';

export function loadHabitsLayout() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveHabitsLayout(layout) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch {}
}

export function defaultHabitsLayout() {
  return HABITS_SECTION_DEFS.map(s => ({ id: s.id, visible: true, collapsed: false }));
}

export function HabitsSectionManager({ layout, onChange }) {
  function setVisible(id, v) {
    onChange(layout.map(s => s.id === id ? { ...s, visible: v } : s));
  }
  function move(idx, dir) {
    const next = [...layout];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  }
  const labelMap = Object.fromEntries(HABITS_SECTION_DEFS.map(s => [s.id, s.label]));
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        Configure sections
      </div>
      {layout.map((s, idx) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < layout.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
          <input
            type="checkbox"
            checked={s.visible}
            onChange={e => setVisible(s.id, e.target.checked)}
            style={{ margin: 0, flexShrink: 0, cursor: 'pointer' }}
          />
          <span style={{ flex: 1, fontSize: 13, color: s.visible ? COLORS.text : COLORS.muted }}>{labelMap[s.id]}</span>
          <button
            onClick={() => move(idx, -1)}
            disabled={idx === 0}
            style={{ padding: '1px 6px', fontSize: 12, cursor: idx === 0 ? 'default' : 'pointer', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.text2, opacity: idx === 0 ? 0.3 : 1 }}
          >▲</button>
          <button
            onClick={() => move(idx, 1)}
            disabled={idx === layout.length - 1}
            style={{ padding: '1px 6px', fontSize: 12, cursor: idx === layout.length - 1 ? 'default' : 'pointer', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 4, color: COLORS.text2, opacity: idx === layout.length - 1 ? 0.3 : 1 }}
          >▼</button>
        </div>
      ))}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onChange(defaultHabitsLayout())}
          style={{ fontSize: 12, padding: '3px 10px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.muted, cursor: 'pointer' }}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

HabitsSectionManager.propTypes = {
  layout:   PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, visible: PropTypes.bool, collapsed: PropTypes.bool })).isRequired,
  onChange: PropTypes.func.isRequired,
};
