// src/features/habits/HabitHeatmap.jsx
// 90-day completion heatmap for all habit types.
// Streak habits show current + best streak. Periodic habits show entry count.

import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';

function HabitHeatmap({ habit, heatmapData, currentStreak, bestStreak }) {
  // Lay out 90 days in rows of ~13 weeks (7 cols per week, 13 cols)
  // Simple: render as a flex-wrap grid, newest last.
  return (
    <div style={{ padding: '12px 16px 4px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {heatmapData.map(({ date, completed, required }) => {
          let bg;
          if (!required) {
            bg = COLORS.border; // dim — not a required day
          } else if (completed) {
            bg = habit.color;
          } else {
            bg = COLORS.surface2;
          }
          return (
            <div
              key={date}
              title={date}
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: bg,
                opacity: !required ? 0.3 : 1,
              }}
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        {habit.type === 'streak' ? (
          <>
            <div style={{ fontSize: 11, color: COLORS.text2 }}>
              <span style={{ color: habit.color, fontWeight: 600 }}>{currentStreak}</span>
              {' '}current streak
            </div>
            <div style={{ fontSize: 11, color: COLORS.text2 }}>
              <span style={{ color: COLORS.text, fontWeight: 600 }}>{bestStreak}</span>
              {' '}best streak
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: COLORS.text2 }}>
            <span style={{ color: habit.color, fontWeight: 600 }}>
              {heatmapData.filter(d => d.completed).length}
            </span>
            {' '}entries in last 90 days
          </div>
        )}
      </div>
    </div>
  );
}

HabitHeatmap.propTypes = {
  habit:         PropTypes.object.isRequired,
  heatmapData:   PropTypes.arrayOf(PropTypes.shape({
    date:      PropTypes.string.isRequired,
    completed: PropTypes.bool.isRequired,
    required:  PropTypes.bool.isRequired,
  })).isRequired,
  currentStreak: PropTypes.number.isRequired,
  bestStreak:    PropTypes.number.isRequired,
};

export { HabitHeatmap };
