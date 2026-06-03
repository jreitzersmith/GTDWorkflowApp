// src/features/habits/HabitsAnalytics.jsx
// Container for the Habits analytics tab — sub-tab navigation across FR#194-198 panels.

import { useState } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { ComplianceHeatmap }   from './ComplianceHeatmap.jsx';
import { SkillHoursPanel }     from './SkillHoursPanel.jsx';
import { EnergyPanel }         from './EnergyPanel.jsx';
import { ScoreTrend }          from './ScoreTrend.jsx';
import { ScoreVsThroughput }   from './ScoreVsThroughput.jsx';

const TABS = [
  { id: 'compliance',  label: 'Compliance' },
  { id: 'skill_hours', label: 'Skill Hours' },
  { id: 'energy',      label: 'Energy' },
  { id: 'score',       label: 'Score' },
  { id: 'vs_tasks',    label: 'vs Tasks' },
];

function HabitsAnalytics({ entries, habitsConfig, tasks, today }) {
  const [activeTab, setActiveTab] = useState('compliance');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div style={{
        display:        'flex',
        borderBottom:   `1px solid ${COLORS.border}`,
        overflowX:      'auto',
        flexShrink:     0,
        scrollbarWidth: 'none',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding:       '7px 12px',
              fontSize:      11,
              fontWeight:    activeTab === tab.id ? 500 : 400,
              color:         activeTab === tab.id ? COLORS.text : COLORS.text2,
              background:    'transparent',
              border:        'none',
              borderBottom:  activeTab === tab.id
                ? `2px solid ${COLORS.accent}`
                : '2px solid transparent',
              cursor:        'pointer',
              whiteSpace:    'nowrap',
              flexShrink:    0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'compliance' && (
          <ComplianceHeatmap entries={entries} today={today} />
        )}
        {activeTab === 'skill_hours' && (
          <SkillHoursPanel entries={entries} habitsConfig={habitsConfig} today={today} />
        )}
        {activeTab === 'energy' && (
          <EnergyPanel entries={entries} today={today} />
        )}
        {activeTab === 'score' && (
          <ScoreTrend entries={entries} today={today} />
        )}
        {activeTab === 'vs_tasks' && (
          <ScoreVsThroughput entries={entries} tasks={tasks} today={today} />
        )}
      </div>
    </div>
  );
}

HabitsAnalytics.propTypes = {
  entries:      PropTypes.array.isRequired,
  habitsConfig: PropTypes.object.isRequired,
  tasks:        PropTypes.array.isRequired,
  today:        PropTypes.instanceOf(Date).isRequired,
};

export { HabitsAnalytics };
