import { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { formatBubble, normalizeEffort } from "../tasks/taskUtils.jsx";
import { PRIORITIES } from "../tasks/TaskRow.jsx";
import { StyledCheckbox } from "../../shared/StyledCheckbox.jsx";
import { ProjectTreePicker } from "../tasks/ProjectTreePicker.jsx";

function ActionBtn({ children, onClick, color }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${color ? color + "44" : COLORS.border}`, background: hover ? COLORS.surface3 : COLORS.surface2, color: color || COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
    >
      {children}
    </button>
  );
}

function RecurringReviewCard({ events, onStillFine, onNeedsWork }) {
  return (
    <div style={{ border: `1px solid ${COLORS.border2}`, borderRadius: 10, overflow: 'hidden', margin: '4px 0' }}>
      <div style={{ padding: '8px 12px', background: COLORS.surface2, borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 14 }}>↻</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>Recurring events to check in on</span>
        <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 4 }}>({events.length})</span>
      </div>
      {events.map(ev => (
        <div key={ev.masterId} style={{ padding: '9px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
            {ev.recurrenceDesc && <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{ev.recurrenceDesc}</div>}
          </div>
          <button onClick={() => onStillFine(ev.masterId)}
            style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.next, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
            Still fine ✓</button>
          <button onClick={() => onNeedsWork(ev.masterId, ev.title)}
            style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
            Needs work →</button>
        </div>
      ))}
    </div>
  );
}

function ChatBubble({ msg, onRecurringStillFine, onRecurringNeedsWork, onMITSubmit, coachName, userName }) {
  const isUser = msg.role === "user";
  if (msg.isSearchChip) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "2px 4px", color: COLORS.muted, fontSize: 11,
                  fontStyle: "italic" }}>
      {msg.text}
    </div>
  );
  if (msg.type === 'recurringReview') return (
    <RecurringReviewCard events={msg.events} onStillFine={onRecurringStillFine} onNeedsWork={onRecurringNeedsWork} />
  );
  if (msg.type === 'mit-picker') return (
    <MITPicker overdue={msg.overdue || []} dueToday={msg.dueToday || []} onSubmit={onMITSubmit} />
  );
  return (
    <div style={{ display: "flex", gap: 7, flexDirection: isUser ? "row-reverse" : "row", maxWidth: "100%" }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: isUser ? COLORS.surface3 : COLORS.inbox, color: isUser ? COLORS.text2 : "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isUser ? 9 : 11, fontFamily: "Georgia, serif", flexShrink: 0, marginTop: 1 }}>
        {isUser ? (userName ? userName[0].toUpperCase() : "Y") : (coachName ? coachName[0].toUpperCase() : "C")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: "calc(100% - 70px)" }}>
        <div style={{ padding: "8px 11px", borderRadius: 11, fontSize: 13, lineHeight: 1.55, background: isUser ? COLORS.surface3 : COLORS.surface2, color: isUser ? COLORS.text2 : COLORS.text, borderTopLeftRadius: isUser ? 11 : 3, borderTopRightRadius: isUser ? 3 : 11 }}>
          {formatBubble(msg.text)}
        </div>
        {msg.updateChip && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 20, background: COLORS.surface3, border: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.text2, alignSelf: "flex-start" }}>
            <span>✏️</span>
            <span>Updated <strong style={{ color: COLORS.text }}>{msg.updateChip.taskName}</strong> — {msg.updateChip.fields.join(" · ")}</span>
            {msg.updateChip.url && (
              <a href={msg.updateChip.url} target="_blank" rel="noreferrer" style={{ color: COLORS.next, textDecoration: 'none', marginLeft: 4 }}>Open ↗</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator({ coachName }) {
  return (
    <div style={{ display: "flex", gap: 7 }}>
      <div style={{ width: 22, height: 22, borderRadius: "50%", background: COLORS.inbox, color: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "Georgia, serif", flexShrink: 0 }}>{coachName ? coachName[0].toUpperCase() : "C"}</div>
      <div style={{ padding: "9px 13px", borderRadius: 11, borderTopLeftRadius: 3, background: COLORS.surface2, display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: COLORS.muted, animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:.3} 30%{transform:translateY(-4px);opacity:1} }`}</style>
    </div>
  );
}

function PendingActionBar({ action, onConfirm, onDismiss, onDelete, efforts, locations, categories, allTasks, onUpdatePendingAction }) {
  if (!action) return null;
  const { type, title, nextAction, parentName, dueDate, deferUntil, effort, category, priority = [], location = [], taskId, changes } = action;

  const configs = {
    next:    { color: COLORS.next,    label: "Next Actions", confirmText: "Create ✓" },
    project: { color: COLORS.project, label: "Project + Next Action", confirmText: "Create ✓" },
    someday: { color: COLORS.someday, label: "Someday / Maybe", confirmText: "Move ✓" },
    waiting: { color: COLORS.waiting, label: "Waiting For", confirmText: "Move ✓" },
    delete:  { color: COLORS.muted,   label: "Archive (not actionable)", confirmText: "Archive ✓" },
    add:     { color: COLORS.project, label: "Add to existing project", confirmText: "Add ✓" },
    update:   { color: COLORS.accent,  label: "Update task",              confirmText: "Apply ✓" },
    gmail_send: { color: '#4285F4',       label: "Send email",               confirmText: "Send ✓" },
  };
  const cfg = configs[type] || configs.next;

  const hasAIValues = !!(dueDate || deferUntil || effort || category || (location && location.length) || (priority && priority.length));
  const [expanded, setExpanded] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const catPickerRef = useRef(null);
  useEffect(() => {
    if (!catOpen) return;
    const handler = e => { if (catPickerRef.current && !catPickerRef.current.contains(e.target)) setCatOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen]);

  const [projPickerOpen, setProjPickerOpen] = useState(false);
  const projPickerRef = useRef(null);
  useEffect(() => {
    if (!projPickerOpen) return;
    const handler = e => { if (projPickerRef.current && !projPickerRef.current.contains(e.target)) setProjPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [projPickerOpen]);
  const eligibleProjects = (allTasks || []).filter(t => t.bucket === 'project' && !t.done);

  // Normalize AI-inferred effort string to the nearest configured effort label.
  // The AI may return "2h" while the user's list has "2 hours" — normalizeEffort
  // snaps by minutes. Fire a one-time update so pendingAction.effort is also correct
  // before the user confirms without touching the field.
  const displayEffort = (effort && efforts && efforts.length)
    ? normalizeEffort(effort, efforts)
    : effort;
  useEffect(() => {
    if (displayEffort && displayEffort !== effort) {
      onUpdatePendingAction('effort', displayEffort);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentional: key prop resets component on new action, run once per mount

  const showDue      = ['next', 'project', 'add', 'waiting'].includes(type);
  const showDefer    = ['next', 'project', 'add', 'someday'].includes(type);
  const showEffort   = ['next', 'project', 'add', 'someday', 'waiting'].includes(type);
  const showPriority = ['next', 'add', 'project', 'someday', 'waiting'].includes(type);
  const showLocation = ['next', 'add', 'project', 'someday', 'waiting'].includes(type);
  const showProject  = ['next', 'project', 'someday', 'waiting'].includes(type);
  const showMeta     = type !== 'delete' && type !== 'gmail_send';

  const chip = (label, active, color, onClick) => (
    <button
      key={label}
      onClick={onClick}
      style={{ padding: "2px 8px", borderRadius: 10, border: `1px solid ${active ? color : COLORS.border}`, background: active ? color + "22" : "transparent", color: active ? color : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
    >{label}</button>
  );

  const collapsedHint = !expanded && hasAIValues
    ? ` (${[dueDate && `due ${dueDate}`, deferUntil && `defer ${deferUntil}`, effort, category, location && location.length && location.join(','), priority && priority.length && priority.join(',')].filter(Boolean).join(", ")})`
    : "";

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${cfg.color}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>→ {cfg.label}</div>
      {type === "project" ? (
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.5 }}>
          <div><span style={{ color: COLORS.muted }}>Project: </span><strong style={{ color: COLORS.text }}>{title}</strong></div>
          <div><span style={{ color: COLORS.muted }}>Next action: </span><strong style={{ color: COLORS.next }}>{nextAction}</strong></div>
        </div>
      ) : type === "add" ? (
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: COLORS.muted, flexShrink: 0 }}>Under: </span>
            <div ref={projPickerRef} style={{ position: "relative", flex: 1 }}>
              <button
                onClick={() => setProjPickerOpen(o => !o)}
                style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: parentName ? COLORS.project : COLORS.muted, padding: "3px 8px", fontFamily: "inherit", fontSize: 12, outline: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, width: "100%", boxSizing: "border-box" }}
              >
                <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{parentName || "— UnCategorized"}</span>
                <span style={{ color: COLORS.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
              </button>
              {projPickerOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 50, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                  <ProjectTreePicker
                    eligibleProjects={eligibleProjects}
                    selectedId={action.parentRef}
                    onSelect={id => {
                      const proj = eligibleProjects.find(p => p.id === id);
                      onUpdatePendingAction("parentRef", id || null);
                      onUpdatePendingAction("parentName", proj ? proj.text : "");
                      setProjPickerOpen(false);
                    }}
                    showUncategorized
                    sorted
                  />
                </div>
              )}
            </div>
          </div>
          <div><span style={{ color: COLORS.muted }}>Action: </span><strong style={{ color: COLORS.next }}>{title}</strong></div>
        </div>
      ) : type === "gmail_send" ? (
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.5 }}>
          <div><span style={{ color: COLORS.muted }}>To: </span><strong style={{ color: COLORS.text }}>{action.to}</strong></div>
          <div><span style={{ color: COLORS.muted }}>Subject: </span><strong style={{ color: COLORS.text }}>{action.subject}</strong></div>
          {action.body && (
            <div style={{ marginTop: 4, padding: "6px 8px", background: COLORS.surface2, borderRadius: 5, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 120, overflowY: "auto", color: COLORS.text2 }}>
              {action.body.length > 400 ? action.body.slice(0, 400) + '…' : action.body}
            </div>
          )}
        </div>
      ) : type === "update" ? (
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.5 }}>
          <div><strong style={{ color: COLORS.text }}>{title}</strong></div>
          <div style={{ color: COLORS.muted, marginTop: 2 }}>{changes?.done ? 'Mark complete' : changes?.isSomeday === true ? 'Move to Someday/Maybe' : changes?.isSomeday === false ? 'Activate to Next Actions' : changes?.isWaitingFor ? 'Move to Waiting For' : 'Update fields'}</div>
        </div>
      ) : type !== "delete" ? (
        <div style={{ fontSize: 12, color: COLORS.text2 }}>
          <strong style={{ color: cfg.color }}>{title}</strong>
        </div>
      ) : null}

      {showMeta && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: "none", border: "none", padding: 0, color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
          >
            {expanded ? "▾" : "▸"} metadata{collapsedHint}
          </button>
          {expanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
              {showProject && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>Project</div>
                  <div ref={projPickerRef} style={{ position: "relative" }}>
                    <button
                      onClick={() => setProjPickerOpen(o => !o)}
                      style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: action.parentRef ? COLORS.project : COLORS.muted, padding: "4px 8px", fontFamily: "inherit", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{parentName || "— UnCategorized"}</span>
                      <span style={{ color: COLORS.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
                    </button>
                    {projPickerOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 50, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                        <ProjectTreePicker
                          eligibleProjects={eligibleProjects}
                          selectedId={action.parentRef}
                          onSelect={id => {
                            const proj = eligibleProjects.find(p => p.id === id);
                            onUpdatePendingAction("parentRef", id || null);
                            onUpdatePendingAction("parentName", proj ? proj.text : "");
                            setProjPickerOpen(false);
                          }}
                          showUncategorized
                          sorted
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: -4 }}>Category</div>
              <div ref={catPickerRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setCatOpen(o => !o)}
                  style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: category ? COLORS.text : COLORS.muted, padding: "4px 8px", fontFamily: "inherit", fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span style={{ flex: 1, textAlign: "left" }}>{category || "— none —"}</span>
                  <span style={{ color: COLORS.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
                </button>
                {catOpen && (
                  <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 50, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                    <div onClick={() => { onUpdatePendingAction("category", null); setCatOpen(false); }} style={{ padding: "5px 8px", cursor: "pointer", fontSize: 12, borderRadius: 4, color: !category ? COLORS.text : COLORS.muted, background: !category ? COLORS.surface3 : "transparent" }}>— none —</div>
                    {category && !(categories || []).includes(category) && (
                      <div onClick={() => { onUpdatePendingAction("category", category); setCatOpen(false); }} style={{ padding: "5px 8px", cursor: "pointer", fontSize: 12, borderRadius: 4, color: COLORS.text, background: COLORS.surface3 }}>{category}</div>
                    )}
                    {(categories || []).map(c => (
                      <div key={c} onClick={() => { onUpdatePendingAction("category", c); setCatOpen(false); }} style={{ padding: "5px 8px", cursor: "pointer", fontSize: 12, borderRadius: 4, color: category === c ? COLORS.project : COLORS.text, background: category === c ? COLORS.surface3 : "transparent" }}>{c}</div>
                    ))}
                  </div>
                )}
              </div>

              {showEffort && (efforts || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>Effort</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(efforts || []).map(e => chip(e, displayEffort === e, COLORS.effort, () => onUpdatePendingAction("effort", displayEffort === e ? null : e)))}
                  </div>
                </div>
              )}

              {showPriority && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>Priority</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {PRIORITIES.map(p => chip(p, priority.includes(p), COLORS.inbox, () => {
                      const next = priority.includes(p) ? priority.filter(x => x !== p) : [...priority, p];
                      onUpdatePendingAction("priority", next);
                    }))}
                  </div>
                </div>
              )}

              {showDue && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>Due Date</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="date"
                      value={dueDate || ""}
                      onChange={e => onUpdatePendingAction("dueDate", e.target.value || null)}
                      style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
                    />
                    {dueDate && <button onClick={() => onUpdatePendingAction("dueDate", null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>}
                  </div>
                </div>
              )}

              {showDefer && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>Defer Until</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="date"
                      value={deferUntil || ""}
                      onChange={e => onUpdatePendingAction("deferUntil", e.target.value || null)}
                      style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
                    />
                    {deferUntil && <button onClick={() => onUpdatePendingAction("deferUntil", null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>}
                  </div>
                </div>
              )}

              {showLocation && (locations || []).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 5 }}>Location</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(locations || []).map(loc => chip(loc, location.includes(loc), COLORS.project, () => {
                      const next = location.includes(loc) ? location.filter(x => x !== loc) : [...location, loc];
                      onUpdatePendingAction("location", next);
                    }))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onConfirm} style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${cfg.color}`, background: "transparent", color: cfg.color, fontFamily: "inherit", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {cfg.confirmText}
        </button>
        <button onClick={onDismiss} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
          Skip
        </button>
        <button onClick={onDelete} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #c4606044", background: "transparent", color: "#c46060", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

function DeferCheckPrompt({ taskText, deferredChildren, onSkip, onReview }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 12, padding: "22px 26px", maxWidth: 440, width: "90%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.deferred }}>⏳ Deferred subtasks remain</div>
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.text, fontWeight: 500 }}>&#8220;{taskText}&#8221;</span> has {deferredChildren.length} deferred or someday subtask{deferredChildren.length !== 1 ? "s" : ""}:
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: COLORS.text2, lineHeight: 1.9 }}>
          {deferredChildren.map(c => (
            <li key={c.id}>
              <span style={{ color: c.bucket === "deferred" ? COLORS.deferred : COLORS.someday }}>({c.bucket})</span> {c.text}
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            autoFocus
            onClick={onReview}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.deferred}`, background: "transparent", color: COLORS.deferred, fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            Review first
          </button>
          <button
            onClick={onSkip}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Complete anyway
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteRollupPrompt({ taskText, notes, parentText, onConfirm, onSkip }) {
  const d = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const defaultHeading = `\u2713 ${taskText} (${months[d.getMonth()]} ${d.getDate()}):`;
  const [heading, setHeading] = useState(defaultHeading);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 12, padding: "22px 26px", maxWidth: 400, width: "90%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.project }}>📋 Roll up notes?</div>
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.text, fontWeight: 500 }}>&#8220;{taskText}&#8221;</span> has notes.
          Add them to the parent task <span style={{ color: COLORS.text, fontWeight: 500 }}>&#8220;{parentText}&#8221;</span>?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ fontSize: 11, color: COLORS.muted }}>Heading (editable)</div>
          <input
            value={heading}
            onChange={e => setHeading(e.target.value)}
            style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 7, padding: "7px 10px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
          />
        </div>
        <div style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "9px 11px", fontSize: 12, color: COLORS.text2, lineHeight: 1.6, maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "inherit" }}>
          {notes}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            autoFocus
            onClick={() => onConfirm(heading)}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
          >
            Add to parent notes
          </button>
          <button
            onClick={onSkip}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ActualEffortPrompt({ taskText, estimatedEffort, efforts, onSave, onSkip }) {
  const [selected, setSelected] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 12, padding: "22px 26px", maxWidth: 380, width: "90%", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.next }}>✓ Task complete!</div>
        <div style={{ fontSize: 12, color: COLORS.text2, lineHeight: 1.6 }}>
          <span style={{ color: COLORS.text, fontWeight: 500 }}>"{taskText}"</span>
          <br />
          Estimated: <span style={{ color: COLORS.effort }}>⏱ {estimatedEffort}</span>
          <br />
          How long did it actually take?
        </div>
        <select
          autoFocus
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 7, padding: "7px 10px", color: selected ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 13, outline: "none", colorScheme: "dark" }}
        >
          <option value="">— Select actual time —</option>
          {(efforts || []).map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => selected && onSave(selected)}
            disabled={!selected}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.next}`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 13, cursor: selected ? "pointer" : "not-allowed", opacity: selected ? 1 : 0.4, fontWeight: 600 }}
          >
            Save &amp; Complete
          </button>
          <button
            onClick={onSkip}
            style={{ padding: "8px 14px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewModeBar({ onSelect }) {
  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Choose review focus
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSelect("tasks")}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.next}55`, background: COLORS.nextBg, color: COLORS.next, fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 3 }}>📋 Task completeness</div>
          <div style={{ fontSize: 11, color: COLORS.text2 }}>Find missing next actions for each project</div>
        </button>
        <button
          onClick={() => onSelect("metadata")}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.project}55`, background: COLORS.projectBg, color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", lineHeight: 1.4 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 3 }}>🏷 Metadata quality</div>
          <div style={{ fontSize: 11, color: COLORS.text2 }}>Fill in effort, due dates, and defer dates</div>
        </button>
      </div>
    </div>
  );
}

function MetadataReviewBar({ suggestions, onToggleAccepted, onChangeOverride, onNext, onSkip, projectIdx, totalProjects }) {
  const isEmpty = suggestions.length === 0;
  const isLast  = projectIdx + 1 >= totalProjects;
  const acceptedCount = suggestions.filter(s => s.accepted).length;

  const nextLabel = isLast
    ? (acceptedCount > 0 ? `Apply ${acceptedCount} & Finish ✓` : "Finish Review ✓")
    : (acceptedCount > 0 ? `Apply ${acceptedCount} & Next →` : "Next →");

  const FIELD_LABELS = {
    effort: "Effort", dueDate: "Due", dueTime: "Time", deferUntil: "Defer",
    priority: "Priority", location: "Location", category: "Category", nodeType: "Type",
  };
  const FIELD_WIDTHS = {
    effort: 52, dueDate: 96, dueTime: 52, deferUntil: 96,
    priority: 72, location: 130, category: 90, nodeType: 72,
  };

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {isEmpty ? "✓ Metadata looks good" : "🏷 Metadata suggestions — edit values if needed"}
      </div>

      {isEmpty ? (
        <div style={{ fontSize: 12, color: COLORS.muted }}>All tasks already have adequate metadata — nothing to add.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((s, idx) => (
            <div key={s.taskId} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "7px 9px", borderRadius: 7, background: s.accepted ? COLORS.surface2 : COLORS.surface, border: `1px solid ${s.accepted ? COLORS.border2 : COLORS.border}`, opacity: s.accepted ? 1 : 0.5 }}>
              {/* Task row header */}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <StyledCheckbox
                  checked={s.accepted}
                  onChange={() => onToggleAccepted(idx)}
                  accentColor={COLORS.project}
                />
                <span style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, lineHeight: 1.35 }}>{s.taskText}</span>
              </div>
              {/* Field chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 22 }}>
                {Object.entries(s.overrides).map(([field, value]) => (
                  <div key={field} style={{ display: "flex", alignItems: "center", gap: 4, background: COLORS.surface3, borderRadius: 5, padding: "2px 6px", border: `1px solid ${COLORS.border2}` }}>
                    <span style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{FIELD_LABELS[field] || field}</span>
                    <input
                      value={Array.isArray(value) ? value.join(', ') : (value || "")}
                      onChange={e => onChangeOverride(idx, field, e.target.value)}
                      disabled={!s.accepted}
                      style={{ width: FIELD_WIDTHS[field] ?? 96, fontSize: 11, background: "transparent", border: "none", color: COLORS.text, fontFamily: "inherit", outline: "none", padding: 0 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={onNext}
          style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
        >
          {nextLabel}
        </button>
        <button
          onClick={onSkip}
          style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
        >
          {isLast ? "Skip (Finish)" : "Skip →"}
        </button>
        <span style={{ fontSize: 11, color: COLORS.muted }}>
          Project {projectIdx + 1} of {totalProjects}
        </span>
      </div>
    </div>
  );
}

MetadataReviewBar.propTypes = {
  suggestions: PropTypes.arrayOf(PropTypes.shape({
    taskId:    PropTypes.string.isRequired,
    taskText:  PropTypes.string.isRequired,
    overrides: PropTypes.object.isRequired,
    accepted:  PropTypes.bool.isRequired,
  })).isRequired,
  onToggleAccepted: PropTypes.func.isRequired,
  onChangeOverride: PropTypes.func.isRequired,
  onNext:           PropTypes.func.isRequired,
  onSkip:           PropTypes.func.isRequired,
  projectIdx:       PropTypes.number.isRequired,
  totalProjects:    PropTypes.number.isRequired,
};

function ProjectReviewBar({ suggestions, onToggle, onNext, onSkip, projectIdx, totalProjects }) {
  const selectedCount = suggestions.filter(s => s.checked).length;
  const isEmpty = suggestions.length === 0;
  const isLast = projectIdx + 1 >= totalProjects;

  const nextLabel = isLast
    ? (selectedCount > 0 ? `Add ${selectedCount} & Finish ✓` : "Finish Review ✓")
    : (selectedCount > 0 ? `Add ${selectedCount} & Next →` : "Next →");

  return (
    <div style={{ background: COLORS.surface3, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {isEmpty ? "✓ Project looks good" : "→ Suggested next actions — check to add"}
      </div>
      {isEmpty ? (
        <div style={{ fontSize: 12, color: COLORS.muted }}>No missing actions identified — this project is on track.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {suggestions.map((s, idx) => (
            <label key={s.text} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}>
              <StyledCheckbox
                checked={s.checked}
                onChange={() => onToggle(idx)}
                accentColor={COLORS.project}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 12, color: s.checked ? COLORS.text : COLORS.muted, textDecoration: s.checked ? "none" : "line-through", lineHeight: 1.45 }}>
                {s.text}
              </span>
            </label>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={onNext}
          style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
        >
          {nextLabel}
        </button>
        <button
          onClick={onSkip}
          style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
        >
          {isLast ? "Skip (Finish)" : "Skip →"}
        </button>
        <span style={{ fontSize: 11, color: COLORS.muted }}>
          Project {projectIdx + 1} of {totalProjects}
        </span>
      </div>
    </div>
  );
}

ProjectReviewBar.propTypes = {
  suggestions: PropTypes.arrayOf(PropTypes.shape({
    text:    PropTypes.string.isRequired,
    checked: PropTypes.bool.isRequired,
  })).isRequired,
  onToggle:      PropTypes.func.isRequired,
  onNext:        PropTypes.func.isRequired,
  onSkip:        PropTypes.func.isRequired,
  projectIdx:    PropTypes.number.isRequired,
  totalProjects: PropTypes.number.isRequired,
};


function MITPicker({ overdue, dueToday, onSubmit }) {
  const today8601 = new Date().toISOString().slice(0, 10);
  const [selected, setSelected] = useState([]);
  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const allTasks = [...overdue, ...dueToday];

  return (
    <div style={{ border: `1px solid ${COLORS.border2}`, borderRadius: 10, margin: '2px 0 28px 0', overflow: 'visible' }}>
      <div style={{ padding: '8px 12px', background: COLORS.surface2, borderBottom: `1px solid ${COLORS.border}`,
        borderRadius: '9px 9px 0 0',
        fontSize: 11, fontWeight: 600, color: COLORS.text2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Select your MUST ACCOMPLISH tasks
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {overdue.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: '#e05050', fontWeight: 600, padding: '4px 8px 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Overdue ({overdue.length})
              </div>
              {overdue.map(t => {
                const checked = selected.includes(t.id);
                return (
                  <div key={t.id} onClick={() => toggle(t.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', borderRadius: 6,
                      cursor: 'pointer', background: checked ? '#e0505018' : 'transparent',
                      border: `1px solid ${checked ? '#e0505055' : 'transparent'}` }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${checked ? '#e05050' : COLORS.border2}`,
                      background: checked ? '#e05050' : 'transparent', flexShrink: 0, marginTop: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
                      {t.dueDate && <div style={{ fontSize: 10, color: '#e05050', marginTop: 1 }}>Overdue · {t.dueDate}</div>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {dueToday.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: COLORS.next, fontWeight: 600, padding: '6px 8px 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Due Today ({dueToday.length})
              </div>
              {dueToday.map(t => {
                const checked = selected.includes(t.id);
                return (
                  <div key={t.id} onClick={() => toggle(t.id)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', borderRadius: 6,
                      cursor: 'pointer', background: checked ? COLORS.next + '18' : 'transparent',
                      border: `1px solid ${checked ? COLORS.next + '55' : 'transparent'}` }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${checked ? COLORS.next : COLORS.border2}`,
                      background: checked ? COLORS.next : 'transparent', flexShrink: 0, marginTop: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {checked && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
                      {t.dueDate && <div style={{ fontSize: 10, color: COLORS.next, marginTop: 1 }}>Due today{t.dueTime ? ` · ${t.dueTime}` : ''}</div>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {allTasks.length === 0 && (
            <div style={{ padding: '12px 8px', fontSize: 12, color: COLORS.muted, fontStyle: 'italic' }}>No overdue or due-today tasks.</div>
          )}
        </div>
      </div>
      {/* Submit button — always outside scroll, with bottom padding so it clears the panel edge */}
      <div style={{ padding: '8px 8px 16px', borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface2, borderRadius: '0 0 9px 9px' }}>
        <button
          onClick={() => selected.length > 0 && onSubmit([...selected])}
          style={{ width: '100%', padding: '9px 0', borderRadius: 8, fontFamily: 'inherit',
            border: selected.length > 0 ? 'none' : `1px solid ${COLORS.border}`,
            background: selected.length > 0 ? '#f0c040' : COLORS.surface3,
            color: selected.length > 0 ? '#1a1a0e' : COLORS.muted,
            fontSize: 12, fontWeight: 600,
            cursor: selected.length > 0 ? 'pointer' : 'default', transition: 'all 0.15s' }}>
          {selected.length > 0 ? `Set ${selected.length} task${selected.length > 1 ? 's' : ''} as Today's Focus →` : 'Select tasks above'}
        </button>
      </div>
    </div>
  );
}

function ProviderSelector({ provider, setProvider, localModel, setLocalModel, availableModels, fetchModels }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) fetchModels();
    setOpen(o => !o);
  };

  const activeLabel = provider === "claude" ? "Claude" : localModel;
  const activeColor = provider === "claude" ? COLORS.inbox : COLORS.next;

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={handleOpen}
        style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${activeColor}55`, background: COLORS.surface2, color: activeColor, fontFamily: "inherit", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
      >
        <span>{provider === "claude" ? "✦" : "◈"}</span>
        <span>{activeLabel}</span>
        <span style={{ opacity: 0.5, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 9, padding: 4, zIndex: 200, minWidth: 200, boxShadow: "0 8px 28px rgba(0,0,0,0.55)" }}>
          <div style={{ padding: "4px 8px 3px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>Claude API</div>
          <ProviderOption label="Claude Sonnet" icon="✦" color={COLORS.inbox} active={provider === "claude"}
            onClick={() => { setProvider("claude"); setOpen(false); }} />

          <div style={{ margin: "4px 0", borderTop: `1px solid ${COLORS.border}` }} />
          <div style={{ padding: "4px 8px 3px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.07em", textTransform: "uppercase" }}>Open WebUI</div>

          {availableModels.length === 0
            ? <div style={{ padding: "6px 10px", fontSize: 11, color: COLORS.muted, fontStyle: "italic" }}>Fetching models…</div>
            : availableModels.map(m => (
              <ProviderOption key={m} label={m} icon="◈" color={COLORS.next} active={provider === "local" && localModel === m}
                onClick={() => { setProvider("local"); setLocalModel(m); setOpen(false); }} />
            ))
          }
        </div>
      )}
    </div>
  );
}

ProviderSelector.propTypes = {
  provider:        PropTypes.string.isRequired,
  setProvider:     PropTypes.func.isRequired,
  localModel:      PropTypes.string.isRequired,
  setLocalModel:   PropTypes.func.isRequired,
  availableModels: PropTypes.arrayOf(PropTypes.string).isRequired,
  fetchModels:     PropTypes.func.isRequired,
};

function ProviderOption({ label, icon, color, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: "6px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: active || hover ? COLORS.surface2 : "transparent", color: active ? color : COLORS.text2, display: "flex", alignItems: "center", gap: 7, transition: "background 0.1s" }}
    >
      <span style={{ color: active ? color : COLORS.muted }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {active && <span style={{ color, fontSize: 9 }}>●</span>}
    </div>
  );
}


export { ActionBtn, RecurringReviewCard, ChatBubble, MITPicker, TypingIndicator, PendingActionBar, DeferCheckPrompt, NoteRollupPrompt, ActualEffortPrompt, ReviewModeBar, MetadataReviewBar, ProjectReviewBar, ProviderSelector, ProviderOption };
