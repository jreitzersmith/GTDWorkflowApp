// src/features/habits/HabitStatusCard.jsx
// Presentational card showing a habit's name, cadence, and current status.
// Clicking selects the habit for detail view.

import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';

const STATUS_STYLES = {
  done:    { bg: '#1b5e2022', color: '#66bb6a', label: 'Done' },
  due:     { bg: '#e65100' + '22', color: '#ffa726', label: 'Due' },
  overdue: { bg: '#b71c1c22', color: '#ef5350', label: 'Overdue' },
};

const CADENCE_LABEL = {
  daily:    'daily',
  weekdays: '5×/week',
  weekly:   'weekly',
};

function HabitStatusCard({ habit, status, currentStreak, selected, onClick }) {
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.due;
  const cadenceText = CADENCE_LABEL[habit.cadence] ?? habit.cadence;
  const isActive = selected;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 12px',
        cursor: 'pointer',
        background: isActive ? COLORS.surface2 : 'transparent',
        border: `1px solid ${isActive ? habit.color : COLORS.border}`,
        borderRadius: 8,
        transition: 'background 0.1s, border-color 0.1s',
      }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = COLORS.surface2; } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18 }}>{habit.emoji}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 500,
          padding: '2px 7px',
          borderRadius: 10,
          background: statusStyle.bg,
          color: statusStyle.color,
        }}>
          {statusStyle.label}
        </span>
      </div>

      <div style={{ fontSize: 12, color: COLORS.text, fontWeight: isActive ? 500 : 400, lineHeight: 1.3 }}>
        {habit.label}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ fontSize: 10, color: COLORS.text2 }}>{cadenceText}</div>
        {currentStreak > 0 && (
          <span style={{ fontSize: 10, color: habit.color, fontWeight: 600 }}>
            {currentStreak}{currentStreak >= 3 ? '🔥' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

HabitStatusCard.propTypes = {
  habit:         PropTypes.object.isRequired,
  status:        PropTypes.oneOf(['done', 'due', 'overdue']).isRequired,
  currentStreak: PropTypes.number.isRequired,
  selected:      PropTypes.bool.isRequired,
  onClick:       PropTypes.func.isRequired,
};

export { HabitStatusCard };
