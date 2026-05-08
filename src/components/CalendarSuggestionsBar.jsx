import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";
import { BUCKET_OPTS } from "./InboxBars.jsx";

function CalendarSuggestionsBar({ suggestions, onToggle, onChangeBucket, onAccept, onDismiss }) {
  const selectedCount = suggestions.filter(s => s.checked).length;
  const isEmpty = suggestions.length === 0;
  return (
    <div style={{ background: COLORS.calendarBg, border: `1px solid ${COLORS.calendar}44`, borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {isEmpty ? '✓ No tasks suggested' : '📅 Suggested tasks from calendar event — check to add'}
      </div>
      {isEmpty ? (
        <div style={{ fontSize: 12, color: COLORS.muted }}>No preparation or follow-up tasks identified for this event.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s, idx) => (
            <div key={s.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={s.checked}
                onChange={() => onToggle(idx)}
                style={{ marginTop: 3, accentColor: COLORS.calendar, flexShrink: 0, cursor: 'pointer' }}
              />
              <span style={{ flex: 1, fontSize: 12, color: s.checked ? COLORS.text : COLORS.muted, textDecoration: s.checked ? 'none' : 'line-through', lineHeight: 1.45 }}>
                {s.text}
              </span>
              <select
                value={s.bucket}
                onChange={e => onChangeBucket(idx, e.target.value)}
                disabled={!s.checked}
                style={{ fontSize: 11, background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: s.checked ? COLORS.text2 : COLORS.muted, padding: '2px 5px', fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0 }}
              >
                {BUCKET_OPTS.map(b => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {!isEmpty && (
          <button
            onClick={onAccept}
            style={{ padding: '4px 14px', borderRadius: 6, border: `1px solid ${COLORS.calendar}`, background: 'transparent', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
          >
            {selectedCount > 0 ? `Add ${selectedCount} task${selectedCount !== 1 ? 's' : ''} ✓` : 'Add Selected'}
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

CalendarSuggestionsBar.propTypes = {
  suggestions: PropTypes.arrayOf(PropTypes.shape({
    id:      PropTypes.string.isRequired,
    text:    PropTypes.string.isRequired,
    checked: PropTypes.bool.isRequired,
    bucket:  PropTypes.string.isRequired,
  })).isRequired,
  onToggle:       PropTypes.func.isRequired,
  onChangeBucket: PropTypes.func.isRequired,
  onAccept:       PropTypes.func.isRequired,
  onDismiss:      PropTypes.func.isRequired,
};

export { CalendarSuggestionsBar };