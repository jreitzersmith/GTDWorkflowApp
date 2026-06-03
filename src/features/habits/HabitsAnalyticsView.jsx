// src/features/habits/HabitsAnalyticsView.jsx
// Habits analytics tab within the Analytics area (FR#199).
// Single scrollable page with collapsible, configurable sections —
// mirrors the pattern of TaskAnalyticsView and ContactAnalyticsView.

import PropTypes from 'prop-types';
import { useState, useMemo } from 'react';
import { COLORS } from '../../constants.jsx';
import { useHabits } from './useHabits.js';
import { ComplianceHeatmap }  from './ComplianceHeatmap.jsx';
import { SkillHoursPanel }    from './SkillHoursPanel.jsx';
import { EnergyPanel }        from './EnergyPanel.jsx';
import { ScoreTrend }         from './ScoreTrend.jsx';
import { ScoreVsThroughput }  from './ScoreVsThroughput.jsx';
import {
  HABITS_SECTION_DEFS, HabitsSectionManager,
  loadHabitsLayout, saveHabitsLayout, defaultHabitsLayout,
} from './habitsAnalyticsConfig.jsx';

function SectionCard({ title, children, collapsed, onToggleCollapse }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
      <div
        onClick={onToggleCollapse}
        style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: collapsed ? 0 : 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 10 }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && children}
    </div>
  );
}

SectionCard.propTypes = {
  title:            PropTypes.string.isRequired,
  children:         PropTypes.node.isRequired,
  collapsed:        PropTypes.bool,
  onToggleCollapse: PropTypes.func.isRequired,
};

function HabitsAnalyticsView({ supabaseReady, tasks }) {
  const { entries, habitsConfig, loading, error } = useHabits({ supabaseReady });
  const today = useMemo(() => new Date(), []);

  const [configOpen, setConfigOpen] = useState(false);
  const [layout, setLayout] = useState(() => {
    const saved = loadHabitsLayout();
    if (!saved) return defaultHabitsLayout();
    const savedIds = new Set(saved.map(s => s.id));
    const merged = [...saved];
    HABITS_SECTION_DEFS.forEach(def => {
      if (!savedIds.has(def.id)) merged.push({ id: def.id, visible: true, collapsed: false });
    });
    return merged;
  });

  function handleLayoutChange(next) { setLayout(next); saveHabitsLayout(next); }
  function toggleCollapse(id) {
    handleLayoutChange(layout.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s));
  }

  const sectionContents = {
    compliance:  { title: '12-week compliance heatmap',      node: <ComplianceHeatmap entries={entries} today={today} /> },
    skill_hours: { title: 'Skill Hour — cumulative tracker', node: <SkillHoursPanel entries={entries} habitsConfig={habitsConfig} today={today} /> },
    energy:      { title: 'Energy ecology',                  node: <EnergyPanel entries={entries} today={today} /> },
    score:       { title: 'Weekly score trend',              node: <ScoreTrend entries={entries} today={today} /> },
    vs_tasks:    { title: 'Score vs task throughput',        node: <ScoreVsThroughput entries={entries} tasks={tasks} today={today} /> },
  };

  const habitCount = new Set(entries.map(e => e.habit_id)).size;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: COLORS.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Habits Analytics</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {loading
                ? 'Loading…'
                : error
                  ? `Error: ${error}`
                  : `${entries.length} entries across ${habitCount} habit${habitCount !== 1 ? 's' : ''}`}
            </div>
          </div>
          <button
            onClick={() => setConfigOpen(o => !o)}
            style={{ fontSize: 12, padding: '4px 10px', background: configOpen ? COLORS.surface2 : 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text2, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
          >
            {configOpen ? 'Done' : 'Configure'}
          </button>
        </div>

        {loading && (
          <div style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', padding: '40px 0' }}>
            Loading habit entries…
          </div>
        )}
        {error && (
          <div style={{ fontSize: 13, color: '#ef5350', padding: '12px 0' }}>
            Error loading habits data: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {configOpen && <HabitsSectionManager layout={layout} onChange={handleLayoutChange} />}
            {layout.filter(s => s.visible).map(s => {
              const sec = sectionContents[s.id];
              if (!sec) return null;
              return (
                <SectionCard key={s.id} title={sec.title} collapsed={s.collapsed} onToggleCollapse={() => toggleCollapse(s.id)}>
                  {sec.node}
                </SectionCard>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

HabitsAnalyticsView.propTypes = {
  supabaseReady: PropTypes.bool.isRequired,
  tasks:         PropTypes.array.isRequired,
};

export { HabitsAnalyticsView };
