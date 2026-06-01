import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { COLORS } from '../../constants.jsx';
import { doGmailFetchInbox } from './gmailTools.js';
import { gmailBtn, gmailBtnSm, formatEmailDate } from './emailUtils.js';

// FR#177 — Email > Contacts tab
// Shows inbox emails grouped by matching contact, with date-range filter.
// Owns its own email state — independent of EmailInboxPanel.

function buildDateQuery(fromDate, toDate) {
  const parts = [];
  if (fromDate) parts.push(`after:${fromDate.replace(/-/g, '/')}`);
  if (toDate)   parts.push(`before:${toDate.replace(/-/g, '/')}`);
  return parts.join(' ');
}

function defaultFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function EmailContactsPanel({ googleToken, contacts }) {
  const [emails, setEmails]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [fromDate, setFromDate]       = useState(defaultFrom);
  const [toDate, setToDate]           = useState(defaultTo);
  const [expandedKeys, setExpandedKeys] = useState(new Set());
  const [showUnknown, setShowUnknown] = useState(false);

  const loadEmails = async () => {
    if (!googleToken) return;
    setLoading(true);
    setError(null);
    try {
      const q = buildDateQuery(fromDate, toDate);
      const { emails: fetched } = await doGmailFetchInbox(googleToken, null, q);
      setEmails(fetched);
      setExpandedKeys(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Group emails by matching contact or unknown
  const { contactGroups, unknownEmails } = useMemo(() => {
    const groups = new Map(); // contactId → { contact, emails[] }
    const unknown = [];
    for (const email of emails) {
      const senderEmail = (email.fromEmail || '').toLowerCase();
      const match = (contacts || []).find(c =>
        (c.emails || []).some(e => (e.value || '').toLowerCase() === senderEmail)
      );
      if (match) {
        if (!groups.has(match.id)) groups.set(match.id, { contact: match, emails: [] });
        groups.get(match.id).emails.push(email);
      } else {
        unknown.push(email);
      }
    }
    // Sort groups by most-recent email first
    const sorted = [...groups.values()].sort((a, b) => {
      const latestA = Math.max(...a.emails.map(e => new Date(e.date).getTime() || 0));
      const latestB = Math.max(...b.emails.map(e => new Date(e.date).getTime() || 0));
      return latestB - latestA;
    });
    return { contactGroups: sorted, unknownEmails: unknown };
  }, [emails, contacts]);

  const toggleExpand = (key) => setExpandedKeys(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const totalContacts = contactGroups.length;
  const totalEmails   = emails.length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, background: COLORS.surface, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: COLORS.muted }}>Date range:</span>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          style={{ padding: '3px 6px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: COLORS.muted }}>to</span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          style={{ padding: '3px 6px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
        />
        <button style={gmailBtnSm} onClick={loadEmails} disabled={loading || !googleToken}>
          {loading ? 'Loading…' : 'Load from Gmail'}
        </button>
        {error && <span style={{ fontSize: 11, color: '#e05555' }}>Error: {error}</span>}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {emails.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>
            {googleToken ? 'Select a date range and click Load from Gmail' : 'Connect Gmail in Settings to use this tab'}
          </div>
        )}

        {contactGroups.map(({ contact, emails: cEmails }) => {
          const key = contact.id;
          const expanded = expandedKeys.has(key);
          const displayName = contact.displayName || contact.givenName || '(no name)';
          return (
            <div key={key} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              {/* Contact header row */}
              <div
                onClick={() => toggleExpand(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', background: expanded ? COLORS.surface2 : 'transparent', userSelect: 'none' }}
              >
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, flex: 1 }}>{displayName.toUpperCase()}</span>
                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: COLORS.inboxBg, color: COLORS.inbox }}>{cEmails.length} email{cEmails.length !== 1 ? 's' : ''}</span>
              </div>
              {/* Expanded email rows */}
              {expanded && cEmails.map(email => (
                <div key={email.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 14px 6px 30px', borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                  {email.isUnread && <div style={{ width: 5, height: 5, borderRadius: '50%', background: COLORS.inbox, flexShrink: 0, marginTop: 4 }} />}
                  {!email.isUnread && <div style={{ width: 5, flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, color: COLORS.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject || '(no subject)'}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{formatEmailDate(email.date)}</span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Unknown senders */}
        {unknownEmails.length > 0 && (
          <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <div
              onClick={() => setShowUnknown(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', cursor: 'pointer', userSelect: 'none' }}
            >
              <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{showUnknown ? '▾' : '▸'}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.muted, flex: 1 }}>UNKNOWN SENDERS</span>
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: COLORS.surface3, color: COLORS.muted }}>{unknownEmails.length}</span>
            </div>
            {showUnknown && unknownEmails.map(email => (
              <div key={email.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 14px 6px 30px', borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface }}>
                <span style={{ fontSize: 11, color: COLORS.text2, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.fromName || email.fromEmail}</span>
                <span style={{ fontSize: 12, color: COLORS.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject || '(no subject)'}</span>
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{formatEmailDate(email.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {emails.length > 0 && (
        <div style={{ padding: '6px 14px', borderTop: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.muted, flexShrink: 0, background: COLORS.surface }}>
          {totalContacts} contact{totalContacts !== 1 ? 's' : ''} · {totalEmails} email{totalEmails !== 1 ? 's' : ''} in date range
          {unknownEmails.length > 0 && ` · ${unknownEmails.length} unknown sender${unknownEmails.length !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  );
}

EmailContactsPanel.propTypes = {
  googleToken: PropTypes.string,
  contacts:    PropTypes.array,
};

export { EmailContactsPanel };
