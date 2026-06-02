// src/features/health/HealthPanel.jsx
// Health monitoring panel — medications, supplements, appointments (FR#187).

import { useState } from 'react';
import { COLORS } from '../../constants.jsx';

const TABS = ['Medications & Supplements', 'Appointments', 'Documents'];

const STATUS_COLORS = {
  active:  { bg: '#e8f5e9', color: '#2e7d32' },
  paused:  { bg: '#fff8e1', color: '#f57f17' },
  stopped: { bg: '#fce4ec', color: '#b71c1c' },
};

function statusBadge(status) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.active;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9, background: s.bg, color: s.color, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

// ── Blank form state helpers ──────────────────────────────────────────────────

function blankMed() {
  return { type: 'medication', name: '', dose: '', frequency: '', status: 'active', startDate: '', endDate: '', notes: '' };
}
function blankAppt() {
  return { type: 'appointment', name: '', appointmentDate: '', provider: '', notes: '', driveFileId: '', driveFileName: '' };
}
function blankDoc() {
  return { type: 'document', name: '', notes: '', driveFileId: '', driveFileName: '' };
}

// ── Inline form component ─────────────────────────────────────────────────────

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ width: 90, fontSize: 12, color: COLORS.text2, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function inputStyle(width) {
  return { fontSize: 13, padding: '4px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, width: width || '100%' };
}

function MedForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || blankMed());
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ padding: '12px 16px', background: COLORS.surface2, borderRadius: 8, marginBottom: 10 }}>
      <FieldRow label="Type">
        <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle(140)}>
          <option value="medication">Medication</option>
          <option value="supplement">Supplement</option>
        </select>
      </FieldRow>
      <FieldRow label="Name *">
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Metformin" style={inputStyle()} />
      </FieldRow>
      <FieldRow label="Dose">
        <input value={form.dose} onChange={e => set('dose', e.target.value)} placeholder="e.g. 500 mg" style={inputStyle(140)} />
      </FieldRow>
      <FieldRow label="Frequency">
        <input value={form.frequency} onChange={e => set('frequency', e.target.value)} placeholder="e.g. Twice daily" style={inputStyle()} />
      </FieldRow>
      <FieldRow label="Status">
        <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle(120)}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="stopped">Stopped</option>
        </select>
      </FieldRow>
      <FieldRow label="Start date">
        <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={inputStyle(150)} />
      </FieldRow>
      <FieldRow label="End date">
        <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} style={inputStyle(150)} />
      </FieldRow>
      <FieldRow label="Notes">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} />
      </FieldRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => form.name.trim() && onSave(form)} style={{ fontSize: 12, padding: '4px 14px', borderRadius: 5, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: '#fff', cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  );
}

function ApptForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || blankAppt());
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ padding: '12px 16px', background: COLORS.surface2, borderRadius: 8, marginBottom: 10 }}>
      <FieldRow label="Title *">
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Annual physical" style={inputStyle()} />
      </FieldRow>
      <FieldRow label="Date / time">
        <input type="datetime-local" value={form.appointmentDate} onChange={e => set('appointmentDate', e.target.value)} style={inputStyle(200)} />
      </FieldRow>
      <FieldRow label="Provider">
        <input value={form.provider} onChange={e => set('provider', e.target.value)} placeholder="e.g. Dr. Smith" style={inputStyle()} />
      </FieldRow>
      <FieldRow label="Notes">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} style={{ ...inputStyle(), resize: 'vertical' }} />
      </FieldRow>
      <FieldRow label="Drive file ID">
        <input value={form.driveFileId} onChange={e => set('driveFileId', e.target.value)} placeholder="optional" style={inputStyle()} />
      </FieldRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => form.name.trim() && onSave(form)} style={{ fontSize: 12, padding: '4px 14px', borderRadius: 5, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: '#fff', cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  );
}

function DocForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || blankDoc());
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ padding: '12px 16px', background: COLORS.surface2, borderRadius: 8, marginBottom: 10 }}>
      <FieldRow label="Title *">
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Blood test results May 2026" style={inputStyle()} />
      </FieldRow>
      <FieldRow label="Drive file ID">
        <input value={form.driveFileId} onChange={e => set('driveFileId', e.target.value)} placeholder="Paste Google Drive file ID" style={inputStyle()} />
      </FieldRow>
      <FieldRow label="Summary / notes">
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Paste AI summary or your own notes here" style={{ ...inputStyle(), resize: 'vertical' }} />
      </FieldRow>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button onClick={onCancel} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => form.name.trim() && onSave(form)} style={{ fontSize: 12, padding: '4px 14px', borderRadius: 5, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: '#fff', cursor: 'pointer' }}>Save</button>
      </div>
    </div>
  );
}

// ── Medication/Supplement row ─────────────────────────────────────────────────

function MedRow({ item, onEdit, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: COLORS.muted, width: 80, flexShrink: 0, textTransform: 'capitalize' }}>{item.type}</span>
        <span style={{ flex: 1, fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{item.name}</span>
        {item.dose && <span style={{ fontSize: 12, color: COLORS.text2 }}>{item.dose}</span>}
        {item.frequency && <span style={{ fontSize: 11, color: COLORS.muted }}>· {item.frequency}</span>}
        {statusBadge(item.status)}
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 13, cursor: 'pointer', padding: '0 4px' }}>{expanded ? '▲' : '▼'}</button>
        <button onClick={() => onEdit(item)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer', padding: '0 4px' }}>Edit</button>
        <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer', padding: '0 4px' }}>✕</button>
      </div>
      {expanded && (
        <div style={{ marginTop: 6, paddingLeft: 90, fontSize: 12, color: COLORS.text2, lineHeight: 1.7 }}>
          {item.start_date && <div>Started: {item.start_date}{item.end_date ? ` → ${item.end_date}` : ''}</div>}
          {item.notes && <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{item.notes}</div>}
        </div>
      )}
    </div>
  );
}

// ── Appointment row ───────────────────────────────────────────────────────────

function ApptRow({ item, onEdit, onRemove }) {
  const dateStr = item.appointment_date
    ? new Date(item.appointment_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : '(no date)';
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '10px 0', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: COLORS.text2, marginTop: 2 }}>
          {dateStr}
          {item.provider && <span style={{ marginLeft: 10, color: COLORS.muted }}>· {item.provider}</span>}
        </div>
        {item.notes && <div style={{ fontSize: 12, color: COLORS.text2, marginTop: 4, whiteSpace: 'pre-wrap' }}>{item.notes}</div>}
        {item.drive_file_id && (
          <a href={`https://drive.google.com/file/d/${item.drive_file_id}/view`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: COLORS.accent, marginTop: 4, display: 'inline-block' }}>
            📎 {item.drive_file_name || 'Drive file'}
          </a>
        )}
      </div>
      <button onClick={() => onEdit(item)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>Edit</button>
      <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>✕</button>
    </div>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ item, onEdit, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{item.name}</span>
        {item.drive_file_id && (
          <a href={`https://drive.google.com/file/d/${item.drive_file_id}/view`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: COLORS.accent }}>Open ↗</a>
        )}
        {item.notes && <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>{expanded ? 'Hide' : 'Summary'}</button>}
        <button onClick={() => onEdit(item)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>Edit</button>
        <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>
      {expanded && item.notes && (
        <div style={{ marginTop: 6, fontSize: 12, color: COLORS.text2, whiteSpace: 'pre-wrap', lineHeight: 1.6, padding: '8px 12px', background: COLORS.surface2, borderRadius: 6 }}>
          {item.notes}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

function HealthPanel({ healthItems, healthLoading, addHealthItem, updateHealthItem, removeHealthItem }) {
  const [tab, setTab]           = useState(0);
  const [adding, setAdding]     = useState(false);
  const [editItem, setEditItem] = useState(null);

  const meds  = (healthItems || []).filter(i => i.type === 'medication' || i.type === 'supplement');
  const appts = (healthItems || []).filter(i => i.type === 'appointment').sort((a, b) => {
    if (!a.appointment_date) return 1;
    if (!b.appointment_date) return -1;
    return a.appointment_date.localeCompare(b.appointment_date);
  });
  const docs  = (healthItems || []).filter(i => i.type === 'document');

  const handleSave = async (form) => {
    if (editItem) {
      const mapped = {
        name: form.name, dose: form.dose || null, frequency: form.frequency || null,
        status: form.status || 'active', start_date: form.startDate || null, end_date: form.endDate || null,
        notes: form.notes || null, drive_file_id: form.driveFileId || null, drive_file_name: form.driveFileName || null,
        appointment_date: form.appointmentDate ? new Date(form.appointmentDate).toISOString() : null,
        provider: form.provider || null, type: form.type,
      };
      await updateHealthItem(editItem.id, mapped);
      setEditItem(null);
    } else {
      await addHealthItem({
        type: form.type, name: form.name, dose: form.dose, frequency: form.frequency,
        status: form.status, startDate: form.startDate, endDate: form.endDate,
        notes: form.notes, driveFileId: form.driveFileId, driveFileName: form.driveFileName,
        appointmentDate: form.appointmentDate ? new Date(form.appointmentDate).toISOString() : null,
        provider: form.provider,
      });
      setAdding(false);
    }
  };

  const editInitial = (item) => {
    if (!item) return null;
    return {
      type: item.type, name: item.name, dose: item.dose || '', frequency: item.frequency || '',
      status: item.status || 'active', startDate: item.start_date || '', endDate: item.end_date || '',
      notes: item.notes || '', driveFileId: item.drive_file_id || '', driveFileName: item.drive_file_name || '',
      appointmentDate: item.appointment_date ? item.appointment_date.slice(0, 16) : '',
      provider: item.provider || '',
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: COLORS.bg }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>💊 Health</span>
          <button
            onClick={() => { setAdding(true); setEditItem(null); }}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: '#fff', cursor: 'pointer' }}
          >
            + Add
          </button>
        </div>
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => { setTab(i); setAdding(false); setEditItem(null); }}
              style={{
                fontSize: 12, padding: '6px 14px', border: 'none', borderBottom: tab === i ? `2px solid ${COLORS.accent}` : '2px solid transparent',
                background: 'transparent', color: tab === i ? COLORS.accent : COLORS.text2, cursor: 'pointer', fontWeight: tab === i ? 600 : 400,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {healthLoading && <div style={{ color: COLORS.muted, fontSize: 13 }}>Loading…</div>}

        {/* Add form */}
        {adding && !editItem && tab === 0 && <MedForm onSave={handleSave} onCancel={() => setAdding(false)} />}
        {adding && !editItem && tab === 1 && <ApptForm onSave={handleSave} onCancel={() => setAdding(false)} />}
        {adding && !editItem && tab === 2 && <DocForm onSave={handleSave} onCancel={() => setAdding(false)} />}

        {/* Medications & Supplements */}
        {tab === 0 && (
          <>
            {meds.length === 0 && !adding && (
              <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 8 }}>No medications or supplements logged yet.</div>
            )}
            {meds.map(item =>
              editItem?.id === item.id
                ? <MedForm key={item.id} initial={editInitial(item)} onSave={handleSave} onCancel={() => setEditItem(null)} />
                : <MedRow key={item.id} item={item} onEdit={setEditItem} onRemove={removeHealthItem} />
            )}
          </>
        )}

        {/* Appointments */}
        {tab === 1 && (
          <>
            {appts.length === 0 && !adding && (
              <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 8 }}>No appointments logged yet.</div>
            )}
            {appts.map(item =>
              editItem?.id === item.id
                ? <ApptForm key={item.id} initial={editInitial(item)} onSave={handleSave} onCancel={() => setEditItem(null)} />
                : <ApptRow key={item.id} item={item} onEdit={setEditItem} onRemove={removeHealthItem} />
            )}
          </>
        )}

        {/* Documents */}
        {tab === 2 && (
          <>
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Store references to medical documents in Drive. Use the AI coach to ask it to summarise a file via <code>get_drive_file</code>, then paste the summary into the notes field.
            </div>
            {docs.length === 0 && !adding && (
              <div style={{ color: COLORS.muted, fontSize: 13 }}>No documents logged yet.</div>
            )}
            {docs.map(item =>
              editItem?.id === item.id
                ? <DocForm key={item.id} initial={editInitial(item)} onSave={handleSave} onCancel={() => setEditItem(null)} />
                : <DocRow key={item.id} item={item} onEdit={setEditItem} onRemove={removeHealthItem} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { HealthPanel };
