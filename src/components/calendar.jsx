import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";
import {
  doCalendarFetchEvents, doCalendarCreateEvent,
  doCalendarUpdateEvent, doCalendarDeleteEvent,
  calEventStart, calEventEnd, isAllDayEvent, fmtCalTime,
  eventsForDay, isSameDay, getMondayOfWeek,
  firstOccurrenceDate, buildRRULE,
} from "../api/calendarApi.js";

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
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
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

// ── CalendarManagementView ───────────────────────────────────────────────────

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const start = new Date(year, month, 1 - startDow);
  const grid = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push(d);
  }
  return grid;
}

function CalendarManagementView({ googleToken, calendarEnabled, calendarTab, setCalendarTab, tasks, setTasks, calendarEvents, setCalendarEvents, processCalendarEventWithAI, onConnectCalendar, onOpenDetail, selectedTaskId, skippedCalendarIds, setSkippedCalendarIds, seenCalendarEventIds, setSeenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays, setRecurringAcknowledgedMap }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [navDate, setNavDate] = useState(new Date());
  const [fetchWindow, setFetchWindow] = useState(null); // { start: Date, end: Date }
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [addConfirmId, setAddConfirmId] = useState(null); // task id pending calendar add confirm
  const [addStatus, setAddStatus] = useState({}); // taskId → 'loading' | 'done' | string(error)

  const handleIgnoreTask = useCallback((taskId) => {
    setSkippedCalendarIds(prev => { const next = new Set(prev); next.add(taskId); return next; });
  }, [setSkippedCalendarIds]);

  const handleMarkEventSeen = useCallback((ev) => {
    const key = ev.recurringEventId || ev.id;
    setSeenCalendarEventIds(prev => { const next = new Set(prev); next.add(key); return next; });
  }, [setSeenCalendarEventIds]);

  const handleReviewNewEvent = useCallback((ev) => {
    handleMarkEventSeen(ev);
    if (ev.recurrence?.length || ev.recurringEventId) {
      const masterKey = ev.recurringEventId || ev.id;
      const recurrenceDesc = Array.isArray(ev.recurrence) && ev.recurrence[0] ? ev.recurrence[0] : '';
      setRecurringAcknowledgedMap(prev => {
        const next = new Map(prev);
        next.set(masterKey, { acknowledgedAt: Date.now(), title: ev.summary || '(No title)', recurrenceDesc });
        return next;
      });
    }
    processCalendarEventWithAI(ev);
  }, [handleMarkEventSeen, processCalendarEventWithAI]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // Detect calendar events that have no linked task and haven't been reviewed/skipped yet.
  // Deduplicated by master recurring event ID so a recurring series appears only once.
  const pendingNewCalendarEvents = useMemo(() => {
    const linkedIds = new Set(tasks.filter(t => t.calendarEventId).map(t => t.calendarEventId));
    const horizon = new Date(today); horizon.setDate(today.getDate() + 30);
    const seenMasters = new Set();
    return calendarEvents.filter(ev => {
      const evStart = calEventStart(ev);
      if (!evStart || evStart < today || evStart > horizon) return false;
      const masterKey = ev.recurringEventId || ev.id;
      if (seenCalendarEventIds.has(masterKey)) return false;
      const _ack = recurringAcknowledgedMap.get(masterKey);
      if (_ack && (Date.now() - _ack.acknowledgedAt) < recurringReviewDays * 86400000) return false;
      if (linkedIds.has(ev.id) || (ev.recurringEventId && linkedIds.has(ev.recurringEventId))) return false;
      if (seenMasters.has(masterKey)) return false;
      seenMasters.add(masterKey);
      return true;
    }).sort((a, b) => calEventStart(a) - calEventStart(b));
  }, [calendarEvents, tasks, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays, today]);

  // Fetch events for a 60-day window centered on a given date
  const fetchEvents = useCallback(async (center) => {
    if (!googleToken || !calendarEnabled) return;
    const start = new Date(center);
    start.setDate(start.getDate() - 15);
    start.setHours(0, 0, 0, 0);
    const end = new Date(center);
    end.setDate(end.getDate() + 45);
    end.setHours(23, 59, 59, 999);
    setLoading(true);
    setError(null);
    try {
      const evs = await doCalendarFetchEvents(googleToken, start, end);
      setCalendarEvents(evs);
      setFetchWindow({ start, end });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [googleToken, calendarEnabled, setCalendarEvents]);

  // Initial fetch on mount or connection
  useEffect(() => {
    if (googleToken && calendarEnabled) fetchEvents(new Date());
  }, [googleToken, calendarEnabled]); // eslint-disable-line

  // Refetch if navDate drifts near the edge of the current window
  useEffect(() => {
    if (!fetchWindow || !googleToken || !calendarEnabled) return;
    const margin = 7 * 86400000;
    if (navDate < new Date(fetchWindow.start.getTime() + margin) ||
        navDate > new Date(fetchWindow.end.getTime() - margin)) {
      fetchEvents(navDate);
    }
  }, [navDate]); // eslint-disable-line

  // Tasks with due dates in the next 60 days that haven't been pushed to calendar
  const pendingTasks = useMemo(() => {
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 60);
    return tasks.filter(t =>
      t.dueDate && !t.done && !t.calendarEventId &&
      t.bucket !== 'inboxHistory' &&
      new Date(t.dueDate + 'T00:00:00') >= today &&
      new Date(t.dueDate + 'T00:00:00') <= horizon
    ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, today]);

  const handleDeleteEvent = async (ev) => {
    if (!googleToken) return;
    try {
      const result = await doCalendarDeleteEvent(googleToken, ev.id);
      if (result) {
        const { masterEventId, cutoffDateStr } = result;
        setCalendarEvents(prev => prev.filter(e => {
          const eId = e.recurringEventId || e.id;
          if (eId !== masterEventId && e.id !== masterEventId) return true;
          if (cutoffDateStr === null) return false;                    // delete all instances
          const eStart = e.start?.date || e.start?.dateTime?.slice(0, 10);
          return eStart && eStart < cutoffDateStr;                     // keep past instances
        }));
        setTasks(prev => prev.map(t =>
          (t.calendarEventId === ev.id || t.calendarEventId === masterEventId)
            ? { ...t, calendarEventId: null } : t
        ));
      } else {
        setCalendarEvents(prev => prev.filter(e => e.id !== ev.id));
        setTasks(prev => prev.map(t => t.calendarEventId === ev.id ? { ...t, calendarEventId: null } : t));
      }
    } catch (e) { setError(`Delete failed: ${e.message}`); }
  };

  const handleRescheduleEvent = async (ev, newDate, startTime, endTime) => {
    if (!googleToken) return;
    try {
      const updated = await doCalendarUpdateEvent(googleToken, ev.id, { date: newDate, startTime, endTime });
      setCalendarEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
      setTasks(prev => prev.map(t => t.calendarEventId === ev.id ? { ...t, dueDate: newDate } : t));
    } catch (e) { setError(`Reschedule failed: ${e.message}`); }
  };

  const handleConfirmAdd = async (task) => {
    setAddStatus(prev => ({ ...prev, [task.id]: 'loading' }));
    try {
      const rrule = buildRRULE(task.recurrence, task.recurrence?.until || null);
      const startDate = task.recurrence ? firstOccurrenceDate(task.recurrence) : task.dueDate;
      const ev = await doCalendarCreateEvent(googleToken, {
        summary: task.text, description: `GTD task added from your task manager.`,
        date: startDate,
        ...(rrule ? { recurrence: [rrule] } : {}),
      });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, calendarEventId: ev.id } : t));
      setCalendarEvents(prev => [...prev, ev]);
      setAddStatus(prev => ({ ...prev, [task.id]: 'done' }));
      setAddConfirmId(null);
    } catch (e) {
      setAddStatus(prev => ({ ...prev, [task.id]: 'error:' + e.message }));
    }
  };

  // ── Navigation helpers ──
  const navPrev = () => {
    setNavDate(d => {
      const n = new Date(d);
      if (calendarTab === 'month')      { n.setMonth(n.getMonth() - 1); n.setDate(1); }
      else if (calendarTab === 'week')  { n.setDate(n.getDate() - 7); }
      else                              { n.setDate(n.getDate() - 1); }
      return n;
    });
  };
  const navNext = () => {
    setNavDate(d => {
      const n = new Date(d);
      if (calendarTab === 'month')      { n.setMonth(n.getMonth() + 1); n.setDate(1); }
      else if (calendarTab === 'week')  { n.setDate(n.getDate() + 7); }
      else                              { n.setDate(n.getDate() + 1); }
      return n;
    });
  };
  const navLabel = () => {
    if (calendarTab === 'month') return `${MONTH_NAMES[navDate.getMonth()]} ${navDate.getFullYear()}`;
    if (calendarTab === 'week') {
      const mon = getMondayOfWeek(navDate);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return `${mon.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return navDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const tabBtnStyle = (t) => ({
    padding: '5px 13px', borderRadius: 6, border: `1px solid ${calendarTab === t ? COLORS.calendar : COLORS.border}`,
    background: calendarTab === t ? COLORS.calendar + '22' : 'transparent',
    color: calendarTab === t ? COLORS.calendar : COLORS.text2,
    fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: calendarTab === t ? 600 : 400,
  });

  // ── Not connected ──
  if (!calendarEnabled) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 300 }}>📅 Calendar</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>View events, sync tasks, and get AI suggestions</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
          <div style={{ fontSize: 40 }}>📅</div>
          <div style={{ fontSize: 15, color: COLORS.text2, fontWeight: 500 }}>Connect Google Calendar</div>
          <div style={{ fontSize: 12, color: COLORS.muted, textAlign: 'center', maxWidth: 320, lineHeight: 1.6 }}>
            View 60 days of events, sync tasks with due dates, and let the AI suggest GTD tasks from your calendar events.
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, textAlign: 'center', maxWidth: 320, lineHeight: 1.5, background: COLORS.surface2, padding: '10px 14px', borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
            First enable the <strong style={{ color: COLORS.text2 }}>Google Calendar API</strong> in your Google Cloud Console and add the <code style={{ fontSize: 10, background: COLORS.surface3, padding: '1px 4px', borderRadius: 3 }}>calendar.events</code> scope to your OAuth consent screen.
          </div>
          <button
            onClick={onConnectCalendar}
            style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${COLORS.calendar}`, background: COLORS.calendar + '22', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >
            Connect Calendar
          </button>
        </div>
      </div>
    );
  }

  // ── Connected ──
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 15, fontWeight: 300, marginRight: 4 }}>📅 Calendar</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['month', 'week', 'day'].map(t => (
            <button key={t} onClick={() => setCalendarTab(t)} style={tabBtnStyle(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <button onClick={navPrev} style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, minWidth: 160, textAlign: 'center' }}>{navLabel()}</span>
          <button onClick={navNext} style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' }}>›</button>
          <button onClick={() => { setNavDate(new Date()); }} style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Today</button>
          <button onClick={() => fetchEvents(navDate)} disabled={loading} style={{ padding: '4px 9px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: loading ? COLORS.muted : COLORS.text2, fontFamily: 'inherit', fontSize: 11, cursor: loading ? 'default' : 'pointer' }}>{loading ? '…' : '↺'}</button>
        </div>
      </div>

      {error && <div style={{ padding: '8px 16px', fontSize: 12, color: '#d4845a' }}>⚠ {error}</div>}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Calendar → Tasks: new events without linked tasks */}
        {pendingNewCalendarEvents.length > 0 && (
          <CalendarNewEventsSection
            events={pendingNewCalendarEvents}
            onReview={handleReviewNewEvent}
            onSkip={handleMarkEventSeen}
          />
        )}

        {/* Tasks → Calendar section */}
        {pendingTasks.length > 0 && (
          <CalendarPendingTasksSection
            tasks={pendingTasks}
            addConfirmId={addConfirmId}
            addStatus={addStatus}
            onRequestAdd={id => setAddConfirmId(id)}
            onConfirmAdd={handleConfirmAdd}
            onCancelAdd={() => setAddConfirmId(null)}
            onOpenDetail={onOpenDetail}
            selectedTaskId={selectedTaskId}
            skippedIds={skippedCalendarIds}
            onIgnore={handleIgnoreTask}
          />
        )}

        {/* Calendar view */}
        {calendarTab === 'month' && (
          <CalendarMonthView
            navDate={navDate}
            events={calendarEvents}
            today={today}
            onDayClick={d => { setNavDate(d); setCalendarTab('day'); }}
            onEventClick={ev => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
            selectedEvent={selectedEvent}
            onProcessWithAI={processCalendarEventWithAI}
            onDelete={handleDeleteEvent}
            onReschedule={handleRescheduleEvent}
          />
        )}
        {calendarTab === 'week' && (
          <CalendarWeekView
            navDate={navDate}
            events={calendarEvents}
            today={today}
            onDayClick={d => { setNavDate(d); setCalendarTab('day'); }}
            onEventClick={ev => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
            selectedEvent={selectedEvent}
            onProcessWithAI={processCalendarEventWithAI}
            onDelete={handleDeleteEvent}
            onReschedule={handleRescheduleEvent}
          />
        )}
        {calendarTab === 'day' && (
          <CalendarDayView
            navDate={navDate}
            events={calendarEvents}
            today={today}
            onEventClick={ev => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
            selectedEvent={selectedEvent}
            onProcessWithAI={processCalendarEventWithAI}
            onDelete={handleDeleteEvent}
            onReschedule={handleRescheduleEvent}
          />
        )}
      </div>
    </div>
  );
}

// ── Calendar sub-components ──────────────────────────────────────────────────

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

function EventChip({ ev, isSelected, onClick }) {
  const allDay = isAllDayEvent(ev);
  const timeStr = allDay ? '' : fmtCalTime(ev) + ' ';
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick(ev); }}
      title={ev.summary || '(No title)'}
      style={{
        fontSize: 10, padding: '1px 5px', borderRadius: 3,
        background: isSelected ? COLORS.calendar : COLORS.calendar + '33',
        color: isSelected ? '#fff' : COLORS.calendar,
        border: `1px solid ${COLORS.calendar}55`,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        cursor: 'pointer', lineHeight: 1.5, marginBottom: 1,
      }}
    >
      {timeStr}{ev.summary || '(No title)'}
    </div>
  );
}

function EventDetailPanel({ ev, onProcessWithAI, onClose, onDelete, onReschedule }) {
  const allDay = isAllDayEvent(ev);
  const start = calEventStart(ev);
  const end = calEventEnd(ev);
  const startStr = start
    ? (allDay
        ? start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : start.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))
    : '';
  const endStr = (!allDay && end && !isSameDay(start, end))
    ? ' – ' + end.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : (!allDay && end ? ' – ' + end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
  const desc = (ev.description || '').replace(/<[^>]*>/g, '').trim();

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleEndTime, setRescheduleEndTime] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const handleDelete = async () => {
    if (onDelete) { await onDelete(ev); onClose(); }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !onReschedule) return;
    setRescheduleLoading(true);
    await onReschedule(ev, rescheduleDate, rescheduleTime || null, rescheduleEndTime || null);
    setRescheduleLoading(false);
    onClose();
  };

  return (
    <div style={{ margin: '8px 16px', padding: '10px 14px', background: COLORS.calendarBg, border: `1px solid ${COLORS.calendar}44`, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, lineHeight: 1.4 }}>{ev.summary || '(No title)'}</div>
        <button onClick={onClose} style={{ padding: '2px 7px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: COLORS.text2 }}>🕐 {startStr}{endStr}</div>
      {ev.location && <div style={{ fontSize: 12, color: COLORS.text2 }}>📍 {ev.location}</div>}
      {desc && <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, maxHeight: 80, overflowY: 'auto' }}>{desc}</div>}

      {rescheduleMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0 4px', borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 11, color: COLORS.text2, fontWeight: 600 }}>Reschedule to:</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.surface2, color: COLORS.text, fontFamily: 'inherit', fontSize: 12 }} />
            {!allDay && (
              <>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} placeholder="Start"
                  style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.surface2, color: COLORS.text, fontFamily: 'inherit', fontSize: 12 }} />
                <input type="time" value={rescheduleEndTime} onChange={e => setRescheduleEndTime(e.target.value)} placeholder="End"
                  style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.surface2, color: COLORS.text, fontFamily: 'inherit', fontSize: 12 }} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleReschedule} disabled={!rescheduleDate || rescheduleLoading}
              style={{ padding: '4px 10px', borderRadius: 5, border: `1px solid ${COLORS.calendar}`, background: COLORS.calendar + '22', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 11, cursor: rescheduleDate ? 'pointer' : 'default' }}>
              {rescheduleLoading ? '…' : 'Confirm'}
            </button>
            <button onClick={() => setRescheduleMode(false)}
              style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 2px', borderTop: `1px solid ${COLORS.border}` }}>
          <span style={{ fontSize: 11, color: '#d4845a' }}>Delete this event from Google Calendar?</span>
          <button onClick={handleDelete}
            style={{ padding: '3px 10px', borderRadius: 5, border: '1px solid #d4845a', background: '#d4845a22', color: '#d4845a', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
            Delete
          </button>
          <button onClick={() => setDeleteConfirm(false)}
            style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => { onProcessWithAI(ev); onClose(); }}
          style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${COLORS.calendar}`, background: COLORS.calendar + '22', color: COLORS.calendar, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
        >
          🤖 Process with AI
        </button>
        {onReschedule && !rescheduleMode && !deleteConfirm && (
          <button onClick={() => setRescheduleMode(true)}
            style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
            📅 Reschedule
          </button>
        )}
        {onDelete && !deleteConfirm && !rescheduleMode && (
          <button onClick={() => setDeleteConfirm(true)}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d4845a44', background: 'transparent', color: '#d4845a', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}

function CalendarMonthView({ navDate, events, today, onDayClick, onEventClick, selectedEvent, onProcessWithAI, onDelete, onReschedule }) {
  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const grid = buildMonthGrid(year, month);

  return (
    <div style={{ padding: '8px 0' }}>
      {selectedEvent && (
        <EventDetailPanel ev={selectedEvent} onProcessWithAI={onProcessWithAI} onClose={() => onEventClick(selectedEvent)} onDelete={onDelete} onReschedule={onReschedule} />
      )}
      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${COLORS.border}` }}>
        {DAY_NAMES_SHORT.map(d => (
          <div key={d} style={{ padding: '4px 6px', fontSize: 10, color: COLORS.muted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {grid.map((d, i) => {
          const isThisMonth = d.getMonth() === month;
          const isToday = isSameDay(d, today);
          const dayEvents = eventsForDay(events, d.getFullYear(), d.getMonth(), d.getDate());
          const maxShow = 3;
          const overflow = dayEvents.length - maxShow;
          return (
            <div
              key={i}
              onClick={() => onDayClick(new Date(d))}
              style={{
                minHeight: 80, padding: '4px 4px 2px', borderRight: (i + 1) % 7 !== 0 ? `1px solid ${COLORS.border}` : 'none',
                borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer',
                background: isToday ? COLORS.calendarBg : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? COLORS.calendar : isThisMonth ? COLORS.text2 : COLORS.muted, marginBottom: 2, textAlign: 'right', paddingRight: 2 }}>
                {isToday ? <span style={{ background: COLORS.calendar, color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{d.getDate()}</span> : d.getDate()}
              </div>
              {dayEvents.slice(0, maxShow).map(ev => (
                <EventChip key={ev.id} ev={ev} isSelected={selectedEvent?.id === ev.id} onClick={onEventClick} />
              ))}
              {overflow > 0 && (
                <div style={{ fontSize: 9, color: COLORS.muted, paddingLeft: 4, cursor: 'pointer' }}>+{overflow} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarWeekView({ navDate, events, today, onDayClick, onEventClick, selectedEvent, onProcessWithAI, onDelete, onReschedule }) {
  const monday = getMondayOfWeek(navDate);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });

  return (
    <div style={{ padding: '8px 0' }}>
      {selectedEvent && (
        <EventDetailPanel ev={selectedEvent} onProcessWithAI={onProcessWithAI} onClose={() => onEventClick(selectedEvent)} onDelete={onDelete} onReschedule={onReschedule} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          const dayEvents = eventsForDay(events, d.getFullYear(), d.getMonth(), d.getDate());
          return (
            <div key={i} style={{ borderRight: i < 6 ? `1px solid ${COLORS.border}` : 'none', padding: '0 4px' }}>
              <div
                onClick={() => onDayClick(new Date(d))}
                style={{ padding: '6px 4px 4px', textAlign: 'center', cursor: 'pointer', marginBottom: 4 }}
              >
                <div style={{ fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{DAY_NAMES_SHORT[d.getDay()]}</div>
                <div style={{ fontSize: 18, fontWeight: isToday ? 700 : 300, color: isToday ? COLORS.calendar : COLORS.text2, lineHeight: 1.2 }}>{d.getDate()}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayEvents.map(ev => (
                  <EventChip key={ev.id} ev={ev} isSelected={selectedEvent?.id === ev.id} onClick={onEventClick} />
                ))}
                {dayEvents.length === 0 && <div style={{ height: 40 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarDayView({ navDate, events, today, onEventClick, selectedEvent, onProcessWithAI, onDelete, onReschedule }) {
  const isToday = isSameDay(navDate, today);
  const dayEvents = eventsForDay(events, navDate.getFullYear(), navDate.getMonth(), navDate.getDate())
    .sort((a, b) => {
      const ta = calEventStart(a); const tb = calEventStart(b);
      if (!ta) return 1; if (!tb) return -1;
      return ta - tb;
    });

  const allDayEvs = dayEvents.filter(ev => isAllDayEvent(ev));
  const timedEvs = dayEvents.filter(ev => !isAllDayEvent(ev));

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: isToday ? COLORS.calendar : COLORS.text2, marginBottom: 12 }}>
        {navDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        {isToday && <span style={{ fontSize: 11, marginLeft: 8, background: COLORS.calendar + '33', color: COLORS.calendar, padding: '2px 8px', borderRadius: 10 }}>Today</span>}
      </div>

      {selectedEvent && (
        <EventDetailPanel ev={selectedEvent} onProcessWithAI={onProcessWithAI} onClose={() => onEventClick(selectedEvent)} onDelete={onDelete} onReschedule={onReschedule} />
      )}

      {allDayEvs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>All Day</div>
          {allDayEvs.map(ev => (
            <div key={ev.id} style={{ marginBottom: 4 }}>
              <div
                onClick={() => onEventClick(ev)}
                style={{ padding: '7px 12px', borderRadius: 6, background: selectedEvent?.id === ev.id ? COLORS.calendar + '33' : COLORS.calendarBg, border: `1px solid ${COLORS.calendar}44`, cursor: 'pointer' }}
              >
                <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{ev.summary || '(No title)'}</div>
                {ev.location && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>📍 {ev.location}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {timedEvs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {timedEvs.map(ev => {
            const start = calEventStart(ev);
            const end = calEventEnd(ev);
            const timeStr = start ? start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
            const endStr = end ? end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
            return (
              <div key={ev.id} style={{ marginBottom: 2 }}>
                <div
                  onClick={() => onEventClick(ev)}
                  style={{ display: 'flex', gap: 12, padding: '8px 12px', borderRadius: 6, background: selectedEvent?.id === ev.id ? COLORS.calendar + '33' : COLORS.calendarBg, border: `1px solid ${COLORS.calendar}44`, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: 11, color: COLORS.calendar, minWidth: 90, flexShrink: 0, lineHeight: 1.4, paddingTop: 2 }}>
                    {timeStr}{endStr ? <><br /><span style={{ color: COLORS.muted }}>→ {endStr}</span></> : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>{ev.summary || '(No title)'}</div>
                    {ev.location && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>📍 {ev.location}</div>}
                    {ev.description && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description.replace(/<[^>]*>/g, '').slice(0, 100)}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dayEvents.length === 0 && (
        <div style={{ fontSize: 13, color: COLORS.muted, textAlign: 'center', marginTop: 40 }}>No events on this day.</div>
      )}
    </div>
  );
}


export { CalendarSuggestionsBar, MONTH_NAMES, DAY_NAMES_SHORT, CalendarManagementView, CalendarNewEventsSection, CalendarPendingTasksSection, EventChip, EventDetailPanel, CalendarMonthView, CalendarWeekView, CalendarDayView };
