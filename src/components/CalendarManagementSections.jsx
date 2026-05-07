import { useState } from "react";
import { COLORS } from "../constants.jsx";
import { calEventStart, isAllDayEvent } from "../api/calendarApi.js";

function CalendarNewEventsSection({ events, onReview, onSkip }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', background: COLORS.surface2 }}
      >
        <span style={{ fontSize: 11, color: COLORS.calendar, fontWeight: 600 }}>
          🗓 New calendar events — no linked task ({events.length})
        </span>
        <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ padding: '4px 0' }}>
          {events.map(ev => {
            const s = calEventStart(ev);
            const dateStr = s ? s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';
            const timeStr = isAllDayEvent(ev) ? 'All day' : s ? s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
            return (
              <div key={ev.recurringEventId || ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderBottom: `1px solid ${COLORS.border}22` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.summary || '(No title)'}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 8 }}>{dateStr}{timeStr ? ' · ' + timeStr : ''}</span>
                  {ev.recurringEventId && <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: 6 }}>↺ recurring</span>}
                </div>
                <button
                  onClick={() => onReview(ev)}
                  style={{ padding: '3px 10px', borderRadius: 5, border: `1px solid ${COLORS.calendar}`, background: COLORS.calendar + '22', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >Review with AI</button>
                <button
                  onClick={() => onSkip(ev)}
                  style={{ padding: '3px 10px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
                >Skip</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarPendingTasksSection({ tasks, addConfirmId, addStatus, onRequestAdd, onConfirmAdd, onCancelAdd, onOpenDetail, selectedTaskId, skippedIds, onIgnore }) {
  const [open, setOpen] = useState(true);
  const visibleTasks = tasks.filter(t => addStatus[t.id] !== 'done' && !skippedIds?.has(t.id));
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', background: COLORS.surface2 }}
      >
        <span style={{ fontSize: 11, color: COLORS.calendar, fontWeight: 600 }}>📌 Tasks with due dates — not yet on calendar ({visibleTasks.length})</span>
        <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div style={{ padding: '4px 0' }}>
          {visibleTasks.map(task => {
            const status = addStatus[task.id];
            const isPending = addConfirmId === task.id;
            const isDone = status === 'done';
            const isLoading = status === 'loading';
            const isError = status && status.startsWith('error:');
            const isSelected = selectedTaskId === task.id;
            return (
              <div key={task.id} style={{ padding: '6px 16px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', background: isSelected ? COLORS.surface3 : 'transparent' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    onClick={() => onOpenDetail && onOpenDetail(isSelected ? null : task.id)}
                    title="Click to view / edit task details"
                    style={{ fontSize: 13, color: isDone ? COLORS.muted : isSelected ? COLORS.calendar : COLORS.text, textDecoration: isDone ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: onOpenDetail ? 'pointer' : 'default' }}
                  >
                    {task.text}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>
                    Due {task.dueDate}
                    {task.bucket && <span style={{ marginLeft: 6, background: COLORS.surface3, padding: '0px 5px', borderRadius: 4 }}>{task.bucket === 'next' ? '⚡' : task.bucket === 'project' ? '📁' : task.bucket === 'waiting' ? '⏳' : task.bucket === 'someday' ? '💭' : '📥'} {task.bucket}</span>}
                    {task.effort && <span style={{ marginLeft: 6, color: COLORS.effort }}>{task.effort}</span>}
                  </div>
                  {isError && <div style={{ fontSize: 11, color: '#d4845a', marginTop: 2 }}>⚠ {status.replace('error:', '')}</div>}
                </div>
                {!isDone && !isPending && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => onRequestAdd(task.id)}
                      disabled={isLoading}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.calendar}`, background: 'transparent', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
                    >
                      + Add to Calendar
                    </button>
                    {onIgnore && (
                      <button
                        onClick={() => onIgnore(task.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
                      >
                        Ignore
                      </button>
                    )}
                  </div>
                )}
                {isPending && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: COLORS.text2, alignSelf: 'center' }}>Add "{task.text}" on {task.dueDate}?</span>
                    <button onClick={() => onConfirmAdd(task)} disabled={isLoading}
                      style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.calendar}`, background: COLORS.calendar + '22', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
                      {isLoading ? '…' : 'Confirm'}
                    </button>
                    <button onClick={onCancelAdd}
                      style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                )}
                {isDone && <span style={{ fontSize: 11, color: COLORS.next, flexShrink: 0 }}>✓ Added</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { CalendarNewEventsSection, CalendarPendingTasksSection };