import { useState } from "react";
import { COLORS } from "../../constants.jsx";
import {
  calEventStart, calEventEnd, isAllDayEvent, fmtCalTime,
  eventsForDay, isSameDay, getMondayOfWeek,
} from "./calendarApi.js";

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
              key={d.toISOString()}
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
            <div key={d.toISOString()} style={{ borderRight: i < 6 ? `1px solid ${COLORS.border}` : 'none', padding: '0 4px' }}>
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

export { MONTH_NAMES, DAY_NAMES_SHORT, buildMonthGrid, EventChip, EventDetailPanel, CalendarMonthView, CalendarWeekView, CalendarDayView };