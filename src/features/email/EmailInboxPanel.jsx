import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { ProjectTreePicker } from "../tasks/ProjectTreePicker.jsx";
import { doGmailFetchInbox, doGmailGetMessageBody, doGmailBatchLabel } from "./gmailTools.js";
import { avatarInitials, avatarColor, formatEmailDate, gmailBtn, gmailBtnPrimary, gmailBtnSm, gmailBtnSmDanger } from "./emailUtils.js";

// Inbox list with checkboxes, avatar chips, pagination, and a detail slide-out panel.
function EmailInboxPanel({ googleToken, googleScope, processEmailWithAI, attachEmailToTask, tasks, logEmailAsReceipt, markAsSpam, contacts, addContactEmail, contactEmailLinkingMode }) {
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

  // FR#172: inbox search + FR#175: server-side search
  const [searchQuery, setSearchQuery] = useState('');
  const [serverSearchActive, setServerSearchActive] = useState(false);

  // Task-link picker state
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [linkedConfirm, setLinkedConfirm] = useState(null);
  const pickerRef = useRef(null);

  // FR#174: link-to-contact picker
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactLinkedConfirm, setContactLinkedConfirm] = useState(null);
  const contactPickerRef = useRef(null);

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

  // Reset pickers and status when email changes
  useEffect(() => {
    setShowTaskPicker(false);
    setLinkedConfirm(null);
    setReceiptStatus(null);
    setSpamStatus(null);
    setShowContactPicker(false);
    setContactLinkedConfirm(null);
  }, [selectedId]);

  // Close task picker on outside click
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

  // FR#174: close contact picker on outside click
  useEffect(() => {
    if (!showContactPicker) return;
    const handler = (e) => {
      if (contactPickerRef.current && !contactPickerRef.current.contains(e.target)) {
        setShowContactPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showContactPicker]);

  const loadInbox = async (pageToken = null, queryOverride = null) => {
    setInboxLoading(true);
    if (!pageToken) setInboxError(null);
    try {
      const { emails, nextPageToken } = await doGmailFetchInbox(googleToken, pageToken, queryOverride ?? '');
      setInboxEmails(prev => pageToken ? [...prev, ...emails] : emails);
      setInboxNextPageToken(nextPageToken);
      // FR#162: passive contact auto-linking on inbox load
      if (contacts && addContactEmail && (contactEmailLinkingMode === 'onLoad' || contactEmailLinkingMode === 'both')) {
        emails.forEach(email => {
          const rawFrom = email.from || '';
          const senderEmail = (/<([^>]+)>/.exec(rawFrom)?.[1] || rawFrom).trim().toLowerCase();
          if (!senderEmail) return;
          const match = contacts.find(ct =>
            (ct.emails || []).some(e => (e.value || '').toLowerCase() === senderEmail)
          );
          if (match) {
            addContactEmail(match.id, {
              messageId: email.id,
              threadId:  email.threadId || email.id,
              subject:   email.subject  || '',
              snippet:   email.snippet  || '',
              date:      email.date     || new Date().toISOString(),
              direction: 'received',
            });
          }
        });
      }
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

  // FR#172: client-side inbox filter
  const filteredEmails = searchQuery.trim()
    ? inboxEmails.filter(e => {
        const q = searchQuery.toLowerCase();
        return (e.from || '').toLowerCase().includes(q)
            || (e.subject || '').toLowerCase().includes(q)
            || (e.snippet || '').toLowerCase().includes(q);
      })
    : inboxEmails;

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
            {inboxLoading
              ? (serverSearchActive ? 'Searching Gmail…' : 'Loading…')
              : inboxError
                ? `Error: ${inboxError}`
                : serverSearchActive && searchQuery
                  ? `${filteredEmails.length} result${filteredEmails.length !== 1 ? 's' : ''} for "${searchQuery}"${checkedIds.size ? ` · ${checkedIds.size} selected` : ''}`
                  : `${inboxEmails.length} messages${checkedIds.size ? ` · ${checkedIds.size} selected` : ''}`}
          </span>
          <button style={gmailBtnSm} onClick={() => { setInboxNextPageToken(null); setSearchQuery(''); setServerSearchActive(false); loadInbox(null, ''); }} disabled={inboxLoading}>↻ Refresh</button>
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

        {/* FR#172 + FR#175: search filter + server-side Gmail search */}
        <div style={{ padding: '6px 14px 4px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="text"
              placeholder="Search sender, subject… (Enter to search all)"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value.trim()) { setServerSearchActive(false); loadInbox(null, ''); } }}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  setServerSearchActive(true);
                  setInboxNextPageToken(null);
                  loadInbox(null, searchQuery);
                }
              }}
              style={{ flex: 1, padding: '5px 8px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            {searchQuery && (
              <span
                onClick={() => { setSearchQuery(''); setServerSearchActive(false); loadInbox(null, ''); }}
                style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 12, userSelect: 'none' }}
              >✕</span>
            )}
          </div>
          {searchQuery && !serverSearchActive && (
            <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 3 }}>↵ Press Enter to search all mail</div>
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
          {filteredEmails.length === 0 && searchQuery && !inboxLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>No emails match your search</div>
          )}
          {filteredEmails.map(email => {
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

                {/* FR#174: link email to contact */}
                {contacts && contacts.length > 0 && addContactEmail && (
                  <div>
                    {contactLinkedConfirm ? (
                      <div style={{ fontSize: 11, color: '#4db6ac', padding: '4px 0' }}>✓ Linked to "{contactLinkedConfirm}"</div>
                    ) : (
                      <div ref={contactPickerRef} style={{ position: 'relative' }}>
                        <button
                          onClick={() => setShowContactPicker(p => !p)}
                          style={{ ...gmailBtn(), textAlign: 'left', width: '100%', color: COLORS.text2 }}
                        >
                          👤 Link to contact
                        </button>
                        {showContactPicker && (
                          <div style={{ position: 'absolute', bottom: 'calc(100% + 2px)', left: 0, right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6, zIndex: 50, maxHeight: 240, overflowY: 'auto', boxShadow: '0 -4px 16px rgba(0,0,0,0.4)' }}>
                            <ContactPickerInline
                              contacts={contacts}
                              onSelect={(contact) => {
                                addContactEmail(contact.id, {
                                  messageId: emailDetail.id,
                                  threadId:  emailDetail.threadId || emailDetail.id,
                                  subject:   emailDetail.subject  || '',
                                  snippet:   emailDetail.snippet  || '',
                                  date:      emailDetail.date     || new Date().toISOString(),
                                  direction: 'received',
                                });
                                setShowContactPicker(false);
                                setContactLinkedConfirm(contact.displayName || contact.givenName || 'Contact');
                                setTimeout(() => setContactLinkedConfirm(null), 4000);
                              }}
                              onClose={() => setShowContactPicker(false)}
                            />
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

// FR#174: inline contact picker for email detail panel
function ContactPickerInline({ contacts, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const filtered = (contacts || [])
    .filter(c => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (c.displayName || '').toLowerCase().includes(q)
          || (c.givenName   || '').toLowerCase().includes(q)
          || (c.familyName  || '').toLowerCase().includes(q);
    })
    .slice(0, 10);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: COLORS.text2 }}>Link to contact</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: COLORS.muted, fontSize: 11 }}>✕</span>
      </div>
      <input
        autoFocus
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search contacts…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '4px 8px', marginBottom: 5, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
      />
      {filtered.length === 0 && <div style={{ fontSize: 11, color: COLORS.muted, padding: '3px 0' }}>No contacts match</div>}
      {filtered.map(c => (
        <div
          key={c.id}
          onClick={() => onSelect(c)}
          style={{ padding: '5px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={e => e.currentTarget.style.background = COLORS.surface}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.displayName || c.givenName || '(no name)'}</span>
          {c.isFavorite && <span style={{ color: '#f0c040', fontSize: 11 }}>★</span>}
        </div>
      ))}
    </div>
  );
}


export { EmailInboxPanel };
