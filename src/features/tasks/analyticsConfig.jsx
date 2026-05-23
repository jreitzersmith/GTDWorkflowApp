import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';

export const SECTION_DEFS = [
  { id: 'buckets',           label: 'Active tasks by bucket' },
  { id: 'completions',       label: 'Completions — last 12 weeks' },
  { id: 'throughput',        label: 'Throughput — 8-week trend' },
  { id: 'project_health',    label: 'Project health' },
  { id: 'effort_accuracy',   label: 'Effort estimate accuracy' },
  { id: 'effort_by_period',  label: 'Effort accuracy — by month' },
  { id: 'effort_by_project', label: 'Effort accuracy — by project' },
  { id: 'due_date',          label: 'Due date compliance' },
  { id: 'deferrals',         label: 'Deferral frequency' },
  { id: 'context',           label: 'Context utilization' },
  { id: 'someday',           label: 'Someday / Maybe decay' },
];

const LS_KEY = 'gtd_analytics_layout';

export function loadLayout() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function saveLayout(layout) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch {}
}

export function defaultLayout() {
  return SECTION_DEFS.map(s => ({ id: s.id, visible: true, collapsed: false }));
}

export function SectionManager({ layout, onChange }) {
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
  const labelMap = Object.fromEntries(SECTION_DEFS.map(s => [s.id, s.label]));
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
          onClick={() => onChange(defaultLayout())}
          style={{ fontSize: 12, padding: '3px 10px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.muted, cursor: 'pointer' }}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

SectionManager.propTypes = {
  layout:   PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, visible: PropTypes.bool, collapsed: PropTypes.bool })).isRequired,
  onChange: PropTypes.func.isRequired,
};
