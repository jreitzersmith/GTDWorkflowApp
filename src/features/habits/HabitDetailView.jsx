// src/features/habits/HabitDetailView.jsx
// Shows the expanded detail area for a selected habit.
// Multi-entry habits (friction_audit, skill_hour): multiple entries per day allowed.
// One-per-period habits: form pre-populated from existing entry; save replaces it.

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { HabitHeatmap } from './HabitHeatmap.jsx';
import { HabitEntryForm } from './HabitEntryForm.jsx';
import { toDateString, buildHeatmapData, computeHabitStatus, computeStreakMetrics, getWeekBounds, isMultiEntry, getTrackedSkills, buildSkillHeatmapData, totalSkillMinutes, HABITS } from './habitsUtils.js';

function PastEntriesList({ habit, entries, onEditEntry, onDeleteEntry }) {
  const habitEntries = entries
    .filter(e => e.habit_id === habit.id)
    .sort((a, b) => {
      if (b.entry_date !== a.entry_date) return b.entry_date.localeCompare(a.entry_date);
      return b.created_at?.localeCompare(a.created_at ?? '') ?? 0;
    })
    .slice(0, 30);

  if (habitEntries.length === 0) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: COLORS.text2, fontStyle: 'italic' }}>
        No past entries yet.
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 8px' }}>
      <div style={{ fontSize: 11, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Past entries
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
        {habitEntries.map(entry => (
          <EntryCard
            key={entry.id}
            habit={habit}
            entry={entry}
            onEdit={() => onEditEntry(entry)}
            onDelete={() => onDeleteEntry(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function EntryCard({ habit, entry, onEdit, onDelete }) {
  const c = entry.content ?? {};
  const fieldLabel = { fontSize: 10, color: COLORS.text2, fontWeight: 500, marginRight: 4 };
  const fieldText  = { fontSize: 12, color: COLORS.text };

  function renderContent() {
    if (habit.id === 'friction_audit') {
      return <div style={fieldText}>{c.notes || <em style={{ color: COLORS.muted }}>no notes</em>}</div>;
    }
    if (habit.id === 'strategic_review') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {c.showed_up  && <div><span style={fieldLabel}>Showed up:</span><span style={fieldText}>{c.showed_up}</span></div>}
          {c.drifted    && <div><span style={fieldLabel}>Drifted:</span><span style={fieldText}>{c.drifted}</span></div>}
          {c.adjustment && <div><span style={fieldLabel}>Adjustment:</span><span style={fieldText}>{c.adjustment}</span></div>}
        </div>
      );
    }
    if (habit.id === 'energy_audit') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {c.drain      && <div><span style={fieldLabel}>Drain:</span><span style={fieldText}>{c.drain}</span></div>}
          {c.regenerate && <div><span style={fieldLabel}>Regenerate:</span><span style={fieldText}>{c.regenerate}</span></div>}
        </div>
      );
    }
    if (habit.id === 'evidence_journal') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[1, 2, 3].map(n => c[`sentence_${n}`]
            ? <div key={n} style={fieldText}>{n}. {c[`sentence_${n}`]}</div>
            : null
          )}
        </div>
      );
    }
    if (habit.id === 'skill_hour') {
      const parts = [c.skill, c.completed ? '✓' : '✗', c.duration_minutes ? `${c.duration_minutes}min` : null].filter(Boolean);
      return (
        <div>
          <div style={fieldText}>{parts.join(' · ')}</div>
          {c.notes && <div style={{ ...fieldText, color: COLORS.text2, marginTop: 3 }}>{c.notes}</div>}
        </div>
      );
    }
    return <em style={{ color: COLORS.muted }}>no content</em>;
  }

  const actionBtn = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
  };

  return (
    <div style={{ background: COLORS.surface2, borderRadius: 6, padding: '8px 10px', borderLeft: `3px solid ${habit.color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: COLORS.text2 }}>{entry.entry_date}</div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" onClick={onEdit}   style={{ ...actionBtn, color: COLORS.text2 }}>✏ Edit</button>
          <button type="button" onClick={onDelete} style={{ ...actionBtn, color: '#ef5350' }}>✕ Delete</button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}


const SKILL_COLORS = ['#7986cb', '#4db6ac', '#ff8a65', '#81c784', '#f48fb1', '#ffb74d', '#64b5f6', '#ba68c8'];

function SkillHeatmapGroup({ entries, habitsConfig, today }) {
  const allSkills = getTrackedSkills(entries, habitsConfig.skills ?? []);
  const habitDef  = HABITS['skill_hour'];

  if (allSkills.length === 0) {
    return (
      <div style={{ padding: '8px 16px', fontSize: 12, color: COLORS.text2, fontStyle: 'italic' }}>
        No skills tracked yet — add one when logging your first entry.
      </div>
    );
  }

  return (
    <div>
      {allSkills.map((skill, idx) => {
        const color        = SKILL_COLORS[idx % SKILL_COLORS.length];
        const coloredHabit = { ...habitDef, color };
        const heatmapData  = buildSkillHeatmapData(entries, skill, today);
        const skillEntries = entries.filter(e => e.habit_id === 'skill_hour' && e.content?.skill === skill);
        const doneSet      = new Set(skillEntries.map(e => e.entry_date));
        const { currentStreak, bestStreak } = computeStreakMetrics('skill_hour', doneSet, today);
        const totalMins  = totalSkillMinutes(entries, skill);
        const totalHours = (totalMins / 60).toFixed(1);
        const MILESTONE  = 250;
        const pct        = Math.min(100, Math.round(totalMins / 60 / MILESTONE * 100));

        return (
          <div key={skill}>
            <div style={{ padding: '10px 16px 2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{skill}</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                <span style={{ color: COLORS.text2 }}>
                  <span style={{ color, fontWeight: 600 }}>{totalHours}h</span> logged
                </span>
                <span style={{ color: COLORS.muted }}>{pct}% to 250h</span>
              </div>
            </div>
            <div style={{ margin: '4px 16px 0', height: 3, background: COLORS.surface2, borderRadius: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <HabitHeatmap
              habit={coloredHabit}
              heatmapData={heatmapData}
              currentStreak={currentStreak}
              bestStreak={bestStreak}
            />
            <SectionDivider color={color} />
          </div>
        );
      })}
    </div>
  );
}

function SectionDivider({ color }) {
  return <div style={{ margin: '8px 16px', borderTop: `1px solid ${color}33` }} />;
}

function HabitDetailView({ habit, entries, habitsConfig, onSaveEntry, onDeleteEntry }) {
  const today = useMemo(() => new Date(), []);
  const todayStr = toDateString(today);
  const multiEntry = isMultiEntry(habit.id);

  // For one-per-period habits: find the current period's entry to pre-populate the form
  const { weekStart, weekEnd } = getWeekBounds(today);
  const todayEntry = entries.find(e => e.habit_id === habit.id && e.entry_date === todayStr);
  const weekEntry  = entries.find(e => e.habit_id === habit.id && e.entry_date >= weekStart && e.entry_date <= weekEnd);
  const existingEntry = multiEntry ? null : (habit.type === 'streak' ? todayEntry : weekEntry);

  // Multi-entry: always start blank. One-per-period: pre-populate from saved entry.
  const [formValue,      setFormValue]      = useState(existingEntry?.content ?? {});
  const [saving,         setSaving]         = useState(false);
  const [savedMessage,   setSavedMessage]   = useState('');
  const [formCollapsed,  setFormCollapsed]  = useState(false);
  const [editingEntry,   setEditingEntry]   = useState(null); // entry being edited (multi-entry only)

  const { currentStreak, bestStreak } = useMemo(
    () => computeHabitStatus(habit.id, entries, today),
    [habit.id, entries, today]
  );

  const heatmapData = useMemo(
    () => buildHeatmapData(habit.id, entries, today),
    [habit.id, entries, today]
  );

  const entryDate = editingEntry ? editingEntry.entry_date : todayStr;

  async function handleSave() {
    setSaving(true);
    try {
      const options = multiEntry
        ? { editId: editingEntry?.id ?? null }
        : { replace: true };
      await onSaveEntry(habit.id, entryDate, formValue, options);
      setEditingEntry(null);
      if (multiEntry) {
        setFormValue({});
      }
      setFormCollapsed(!multiEntry); // collapse after save for one-per-period; keep open for multi
      setSavedMessage('Saved');
      setTimeout(() => setSavedMessage(''), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleEditEntry(entry) {
    setFormValue(entry.content ?? {});
    setFormCollapsed(false);
    if (multiEntry) setEditingEntry(entry);
  }

  function handleCancelEdit() {
    setEditingEntry(null);
    setFormValue(multiEntry ? {} : (existingEntry?.content ?? {}));
  }

  const skills      = habitsConfig.skills ?? [];
  const activeSkill = habitsConfig.active_skill ?? null;
  const periodLabel = habit.cadence === 'daily' || habit.cadence === 'weekdays' ? 'Daily' : 'Weekly';
  const isUpdate    = !multiEntry && !!existingEntry;
  const isEditing   = !!editingEntry;

  return (
    <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{habit.emoji}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>{habit.label}</div>
          <div style={{ fontSize: 11, color: COLORS.text2 }}>{habit.description}</div>
        </div>
        {savedMessage && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#66bb6a', fontWeight: 500 }}>
            {savedMessage}
          </span>
        )}
      </div>

      {/* Heatmap — per-skill for skill_hour, single for all others */}
      {habit.id === 'skill_hour' ? (
        <SkillHeatmapGroup entries={entries} habitsConfig={habitsConfig} today={today} />
      ) : (
        <>
          <HabitHeatmap
            habit={habit}
            heatmapData={heatmapData}
            currentStreak={currentStreak}
            bestStreak={bestStreak}
          />
          <SectionDivider color={habit.color} />
        </>
      )}

      {/* Entry form — collapsible */}
      <div style={{ padding: '8px 0 0' }}>
        <div
          onClick={() => setFormCollapsed(v => !v)}
          style={{
            padding: '4px 16px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {isEditing ? 'Editing entry — ' + editingEntry.entry_date
              : multiEntry ? 'Add entry'
              : habit.type === 'streak' ? "Today's entry" : "This week's entry"}
            {!multiEntry && existingEntry && !isEditing && (
              <span style={{ marginLeft: 8, color: habit.color }}>· already logged</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isEditing && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleCancelEdit(); }}
                style={{ fontSize: 10, color: COLORS.text2, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
              >
                Cancel
              </button>
            )}
            <span style={{ fontSize: 11, color: COLORS.text2 }}>
              {formCollapsed ? '▶' : '▼'}
            </span>
          </div>
        </div>
        {!formCollapsed && (
          <HabitEntryForm
            habit={habit}
            value={formValue}
            onChange={setFormValue}
            onSave={handleSave}
            saving={saving}
            skills={skills}
            activeSkill={activeSkill}
            isUpdate={isUpdate}
            isEditing={isEditing}
            periodLabel={periodLabel}
          />
        )}
      </div>

      {/* Past entries log */}
      <>
        <SectionDivider color={habit.color} />
        <PastEntriesList
          habit={habit}
          entries={entries}
          onEditEntry={handleEditEntry}
          onDeleteEntry={onDeleteEntry}
        />
      </>
    </div>
  );
}

HabitDetailView.propTypes = {
  habit:          PropTypes.object.isRequired,
  entries:        PropTypes.array.isRequired,
  habitsConfig:   PropTypes.object.isRequired,
  onSaveEntry:    PropTypes.func.isRequired,
  onDeleteEntry:  PropTypes.func.isRequired,
};

PastEntriesList.propTypes = {
  habit:         PropTypes.object.isRequired,
  entries:       PropTypes.array.isRequired,
  onEditEntry:   PropTypes.func.isRequired,
  onDeleteEntry: PropTypes.func.isRequired,
};
EntryCard.propTypes = {
  habit:    PropTypes.object.isRequired,
  entry:    PropTypes.object.isRequired,
  onEdit:   PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
SectionDivider.propTypes = { color: PropTypes.string.isRequired };

export { HabitDetailView };
