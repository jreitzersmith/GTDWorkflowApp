// src/features/habits/HabitsPanel.jsx
// Top-level Habits panel rendered in App.jsx when currentView === 'habits'.
// Shows 5 status cards; clicking one expands the detail view below.
// Habits analytics live in the Analytics area (FR#199).

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { useHabits } from './useHabits.js';
import { HabitStatusCard } from './HabitStatusCard.jsx';
import { HabitDetailView } from './HabitDetailView.jsx';
import { HABITS, HABIT_ORDER, computeHabitStatus } from './habitsUtils.js';

function HabitsPanel({ supabaseReady }) {
  const { entries, habitsConfig, loading, error, saveEntry, deleteEntry, saveConfig } = useHabits({ supabaseReady });
  const [selectedHabitId, setSelectedHabitId] = useState(null);

  const today = useMemo(() => new Date(), []);

  const habitStatuses = useMemo(() => {
    return HABIT_ORDER.reduce((acc, habitId) => {
      acc[habitId] = computeHabitStatus(habitId, entries, today);
      return acc;
    }, {});
  }, [entries, today]);

  async function handleSaveEntry(habitId, entryDate, content, options = {}) {
    await saveEntry(habitId, entryDate, content, options);
    if (habitId === 'skill_hour' && content.skill) {
      const currentSkills = habitsConfig.skills ?? [];
      if (!currentSkills.includes(content.skill)) {
        await saveConfig({ skills: [...currentSkills, content.skill], active_skill: content.skill });
      }
    }
  }

  async function handleDeleteEntry(id) {
    await deleteEntry(id);
  }

  const selectedHabit = selectedHabitId ? HABITS[selectedHabitId] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: COLORS.bg }}>
      {/* Panel header */}
      <div style={{ padding: '18px 16px 12px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🌱</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: COLORS.text }}>Habits</div>
            <div style={{ fontSize: 11, color: COLORS.text2 }}>Silent Organisation practice</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: 24, fontSize: 13, color: COLORS.muted, textAlign: 'center' }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ padding: 16, fontSize: 12, color: '#ef5350' }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && (
          <>
            {/* Status cards — 2-column tile grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: '10px 12px' }}>
              {HABIT_ORDER.map(habitId => {
                const habit = HABITS[habitId];
                const { status, currentStreak } = habitStatuses[habitId];
                return (
                  <HabitStatusCard
                    key={habitId}
                    habit={habit}
                    status={status}
                    currentStreak={currentStreak}
                    selected={selectedHabitId === habitId}
                    onClick={() => setSelectedHabitId(prev => prev === habitId ? null : habitId)}
                  />
                );
              })}
            </div>

            {/* Detail view */}
            {selectedHabit && (
              <HabitDetailView
                key={selectedHabitId}
                habit={selectedHabit}
                entries={entries}
                habitsConfig={habitsConfig}
                onSaveEntry={handleSaveEntry}
                onDeleteEntry={handleDeleteEntry}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

HabitsPanel.propTypes = {
  supabaseReady: PropTypes.bool.isRequired,
};

export { HabitsPanel };
