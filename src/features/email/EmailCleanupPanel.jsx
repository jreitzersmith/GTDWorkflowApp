import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { supabase, queueEntryToRow } from "../../api/supabase.js";
import {
  doGmailFetchLabelsRaw, doGmailCreateLabel,
  doGmailBulkAction, doGmailCreateFilter,
} from "./gmailTools.js";
import { sleep, gmailBtnSm, gmailBtnSmDanger } from "./emailUtils.js";

// Bulk-action queue with newsletter/promotional discovery prompts.
// Each queue entry runs a Gmail search, applies a label, and optionally creates a filter.
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
                // Still can't find it — proceed without a label ID so the bulk action can still run
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

export { EmailCleanupPanel };
