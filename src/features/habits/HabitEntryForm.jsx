// src/features/habits/HabitEntryForm.jsx
// Controlled entry form with habit-specific fields.
// Parent owns the form state and passes it down via value/onChange.

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';

const inputStyle = {
  width: '100%',
  background: COLORS.surface2,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  color: COLORS.text,
  resize: 'vertical',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 11,
  color: COLORS.text2,
  marginBottom: 4,
  display: 'block',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

Field.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

// ── Per-habit form bodies ─────────────────────────────────────────────────────

function FrictionAuditFields({ value, onChange }) {
  return (
    <Field label="What is making good behaviour harder than it needs to be?">
      <textarea
        rows={5}
        style={inputStyle}
        value={value.notes ?? ''}
        onChange={e => onChange({ ...value, notes: e.target.value })}
        placeholder="Describe friction points and any changes you're making..."
      />
    </Field>
  );
}

function SkillHourFields({ value, onChange, skills, activeSkill }) {
  const [newSkill, setNewSkill] = useState('');
  const skillList = [...new Set([...(skills ?? []), ...(value.skill ? [value.skill] : [])])];

  return (
    <>
      <Field label="Skill">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {skillList.map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...value, skill: s })}
              style={{
                padding: '4px 12px',
                borderRadius: 14,
                border: `1px solid ${value.skill === s ? '#7986cb' : COLORS.border}`,
                background: value.skill === s ? '#7986cb22' : 'transparent',
                color: value.skill === s ? '#7986cb' : COLORS.text2,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            placeholder="Add skill..."
            onKeyDown={e => {
              if (e.key === 'Enter' && newSkill.trim()) {
                e.preventDefault();
                onChange({ ...value, skill: newSkill.trim() });
                setNewSkill('');
              }
            }}
          />
          <button
            type="button"
            onClick={() => { if (newSkill.trim()) { onChange({ ...value, skill: newSkill.trim() }); setNewSkill(''); } }}
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, fontSize: 12, cursor: 'pointer' }}
          >
            Add
          </button>
        </div>
      </Field>

      <Field label="Completed">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value.completed ?? false}
            onChange={e => onChange({ ...value, completed: e.target.checked })}
          />
          <span style={{ fontSize: 13, color: COLORS.text }}>Did the skill hour today</span>
        </label>
      </Field>

      <Field label="Duration (minutes)">
        <input
          type="number"
          min={0}
          max={300}
          style={{ ...inputStyle, width: 100 }}
          value={value.duration_minutes ?? ''}
          onChange={e => onChange({ ...value, duration_minutes: Number(e.target.value) })}
          placeholder="60"
        />
      </Field>

      <Field label="Notes">
        <textarea
          rows={3}
          style={inputStyle}
          value={value.notes ?? ''}
          onChange={e => onChange({ ...value, notes: e.target.value })}
          placeholder="What did you work on? Where did you struggle?"
        />
      </Field>
    </>
  );
}

function EvidenceJournalFields({ value, onChange }) {
  return (
    <>
      {[1, 2, 3].map(n => (
        <Field key={n} label={`Evidence ${n}`}>
          <textarea
            rows={2}
            style={inputStyle}
            value={value[`sentence_${n}`] ?? ''}
            onChange={e => onChange({ ...value, [`sentence_${n}`]: e.target.value })}
            placeholder={`Specific evidence you acted in alignment with your values...`}
          />
        </Field>
      ))}
    </>
  );
}

function StrategicReviewFields({ value, onChange }) {
  const questions = [
    { key: 'showed_up',  label: 'Where did I show up as the person I\'m committed to becoming?' },
    { key: 'drifted',    label: 'Where did I drift — and is it a pattern?' },
    { key: 'adjustment', label: 'What one adjustment would make next week materially stronger?' },
  ];
  return (
    <>
      {questions.map(({ key, label }) => (
        <Field key={key} label={label}>
          <textarea
            rows={3}
            style={inputStyle}
            value={value[key] ?? ''}
            onChange={e => onChange({ ...value, [key]: e.target.value })}
          />
        </Field>
      ))}
    </>
  );
}

function EnergyAuditFields({ value, onChange }) {
  return (
    <>
      <Field label="What drained your cognitive / emotional bandwidth this week?">
        <textarea
          rows={3}
          style={inputStyle}
          value={value.drain ?? ''}
          onChange={e => onChange({ ...value, drain: e.target.value })}
          placeholder="A situation, context, or activity that left you depleted..."
        />
      </Field>
      <Field label="What regenerated it?">
        <textarea
          rows={3}
          style={inputStyle}
          value={value.regenerate ?? ''}
          onChange={e => onChange({ ...value, regenerate: e.target.value })}
          placeholder="A situation, context, or activity that restored your energy..."
        />
      </Field>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

function HabitEntryForm({ habit, value, onChange, onSave, saving, skills = [], activeSkill = null, isUpdate = false, isEditing = false, periodLabel = 'Daily' }) {
  const canSave = (() => {
    if (habit.id === 'skill_hour') return !!(value.skill);
    if (habit.id === 'evidence_journal') return !!(value.sentence_1?.trim());
    if (habit.id === 'strategic_review') return !!(value.showed_up?.trim());
    if (habit.id === 'energy_audit') return !!(value.drain?.trim() || value.regenerate?.trim());
    if (habit.id === 'friction_audit') return !!(value.notes?.trim());
    return false;
  })();

  const saveLabel = (() => {
    if (saving) return 'Saving…';
    if (isEditing) return 'Update entry';
    if (isUpdate)  return `Update ${periodLabel} Entry`;
    return 'Add entry';
  })();

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {habit.id === 'friction_audit'   && <FrictionAuditFields  value={value} onChange={onChange} />}
      {habit.id === 'skill_hour'       && <SkillHourFields       value={value} onChange={onChange} skills={skills} activeSkill={activeSkill} />}
      {habit.id === 'evidence_journal' && <EvidenceJournalFields value={value} onChange={onChange} />}
      {habit.id === 'strategic_review' && <StrategicReviewFields value={value} onChange={onChange} />}
      {habit.id === 'energy_audit'     && <EnergyAuditFields     value={value} onChange={onChange} />}

      <button
        onClick={onSave}
        disabled={!canSave || saving}
        style={{
          marginTop: 4,
          padding: '7px 18px',
          borderRadius: 6,
          border: 'none',
          background: canSave ? habit.color : COLORS.border,
          color: canSave ? '#fff' : COLORS.muted,
          fontSize: 13,
          fontWeight: 500,
          cursor: canSave ? 'pointer' : 'default',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saveLabel}
      </button>
    </div>
  );
}

HabitEntryForm.propTypes = {
  habit:        PropTypes.object.isRequired,
  value:        PropTypes.object.isRequired,
  onChange:     PropTypes.func.isRequired,
  onSave:       PropTypes.func.isRequired,
  saving:       PropTypes.bool.isRequired,
  skills:       PropTypes.arrayOf(PropTypes.string),
  activeSkill:  PropTypes.string,
  isUpdate:     PropTypes.bool,
  isEditing:    PropTypes.bool,
  periodLabel:  PropTypes.string,
};

// Sub-component prop types
FrictionAuditFields.propTypes  = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
EvidenceJournalFields.propTypes = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
StrategicReviewFields.propTypes = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
EnergyAuditFields.propTypes     = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired };
SkillHourFields.propTypes       = { value: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired, skills: PropTypes.array, activeSkill: PropTypes.string };

export { HabitEntryForm };
