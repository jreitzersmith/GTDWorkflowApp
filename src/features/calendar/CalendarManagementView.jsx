import { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import {
  doCalendarFetchEvents, doCalendarCreateEvent,
  doCalendarUpdateEvent, doCalendarDeleteEvent,
  calEventStart, buildRRULE, firstOccurrenceDate, getMondayOfWeek,
  getLinkedTasks,
} from "./calendarApi.js";
import { CalendarNewEventsSection, CalendarPendingTasksSection } from "./CalendarManagementSections.jsx";
import { CalendarMonthView, CalendarWeekView, CalendarDayView, MONTH_NAMES } from "./CalendarEventDisplay.jsx";

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

  // Tasks whose calendarEventId matches the currently selected event (or its recurring master).
  const linkedTasks = useMemo(() => getLinkedTasks(tasks, selectedEvent), [tasks, selectedEvent]);

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
            linkedTasks={linkedTasks}
            onOpenTask={onOpenDetail}
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
            linkedTasks={linkedTasks}
            onOpenTask={onOpenDetail}
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
            linkedTasks={linkedTasks}
            onOpenTask={onOpenDetail}
          />
        )}
      </div>
    </div>
  );
}

export { CalendarManagementView };