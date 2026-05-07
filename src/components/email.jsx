import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";
import { supabase, queueEntryToRow } from "../api/supabase.js";
import {
  doGmailFetchInbox, doGmailGetMessageBody,
  doGmailFetchLabelsRaw, doGmailCreateLabel,
  doGmailBatchLabel, doGmailBulkAction,
  doGmailFetchFilters, doGmailCreateFilter, doGmailDeleteFilter,
} from "../api/gmailTools.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));

function avatarInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || '?').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  { bg: '#1e2a3a', text: '#5a8fd4' }, { bg: '#1a2a1e', text: '#5ab878' },
  { bg: '#2a1e14', text: '#d4845a' }, { bg: '#1e1a2a', text: '#9a8ad4' },
  { bg: '#2a1e1a', text: '#d4765a' }, { bg: '#152520', text: '#6ec6a8' },
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatEmailDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── EmailManagementView shared styles ────────────────────────────────────────
const gmailBtn = (extra = {}) => ({
  fontSize: 12, padding: '5px 10px', borderRadius: 7,
  border: `1px solid ${COLORS.border}`, background: 'transparent',
  color: COLORS.text2, fontFamily: 'inherit', cursor: 'pointer', ...extra,
});
const gmailBtnPrimary  = gmailBtn({ background: COLORS.inboxBg, color: COLORS.inbox, borderColor: COLORS.inbox });
const gmailBtnSm       = gmailBtn({ fontSize: 11, padding: '3px 8px' });
const gmailBtnSmDanger = gmailBtn({ fontSize: 11, padding: '3px 8px', color: '#e05555', borderColor: '#5a2020' });

// ── EmailInboxPanel ───────────────────────────────────────────────────────────
function EmailInboxPanel({ googleToken, googleScope, processEmailWithAI }) {
  const [inboxEmails, setInboxEmails] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState(null);
  const [inboxNextPageToken, setInboxNextPageToken] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [emailDetail, setEmailDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Load inbox on mount / when token changes
  useEffect(() => {
    if (googleToken && inboxEmails.length === 0 && !inboxLoading) loadInbox();
  }, [googleToken]); // eslint-disable-line

  // Fetch full message body when email is selected
  useEffect(() => {
    if (!selectedId || !googleToken) { setEmailDetail(null); return; }
    setDetailLoading(true);
    setEmailDetail(null);
    doGmailGetMessageBody(selectedId, googleToken)
      .then(setEmailDetail)
      .catch(e => setEmailDetail({ error: e.message }))
      .finally(() => setDetailLoading(false));
  }, [selectedId, googleToken]);

  const loadInbox = async (pageToken = null) => {
    setInboxLoading(true);
    if (!pageToken) setInboxError(null);
    try {
      const { emails, nextPageToken } = await doGmailFetchInbox(googleToken, pageToken);
      setInboxEmails(prev => pageToken ? [...prev, ...emails] : emails);
      setInboxNextPageToken(nextPageToken);
    }
    catch (e) { setInboxError(e.message); }
    finally { setInboxLoading(false); }
  };

  const toggleCheck = (id) => setCheckedIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Email list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, background: COLORS.surface }}>
          <span style={{ flex: 1, fontSize: 12, color: COLORS.muted }}>
            {inboxLoading ? 'Loading…' : inboxError ? `Error: ${inboxError}` : `${inboxEmails.length} messages${checkedIds.size ? ` · ${checkedIds.size} selected` : ''}`}
          </span>
          <button style={gmailBtnSm} onClick={() => { setInboxNextPageToken(null); loadInbox(null); }} disabled={inboxLoading}>↻ Refresh</button>
          {checkedIds.size > 0 && (
            <>
              <button style={gmailBtnSmDanger} disabled={archiving} onClick={async () => {
                const ids = [...checkedIds];
                if (googleScope !== 'full') { setInboxError('Archive requires Gmail write access — reconnect in Settings.'); return; }
                setArchiving(true);
                try {
                  await doGmailBatchLabel(ids, [], ['INBOX'], googleToken);
                  setInboxEmails(prev => prev.filter(e => !checkedIds.has(e.id)));
                  setCheckedIds(new Set());
                  if (checkedIds.has(selectedId)) setSelectedId(null);
                } catch (e) {
                  setInboxError(`Archive failed: ${e.message}`);
                } finally {
                  setArchiving(false);
                }
              }}>{archiving ? 'Archiving…' : `Archive (${checkedIds.size})`}</button>
              <button style={gmailBtnPrimary} onClick={() => {
                const email = emailDetail || inboxEmails.find(e => e.id === [...checkedIds][0]);
                if (email) processEmailWithAI(email);
              }}>Process with AI ↗</button>
            </>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {inboxLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>Loading inbox…</div>
          )}
          {!inboxLoading && inboxEmails.length === 0 && !inboxError && (
            <div style={{ padding: 24, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>Inbox is empty</div>
          )}
          {inboxEmails.map(email => {
            const isSelected = selectedId === email.id;
            const isChecked = checkedIds.has(email.id);
            const av = avatarColor(email.fromName);
            return (
              <div
                key={email.id}
                onClick={() => setSelectedId(isSelected ? null : email.id)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 14px', borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', background: isSelected ? COLORS.projectBg : 'transparent', transition: 'background 0.1s' }}
              >
                {/* Checkbox */}
                <div
                  onClick={e => { e.stopPropagation(); toggleCheck(email.id); }}
                  style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${isChecked ? COLORS.project : COLORS.border}`, background: isChecked ? COLORS.project : 'transparent', flexShrink: 0, marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  {isChecked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1, marginTop: -1 }}>✓</span>}
                </div>
                {/* Avatar */}
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: av.bg, color: av.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                  {avatarInitials(email.fromName)}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: email.isUnread ? 600 : 400, color: COLORS.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>{email.fromName}</span>
                    <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{formatEmailDate(email.date)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: email.isUnread ? COLORS.text : COLORS.text2, fontWeight: email.isUnread ? 500 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 1 }}>{email.subject || '(no subject)'}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email.snippet}</div>
                </div>
                {email.isUnread && <div style={{ width: 6, height: 6, borderRadius: '50%', background: COLORS.project, flexShrink: 0, marginTop: 6 }} />}
              </div>
            );
          })}
          {/* Load More */}
          {inboxNextPageToken && (
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${COLORS.border}`, textAlign: 'center' }}>
              <button style={gmailBtnSm} onClick={() => loadInbox(inboxNextPageToken)} disabled={inboxLoading}>
                {inboxLoading ? 'Loading…' : `Load more`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedId && (
        <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: COLORS.surface }}>
          {detailLoading && <div style={{ padding: 16, color: COLORS.muted, fontSize: 13 }}>Loading…</div>}
          {emailDetail?.error && <div style={{ padding: 16, color: '#e05555', fontSize: 12 }}>Error: {emailDetail.error}</div>}
          {emailDetail && !emailDetail.error && (
            <>
              <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, marginBottom: 8, color: COLORS.text }}>{emailDetail.subject || '(no subject)'}</div>
                <div style={{ fontSize: 11, color: COLORS.text2, lineHeight: 1.7 }}>
                  <div><span style={{ color: COLORS.muted }}>From: </span>{emailDetail.from}</div>
                  {emailDetail.to && <div><span style={{ color: COLORS.muted }}>To: </span>{emailDetail.to}</div>}
                  <div><span style={{ color: COLORS.muted }}>Date: </span>{emailDetail.date}</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', fontSize: 12, color: COLORS.text2, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {emailDetail.body || emailDetail.snippet || '(no content)'}
              </div>
              <div style={{ padding: '10px 14px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button style={{ ...gmailBtn(), textAlign: 'left', background: COLORS.inboxBg, color: COLORS.inbox, borderColor: COLORS.inbox, fontWeight: 500 }}
                  onClick={() => processEmailWithAI(emailDetail)}>
                  Process with AI ↗
                </button>
                <button style={{ ...gmailBtn(), textAlign: 'left' }}
                  disabled={archiving}
                  onClick={async () => {
                    if (googleScope !== 'full') { setInboxError('Archive requires Gmail write access — reconnect in Settings.'); return; }
                    setArchiving(true);
                    try {
                      await doGmailBatchLabel([selectedId], [], ['INBOX'], googleToken);
                      setInboxEmails(prev => prev.filter(e => e.id !== selectedId));
                      setSelectedId(null);
                    } catch (e) {
                      setInboxError(`Archive failed: ${e.message}`);
                    } finally {
                      setArchiving(false);
                    }
                  }}>
                  {archiving ? 'Archiving…' : 'Archive'}
                </button>
                <button style={{ ...gmailBtn(), textAlign: 'left', color: COLORS.muted }} onClick={() => setSelectedId(null)}>Close</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
EmailInboxPanel.propTypes = {
  googleToken:        PropTypes.string.isRequired,
  googleScope:        PropTypes.string,
  processEmailWithAI: PropTypes.func.isRequired,
};

// ── EmailCleanupPanel ─────────────────────────────────────────────────────────
function EmailCleanupPanel({ gmailQueue, setGmailQueue, googleToken, authUser, openCoachChat }) {
  const [queueStatus, setQueueStatus] = useState({});
  const [runAllProgress, setRunAllProgress] = useState({ running: false, current: 0, total: 0 });

  const runQueueEntry = async (entry) => {
    // Check token expiry before touching the API
    try {
      const stored = JSON.parse(localStorage.getItem('gtd_google_token') || '{}');
      if (!stored.expiry || Date.now() > stored.expiry) {
        setQueueStatus(s => ({ ...s, [entry.id]: { error: 'Gmail session expired — please reconnect in Settings.' } }));
        return;
      }
    } catch { /* ignore parse errors, let the API call fail naturally */ }

    setQueueStatus(s => ({ ...s, [entry.id]: { running: true } }));
    try {
      // Resolve label ID if not stored
      let labelId = entry.labelId;
      if (!labelId) {
        const normName = s => s.trim().toLowerCase();
        const labels = await doGmailFetchLabelsRaw(googleToken);
        const match = labels.find(l => normName(l.name) === normName(entry.labelName));
        if (match) {
          labelId = match.id;
        } else {
          try {
            const created = await doGmailCreateLabel(entry.labelName, googleToken);
            labelId = created.label_id;
          } catch (createErr) {
            // Gmail returns 409 if label already exists (e.g. created manually, nested path, or casing diff)
            // Re-fetch with case-insensitive match before giving up
            if (createErr.message && (createErr.message.toLowerCase().includes('exist') || createErr.message.toLowerCase().includes('conflict') || createErr.message.includes('409'))) {
              const retryLabels = await doGmailFetchLabelsRaw(googleToken);
              const retryMatch = retryLabels.find(l => normName(l.name) === normName(entry.labelName));
              if (retryMatch) {
                labelId = retryMatch.id;
              } else {
                // Still can't find it — skip label resolution and proceed without a label ID
                // so the bulk action can still run (labelling step will be skipped)
                console.warn(`Could not resolve label "${entry.labelName}" after conflict — proceeding without label`);
              }
            } else {
              throw createErr;
            }
          }
          if (labelId) setGmailQueue(prev => prev.map(q => q.id === entry.id ? { ...q, labelId } : q));
        }
      }
      const addIds = [labelId].filter(Boolean);
      const removeIds = entry.archive ? ['INBOX'] : [];
      const result = await doGmailBulkAction(entry.query, addIds, removeIds, googleToken);

      // Collect any warnings (partial bulk failure, filter creation failure)
      const warnings = [];
      if (result.errors && result.errors.length > 0) {
        warnings.push(`${result.succeeded ?? 0}/${result.matched ?? '?'} messages updated (some chunks failed)`);
      }

      if (entry.createFilter) {
        try {
          await doGmailCreateFilter(null, null, null, entry.query, addIds, removeIds, googleToken);
        } catch (filterErr) {
          warnings.push(`Filter not created: ${filterErr.message}`);
        }
      }

      const updatedEntry = { ...entry, status: 'done', runCount: result.succeeded ?? 0 };
      setGmailQueue(prev => prev.map(q => q.id === entry.id ? updatedEntry : q));
      if (authUser) {
        supabase.from('gmail_queue').upsert(queueEntryToRow(updatedEntry, authUser.id)).then(({ error }) => {
          if (error) console.error('gmail_queue run update error', error);
        });
      }
      const countLabel = result.errors?.length
        ? `${result.succeeded ?? 0}/${result.matched ?? '?'} updated`
        : `${result.succeeded ?? 0} updated`;
      const resultMsg = warnings.length ? `${countLabel} ⚠ ${warnings.join('; ')}` : countLabel;
      setQueueStatus(s => ({ ...s, [entry.id]: { running: false, result: resultMsg } }));
    } catch (e) {
      // Translate common API error codes into actionable messages
      let msg = e.message || 'Unknown error';
      if (msg.includes('401') || msg.toLowerCase().includes('invalid credentials') || msg.toLowerCase().includes('unauthorized')) {
        msg = 'Gmail session expired — please reconnect in Settings.';
      } else if (msg.includes('429') || msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many')) {
        msg = 'Rate limited by Gmail — wait a minute and try again.';
      }
      setQueueStatus(s => ({ ...s, [entry.id]: { running: false, error: msg } }));
    }
  };

  const runAllQueue = async () => {
    const pending = gmailQueue.filter(e => e.status !== 'done');
    if (pending.length === 0) return;
    setRunAllProgress({ running: true, current: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      setRunAllProgress(p => ({ ...p, current: i + 1 }));
      await runQueueEntry(pending[i]);
      if (i < pending.length - 1) await sleep(1500);
    }
    setRunAllProgress({ running: false, current: 0, total: 0 });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Discovery section */}
      <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>Newsletter discovery</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>Sample your inbox and identify promotional senders</div>
          </div>
        </div>
        <div style={{ margin: '0 16px 14px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6, marginBottom: 10 }}>
            The AI will sample your inbox, build a targeted search query for each sender, and ask for confirmation. Once confirmed, it will create the label (if needed) and save to the queue with a Gmail filter so future emails are labeled automatically.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              ['Find and Label Newsletters', `Search my inbox and identify newsletter subscriptions. For each one:\n1. Sample the emails and build the most restrictive query (prefer exact sending address; add the keyword "unsubscribe" if the sample emails contain an unsubscribe footer, since transactional mail never does).\n2. Show me what the query will match and explicitly note any emails from the same sender it will NOT match (e.g. transactional alerts).\n3. Ask for confirmation.\n4. Once I confirm, use gmail_queue_add with create_filter set to true so the label and Gmail filter are both created when the queue runs.`],
              ['Find and Label Promotional Emails', `Search my inbox for promotional and marketing emails from online retailers and services. For each sender:\n1. Sample their emails and build the most restrictive query (prefer exact subdomain; add the keyword "unsubscribe" if the sample emails contain an unsubscribe footer; add subject keywords only to sharpen scope further).\n2. Clearly state what the query will NOT match — especially order receipts, shipping confirmations, or account alerts from the same domain.\n3. Ask for confirmation.\n4. Once I confirm, use gmail_queue_add with create_filter set to true so the label and Gmail filter are both created when the queue runs.`],
              ['Find specific sender…', `I want to label and filter emails from a specific sender. Ask me which sender to look into, then:\n1. Sample their emails and build the most restrictive query possible.\n2. Explain what it will and won't match.\n3. Ask me to confirm.\n4. Once confirmed, use gmail_queue_add with create_filter set to true so the label and Gmail filter are both created when the queue runs.`],
            ].map(([label, prompt]) => (
              <button key={label} style={gmailBtnSm} onClick={() => openCoachChat(prompt)}>
                {label} ↗
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Queue section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>Bulk action queue · {gmailQueue.length} saved</span>
          {gmailQueue.some(e => e.status !== 'done') && (
            <button
              style={{ ...gmailBtnSm, opacity: runAllProgress.running ? 0.6 : 1, cursor: runAllProgress.running ? 'default' : 'pointer' }}
              onClick={runAllQueue}
              disabled={runAllProgress.running}
            >
              {runAllProgress.running
                ? `Running ${runAllProgress.current} of ${runAllProgress.total}…`
                : 'Run all'}
            </button>
          )}
        </div>
        {gmailQueue.length === 0 && (
          <div style={{ padding: '20px 16px', fontSize: 12, color: COLORS.muted, textAlign: 'center' }}>
            No entries yet — use the discovery buttons above or ask the AI coach to scan your inbox.
          </div>
        )}
        {gmailQueue.map(entry => {
          const qs = queueStatus[entry.id] || {};
          const isDone = entry.status === 'done';
          return (
            <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, opacity: isDone ? 0.65 : 1 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.project, flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 2 }}>{entry.labelName}</div>
                <div style={{ fontSize: 11, color: COLORS.project, fontFamily: 'monospace', marginBottom: 3, wordBreak: 'break-all' }}>{entry.query}</div>
                <div style={{ fontSize: 11, color: COLORS.text2, lineHeight: 1.5 }}>{entry.description}</div>
                <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>
                  {new Date(entry.savedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {entry.archive ? 'archive' : 'label only'}{entry.createFilter ? ' + create filter' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                {qs.running && <span style={{ fontSize: 10, color: COLORS.waiting, padding: '2px 7px', background: COLORS.waitingBg, borderRadius: 99 }}>running…</span>}
                {!qs.running && isDone && <span style={{ fontSize: 10, color: COLORS.next, padding: '2px 7px', background: COLORS.nextBg, borderRadius: 99 }}>{entry.runCount ?? qs.result ?? 'done'}</span>}
                {!qs.running && qs.error && (
                  <span style={{ fontSize: 10, color: '#e05555', padding: '2px 7px', background: '#2a1010', borderRadius: 6, maxWidth: 180, whiteSpace: 'normal', lineHeight: 1.4, textAlign: 'right' }} title={qs.error}>
                    ⚠ {qs.error}
                  </span>
                )}
                {!qs.running && !isDone && !qs.error && <span style={{ fontSize: 10, color: COLORS.muted, padding: '2px 7px', background: COLORS.surface2, borderRadius: 99, border: `1px solid ${COLORS.border}` }}>pending</span>}
                <button style={gmailBtnSm} disabled={qs.running} onClick={() => runQueueEntry(entry)}>{isDone ? 'Re-run' : 'Run'}</button>
                <button style={gmailBtnSmDanger} disabled={qs.running} onClick={() => {
                    setGmailQueue(prev => prev.filter(e => e.id !== entry.id));
                    if (authUser) {
                      supabase.from('gmail_queue').delete().match({ id: entry.id, user_id: authUser.id }).then(({ error }) => {
                        if (error) console.error('gmail_queue delete error', error);
                      });
                    }
                  }}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
EmailCleanupPanel.propTypes = {
  gmailQueue:    PropTypes.arrayOf(PropTypes.object).isRequired,
  setGmailQueue: PropTypes.func.isRequired,
  googleToken:   PropTypes.string.isRequired,
  authUser:      PropTypes.object,
  openCoachChat: PropTypes.func.isRequired,
};

// ── EmailRulesPanel ───────────────────────────────────────────────────────────
function EmailRulesPanel({ googleToken, googleScope }) {
  const [gmailLabels, setGmailLabels] = useState([]);
  const [gmailFilters, setGmailFilters] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);
  const [deletingFilterId, setDeletingFilterId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const [labelFilter, setLabelFilter] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Load rules on mount / when token changes
  useEffect(() => {
    if (googleToken && !rulesLoading && gmailLabels.length === 0) loadRules();
  }, [googleToken]); // eslint-disable-line

  const loadRules = async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const [labels, filters] = await Promise.all([
        doGmailFetchLabelsRaw(googleToken),
        doGmailFetchFilters(googleToken),
      ]);
      setGmailLabels(labels.filter(l => !l.type || l.type === 'user'));
      setGmailFilters(filters);
    } catch (e) { setRulesError(e.message); }
    finally { setRulesLoading(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {rulesLoading && <div style={{ padding: 20, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>Loading…</div>}
      {rulesError && (
        <div style={{ margin: '8px 14px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {rulesError}</span>
          <button onClick={() => setRulesError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Filters */}
      {!rulesLoading && (
        <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }} onClick={() => setFiltersOpen(v => !v)}>
            <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
              Filters <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>
                {filterSearch.trim() ? `${gmailFilters.filter(f => { const t = filterSearch.trim().toLowerCase(); const c = f.criteria || {}; return [c.from, c.to, c.subject, c.query].some(v => v?.toLowerCase().includes(t)); }).length} of ${gmailFilters.length}` : gmailFilters.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button style={gmailBtnSm} onClick={e => { e.stopPropagation(); loadRules(); }}>↻</button>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{filtersOpen ? '▾' : '▸'}</span>
            </div>
          </div>
          {filtersOpen && (
            <div style={{ padding: '6px 16px 8px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Filter by from, subject, query…"
                style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 9px', fontFamily: 'inherit', fontSize: 12, color: COLORS.text, outline: 'none' }}
              />
              {filterSearch && (
                <button onClick={() => setFilterSearch('')}
                  style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                  ✕
                </button>
              )}
            </div>
          )}
          {filtersOpen && (() => {
            const term = filterSearch.trim().toLowerCase();
            const visible = term
              ? gmailFilters.filter(f => { const c = f.criteria || {}; return [c.from, c.to, c.subject, c.query].some(v => v?.toLowerCase().includes(term)); })
              : gmailFilters;
            return visible.map(f => {
            const c = f.criteria || {};
            const a = f.action || {};
            const criteriaChips = [
              c.from    && { label: `from:${c.from}` },
              c.to      && { label: `to:${c.to}` },
              c.subject && { label: `subject:${c.subject}` },
              c.query   && { label: c.query },
            ].filter(Boolean);
            const resolveLabelId = id => {
              const match = gmailLabels.find(l => l.id === id);
              return match ? match.name : id;
            };
            const addChips    = (a.addLabelIds    || []).map(id => ({ label: `+ ${resolveLabelId(id)}`, color: COLORS.next,   bg: COLORS.nextBg }));
            const removeChips = (a.removeLabelIds || []).map(id => ({ label: `− ${resolveLabelId(id)}`, color: '#e05555',     bg: '#2a1010' }));
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
                    {criteriaChips.map((ch, i) => (
                      <span key={i} style={{ fontSize: 11, background: COLORS.projectBg, color: COLORS.project, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{ch.label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[...addChips, ...removeChips].map((ch, i) => (
                      <span key={i} style={{ fontSize: 11, background: ch.bg, color: ch.color, padding: '2px 8px', borderRadius: 99 }}>{ch.label}</span>
                    ))}
                  </div>
                </div>
                <button style={gmailBtnSmDanger} disabled={deletingFilterId === f.id} onClick={async () => {
                  if (googleScope !== 'full') { setRulesError('Deleting filters requires Gmail write access — reconnect in Settings.'); return; }
                  setDeletingFilterId(f.id);
                  try {
                    await doGmailDeleteFilter(f.id, googleToken);
                    setGmailFilters(prev => prev.filter(x => x.id !== f.id));
                  } catch (e) {
                    setRulesError(`Delete failed: ${e.message}`);
                  } finally {
                    setDeletingFilterId(null);
                  }
                }}>{deletingFilterId === f.id ? 'Deleting…' : 'Delete'}</button>
              </div>
            );
          }); })()}
          {filtersOpen && gmailFilters.length === 0 && !rulesLoading && (
            <div style={{ padding: '10px 16px', fontSize: 12, color: COLORS.muted }}>No filters found.</div>
          )}
          {filtersOpen && gmailFilters.length > 0 && filterSearch.trim() && (() => {
            const term = filterSearch.trim().toLowerCase();
            const count = gmailFilters.filter(f => { const c = f.criteria || {}; return [c.from, c.to, c.subject, c.query].some(v => v?.toLowerCase().includes(term)); }).length;
            return count === 0 ? <div style={{ padding: '10px 16px', fontSize: 12, color: COLORS.muted }}>No filters match "{filterSearch}"</div> : null;
          })()}
        </div>
      )}

      {/* Labels */}
      {!rulesLoading && (() => {
        const allSorted = [...gmailLabels].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        const filterTerm = labelFilter.trim().toLowerCase();
        const sortedLabels = filterTerm ? allSorted.filter(l => l.name.toLowerCase().includes(filterTerm)) : allSorted;
        // Group by first character (uppercase), non-alpha goes under '#'
        const groups = {};
        sortedLabels.forEach(label => {
          const ch = label.name[0]?.toUpperCase() || '#';
          const key = /[A-Z]/.test(ch) ? ch : '#';
          if (!groups[key]) groups[key] = [];
          groups[key].push(label);
        });
        const letters = Object.keys(groups).sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b));
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }} onClick={() => setLabelsOpen(v => !v)}>
              <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                Labels{' '}
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>
                  {filterTerm ? `${sortedLabels.length} of ${gmailLabels.length}` : gmailLabels.length}
                </span>
              </div>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{labelsOpen ? '▾' : '▸'}</span>
            </div>
            {labelsOpen && (
              <>
                {/* Filter input */}
                <div style={{ padding: '6px 16px 8px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    value={labelFilter}
                    onChange={e => setLabelFilter(e.target.value)}
                    placeholder="Filter labels…"
                    style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 9px', fontFamily: 'inherit', fontSize: 12, color: COLORS.text, outline: 'none' }}
                  />
                  {labelFilter && (
                    <button onClick={() => setLabelFilter('')}
                      style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                      ✕
                    </button>
                  )}
                </div>
                {/* Letter quicklinks — only shown when not filtering */}
                {!filterTerm && letters.length > 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '4px 16px 8px' }}>
                    {letters.map(letter => (
                      <button key={letter} onClick={() => document.getElementById(`label-group-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4 }}>
                        {letter}
                      </button>
                    ))}
                  </div>
                )}
                {/* Label groups */}
                <div>
                  {sortedLabels.length === 0 && filterTerm ? (
                    <div style={{ padding: '12px 16px', fontSize: 12, color: COLORS.muted }}>No labels match "{labelFilter}"</div>
                  ) : letters.map(letter => {
                    const groupLabels = groups[letter];
                    return (
                      <div key={letter} id={filterTerm ? undefined : `label-group-${letter}`}>
                        {/* Letter divider */}
                        <div style={{ padding: '4px 16px', background: COLORS.surface2, borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 600, color: COLORS.muted, letterSpacing: '0.06em' }}>
                          {letter}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                          {groupLabels.map((label, i) => (
                            <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderTop: `1px solid ${COLORS.border}`, borderRight: i % 2 === 0 ? `1px solid ${COLORS.border}` : 'none' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: label.color?.backgroundColor || COLORS.muted, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: COLORS.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {gmailLabels.length === 0 && (
                    <div style={{ padding: '10px 16px', fontSize: 12, color: COLORS.muted }}>No user labels found.</div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
EmailRulesPanel.propTypes = {
  googleToken:  PropTypes.string.isRequired,
  googleScope:  PropTypes.string,
};

// ── EmailManagementView ───────────────────────────────────────────────────────
function EmailManagementView({ googleToken, googleScope, gmailQueue, setGmailQueue, emailTab, setEmailTab, processEmailWithAI, openCoachChat, authUser }) {
  const tabStyle = (t) => ({
    padding: '9px 14px', fontSize: 13, cursor: 'pointer',
    color: emailTab === t ? COLORS.text : COLORS.text2,
    fontWeight: emailTab === t ? 500 : 400,
    borderBottom: `2px solid ${emailTab === t ? COLORS.inbox : 'transparent'}`,
    marginBottom: -1,
  });

  if (!googleToken) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: COLORS.text2 }}>
        <div style={{ fontSize: 32 }}>📧</div>
        <div style={{ fontSize: 14, color: COLORS.text2 }}>Connect Gmail to use Email Management</div>
        <div style={{ fontSize: 12, color: COLORS.muted }}>Go to Settings → Gmail to connect your account</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, padding: '0 16px', flexShrink: 0 }}>
        {['inbox', 'cleanup', 'rules'].map(t => (
          <div key={t} style={tabStyle(t)} onClick={() => setEmailTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'cleanup' && gmailQueue.length > 0 && (
              <span style={{ marginLeft: 5, fontSize: 10, background: COLORS.surface3, color: COLORS.muted, padding: '1px 6px', borderRadius: 10 }}>{gmailQueue.length}</span>
            )}
          </div>
        ))}
      </div>

      {emailTab === 'inbox'   && <EmailInboxPanel   googleToken={googleToken} googleScope={googleScope} processEmailWithAI={processEmailWithAI} />}
      {emailTab === 'cleanup' && <EmailCleanupPanel gmailQueue={gmailQueue} setGmailQueue={setGmailQueue} googleToken={googleToken} authUser={authUser} openCoachChat={openCoachChat} />}
      {emailTab === 'rules'   && <EmailRulesPanel   googleToken={googleToken} googleScope={googleScope} />}
    </div>
  );
}
EmailManagementView.propTypes = {
  googleToken:        PropTypes.string.isRequired,
  googleScope:        PropTypes.string,
  gmailQueue:         PropTypes.arrayOf(PropTypes.object).isRequired,
  setGmailQueue:      PropTypes.func.isRequired,
  emailTab:           PropTypes.string.isRequired,
  setEmailTab:        PropTypes.func.isRequired,
  processEmailWithAI: PropTypes.func.isRequired,
  openCoachChat:      PropTypes.func.isRequired,
  authUser:           PropTypes.object,
};

// ── CalendarSuggestionsBar ───────────────────────────────────────────────────


export { AVATAR_COLORS, EmailInboxPanel, EmailCleanupPanel, EmailRulesPanel, EmailManagementView };
