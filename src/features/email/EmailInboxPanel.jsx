import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { ProjectTreePicker } from "../tasks/ProjectTreePicker.jsx";
import { doGmailFetchInbox, doGmailGetMessageBody, doGmailBatchLabel } from "./gmailTools.js";
import { avatarInitials, avatarColor, formatEmailDate, gmailBtn, gmailBtnPrimary, gmailBtnSm, gmailBtnSmDanger } from "./emailUtils.js";

// Inbox list with checkboxes, avatar chips, pagination, and a detail slide-out panel.
function EmailInboxPanel({ googleToken, googleScope, processEmailWithAI, attachEmailToTask, tasks, logEmailAsReceipt, markAsSpam }) {
  const [inboxEmails, setInboxEmails] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState(null);
  const [inboxNextPageToken, setInboxNextPageToken] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [emailDetail, setEmailDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState(null); // null | 'loading' | 'ok' | error string
  const [spamStatus, setSpamStatus] = useState(null);   // null | 'loading' | 'ok' | error string

  // Task-link picker state
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [linkedConfirm, setLinkedConfirm] = useState(null);
  const pickerRef = useRef(null);

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

  // Reset task picker and receipt status when email changes
  useEffect(() => {
    setShowTaskPicker(false);
    setLinkedConfirm(null);
    setReceiptStatus(null);
    setSpamStatus(null);
  }, [selectedId]);

  // Close picker on outside click
  useEffect(() => {
    if (!showTaskPicker) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowTaskPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTaskPicker]);

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

  const handleLinkToTask = (taskId, taskText) => {
    const email = emailDetail;
    if (!email || !attachEmailToTask) return;
    const att = {
      id: email.id || selectedId,
      name: email.subject || '(no subject)',
      mimeType: 'message/rfc822',
      url: `https://mail.google.com/mail/#inbox/${email.id || selectedId}`,
    };
    attachEmailToTask(taskId, att);
    setShowTaskPicker(false);
    // Note: attachEmailToTask deduplicates by id — linking the same email twice is a no-op
    setLinkedConfirm(taskText);
    setTimeout(() => setLinkedConfirm(null), 4000);
  };

  const allTasks = tasks || [];
  const isContainer = t => ['category', 'subcategory', 'project', 'subproject'].includes(t.nodeType);
  // All project-tree containers plus non-done next/project tasks for the link picker.
  const allContainerNodes = allTasks.filter(t => isContainer(t));
  const nextAndProjectTasks = [
    ...allContainerNodes,
    ...allTasks.filter(t => !isContainer(t) && !t.done && ['next', 'project'].includes(t.bucket)),
  ];

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

                {/* Log as receipt */}
                {logEmailAsReceipt && (
                  <div>
                    {receiptStatus === 'ok' ? (
                      <div style={{ fontSize: 11, color: COLORS.project, padding: '4px 0' }}>✓ Logged to receipt sheet</div>
                    ) : (
                      <>
                        <button
                          style={{ ...gmailBtn(), textAlign: 'left', width: '100%', color: COLORS.text2 }}
                          disabled={receiptStatus === 'loading'}
                          onClick={async () => {
                            setReceiptStatus('loading');
                            try {
                              await logEmailAsReceipt(emailDetail);
                              setReceiptStatus('ok');
                              setTimeout(() => setReceiptStatus(null), 5000);
                            } catch (e) {
                              setReceiptStatus(e.message);
                            }
                          }}
                        >
                          {receiptStatus === 'loading' ? 'Logging…' : '📈 Log as receipt'}
                        </button>
                        {receiptStatus && receiptStatus !== 'loading' && receiptStatus !== 'ok' && (
                          <div style={{ fontSize: 11, color: '#e05555', marginTop: 2, lineHeight: 1.4 }}>{receiptStatus}</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Link to task */}
                {attachEmailToTask && (
                  <div>
                    {linkedConfirm ? (
                      <div style={{ fontSize: 11, color: COLORS.project, padding: '4px 0' }}>✓ Linked to "{linkedConfirm}"</div>
                    ) : (
                      <div ref={pickerRef} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowTaskPicker(p => !p)}
                          style={{
                            width: '100%', background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
                            borderRadius: 6, padding: '5px 8px', color: COLORS.text, fontFamily: 'inherit',
                            fontSize: 12, outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, textAlign: 'left',
                          }}
                        >
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: COLORS.muted }}>
                            📎 Link to task
                          </span>
                          <span style={{ color: COLORS.muted, fontSize: 10, flexShrink: 0 }}>{showTaskPicker ? '▴' : '▾'}</span>
                        </button>
                        {showTaskPicker && (
                          <div style={{
                            position: 'absolute', bottom: 'calc(100% + 2px)', left: 0, right: 0,
                            background: COLORS.surface2, border: `1px solid ${COLORS.border2}`,
                            borderRadius: 6, padding: 4, zIndex: 50,
                            maxHeight: 320, overflowY: 'auto',
                            boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
                          }}>
                            {nextAndProjectTasks.length === 0 && (
                              <div style={{ padding: '6px 10px', fontSize: 11, color: COLORS.muted }}>No tasks found</div>
                            )}
                            {nextAndProjectTasks.length > 0 && (
                              <ProjectTreePicker
                                eligibleProjects={nextAndProjectTasks}
                                selectedId={null}
                                sorted={true}
                                onSelect={(id) => {
                                  const task = nextAndProjectTasks.find(t => t.id === id);
                                  if (task) handleLinkToTask(task.id, task.text);
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

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
                {/* Mark as spam */}
                {markAsSpam && (
                  <div>
                    {spamStatus === 'ok' ? (
                      <div style={{ fontSize: 11, color: COLORS.muted, padding: '4px 0' }}>✓ Marked as spam</div>
                    ) : (
                      <>
                        <button
                          style={{ ...gmailBtn(), textAlign: 'left', width: '100%', color: '#e05555' }}
                          disabled={spamStatus === 'loading'}
                          onClick={async () => {
                            setSpamStatus('loading');
                            try {
                              await markAsSpam(emailDetail);
                              setInboxEmails(prev => prev.filter(e => e.id !== selectedId));
                              setSelectedId(null);
                            } catch (e) {
                              setSpamStatus(e.message);
                            }
                          }}
                        >
                          {spamStatus === 'loading' ? 'Marking…' : '🚫 Mark as spam'}
                        </button>
                        {spamStatus && spamStatus !== 'loading' && spamStatus !== 'ok' && (
                          <div style={{ fontSize: 11, color: '#e05555', marginTop: 2, lineHeight: 1.4 }}>{spamStatus}</div>
                        )}
                      </>
                    )}
                  </div>
                )}
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
  attachEmailToTask:  PropTypes.func,
  tasks:              PropTypes.array,
  logEmailAsReceipt:  PropTypes.func,
  markAsSpam:         PropTypes.func,
};

export { EmailInboxPanel };
