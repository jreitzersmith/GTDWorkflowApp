// Google Calendar API helpers and date/display utilities.
// Pure async functions — no React dependencies.

// ── Google Calendar API helpers ──────────────────────────────────────────────

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// Fetch all calendar events between timeMin and timeMax (Date objects), paging through results
async function doCalendarFetchEvents(token, timeMin, timeMax) {
  const allEvents = [];
  let pageToken = null;
  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', timeMin.toISOString());
    url.searchParams.set('timeMax', timeMax.toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    const data = await parseApiResponse(res, 'Calendar API');
    (data.items || []).forEach(e => allEvents.push(e));
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return allEvents;
}

// Create a calendar event — pass date as 'YYYY-MM-DD' for all-day, or include startTime/endTime ('HH:MM') for timed
// Build an RFC 5545 RRULE string from a task recurrence object.
// Returns null if no recurrence is provided.
function buildRRULE(recurrence, untilDate) {
  if (!recurrence) return null;
  const DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const freqMap = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' };
  const freq = freqMap[recurrence.frequency] || 'WEEKLY';
  let rule = `RRULE:FREQ=${freq}`;
  if (recurrence.interval && recurrence.interval > 1) rule += `;INTERVAL=${recurrence.interval}`;
  if (recurrence.weekDays?.length) {
    rule += `;BYDAY=${recurrence.weekDays.map(d => DAY_NAMES[d]).join(',')}`;
  }
  if (untilDate) rule += `;UNTIL=${untilDate.replace(/-/g, '')}T235959Z`;
  return rule;
}

// Return the nearest calendar date (YYYY-MM-DD) matching one of the recurrence weekDays.
// Falls back to today when no weekDays are specified.
function firstOccurrenceDate(recurrence) {
  if (!recurrence?.weekDays?.length) {
    return new Date().toISOString().slice(0, 10);
  }
  const today = new Date();
  const todayDay = today.getDay();
  const days = recurrence.weekDays.slice().sort((a, b) => a - b);
  const nextDay = days.find(d => d >= todayDay) ?? days[0];
  const diff = nextDay >= todayDay ? nextDay - todayDay : 7 - todayDay + nextDay;
  const first = new Date(today);
  first.setDate(today.getDate() + diff);
  return first.toISOString().slice(0, 10);
}

// Parse a Google Calendar RRULE string into a recurrence object.
// Handles FREQ, INTERVAL, BYDAY, and UNTIL.
function parseRRULE(rruleStr) {
  const rule = rruleStr.replace(/^RRULE:/, '');
  const parts = Object.fromEntries(rule.split(';').map(p => { const i = p.indexOf('='); return [p.slice(0,i), p.slice(i+1)]; }));
  const freqMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  const DAY_IDX  = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const rec = {
    frequency: freqMap[parts.FREQ] || 'weekly',
    interval: parseInt(parts.INTERVAL) || 1,
    rescheduleFrom: 'dueDate',
    sendToInbox: false,
  };
  if (parts.BYDAY) {
    rec.weekDays = parts.BYDAY.split(',').map(d => DAY_IDX[d.replace(/^[+-]?\d*/, '')]).filter(n => n !== undefined);
  }
  if (parts.UNTIL) {
    const u = parts.UNTIL.replace(/T.*$/, '');
    rec.until = `${u.slice(0,4)}-${u.slice(4,6)}-${u.slice(6,8)}`;
  }
  return rec;
}

async function doCalendarCreateEvent(token, { summary, description, date, startTime, endTime, recurrence, attendees, sendUpdates }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const body = (startTime && endTime)
    ? { summary, description: description || '',
        start: { dateTime: `${date}T${startTime}:00`, timeZone: tz },
        end:   { dateTime: `${date}T${endTime}:00`,   timeZone: tz } }
    : { summary, description: description || '',
        start: { date },
        end:   { date } };
  if (recurrence?.length) body.recurrence = recurrence;
  if (attendees?.length) body.attendees = attendees;
  const notifyParam = sendUpdates === 'all' ? 'all' : 'none';
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${notifyParam}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return parseApiResponse(res, 'Calendar API');
}

// Delete a calendar event with "from this event on" behaviour for recurring events:
// - If the given event is an instance of a recurring series, truncate the master
//   event's RRULE so the series ends the day before this occurrence.
// - If the given event IS the master recurring event, delete the whole series.
// - If the event is non-recurring, perform a plain DELETE.
// Returns { masterEventId, cutoffDateStr } for recurring cases, null otherwise.
// Callers use the return value to clean up their local calendarEvents state.
async function doCalendarDeleteEvent(token, eventId) {
  const headers = { Authorization: `Bearer ${token}` };

  // GET the event to determine if it's a recurring instance
  const evRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { headers }
  );
  if (!evRes.ok) {
    // Fallback: plain DELETE
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers });
    if (!r.ok && r.status !== 204) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Calendar API ${r.status}`); }
    return null;
  }
  const ev = await evRes.json();

  if (ev.recurringEventId) {
    // ── Instance of a recurring event: truncate series at this point ──────
    const masterEventId = ev.recurringEventId;
    const instanceDate  = ev.originalStartTime?.date
      || ev.originalStartTime?.dateTime?.slice(0, 10)
      || ev.start?.date
      || ev.start?.dateTime?.slice(0, 10);

    if (!instanceDate) {
      // Can't determine date — fall back to single-instance delete
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers });
      if (!r.ok && r.status !== 204) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Calendar API ${r.status}`); }
      return null;
    }

    // Compute UNTIL = day before this instance (end-of-day UTC)
    const cutoffDate = new Date(instanceDate + 'T00:00:00Z');
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 1);
    const untilStr = cutoffDate.toISOString().slice(0, 10).replace(/-/g, '') + 'T235959Z';

    // GET the master event to read its current recurrence rules
    const masterRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(masterEventId)}`,
      { headers }
    );
    const master = await parseApiResponse(masterRes, 'Calendar API');

    const seriesStart = master.start?.date || master.start?.dateTime?.slice(0, 10);
    if (seriesStart && instanceDate <= seriesStart) {
      // Deleting the first occurrence — remove the whole series
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(masterEventId)}`, { method: 'DELETE', headers });
      if (!r.ok && r.status !== 204) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Calendar API ${r.status}`); }
      return { masterEventId, cutoffDateStr: null };
    }

    // Truncate the RRULE (strip any existing UNTIL/COUNT, add new UNTIL)
    const currentRules = master.recurrence || [];
    const newRules = currentRules.map(r => {
      if (!r.startsWith('RRULE:')) return r;
      return r.replace(/;UNTIL=[^;]*/g, '').replace(/;COUNT=[^;]*/g, '') + `;UNTIL=${untilStr}`;
    });
    const patchRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(masterEventId)}`,
      { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ recurrence: newRules }) }
    );
    await parseApiResponse(patchRes, 'Calendar API');
    return { masterEventId, cutoffDateStr: instanceDate };

  } else if (ev.recurrence) {
    // ── Master recurring event: delete the entire series ───────────────────
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers });
    if (!r.ok && r.status !== 204) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Calendar API ${r.status}`); }
    return { masterEventId: eventId, cutoffDateStr: null };

  } else {
    // ── Non-recurring event: plain DELETE ─────────────────────────────────
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers });
    if (!r.ok && r.status !== 204) { const d = await r.json().catch(() => ({})); throw new Error(d.error?.message || `Calendar API ${r.status}`); }
    return null;
  }
}

// doCalendarUpdateEvent: if attendees are provided, first GETs the existing event
// to retrieve current attendees, merges the new ones in, then PATCHes.
// Google's PATCH replaces the attendees array, so a full merge is required.
async function doCalendarUpdateEvent(token, eventId, { summary, date, startTime, endTime, attendees, sendUpdates }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const patch = {};
  if (summary) patch.summary = summary;
  if (date) {
    if (startTime && endTime) {
      patch.start = { dateTime: `${date}T${startTime}:00`, timeZone: tz };
      patch.end   = { dateTime: `${date}T${endTime}:00`,   timeZone: tz };
    } else {
      patch.start = { date };
      patch.end   = { date };
    }
  }
  if (attendees?.length) {
    // Fetch existing event to merge attendees (PATCH replaces, not appends)
    let existing = {};
    try {
      const existingRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(eventId),
        { headers: { Authorization: 'Bearer ' + token } }
      );
      if (existingRes.ok) {
        existing = await existingRes.json().catch(() => ({}));
      } else {
        console.warn('Calendar API: could not fetch existing attendees for event ' + eventId + ' (' + existingRes.status + ') - new attendees will replace existing');
      }
    } catch (e) {
      console.warn('Calendar API: attendee-merge GET failed for event ' + eventId + ' - new attendees will replace existing', e);
    }
    const existingEmails = new Set((existing.attendees || []).map(a => a.email));
    const merged = [...(existing.attendees || []),
      ...attendees.filter(a => !existingEmails.has(a.email))];
    patch.attendees = merged;
  }
  const notifyParam = sendUpdates === 'all' ? 'all' : 'none';
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=${notifyParam}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  return parseApiResponse(res, 'Calendar API');
}

// ── Calendar date/display utilities ─────────────────────────────────────────

function calEventStart(ev) {
  return ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date + 'T00:00:00') : null;
}
function calEventEnd(ev) {
  return ev.end?.dateTime ? new Date(ev.end.dateTime) : ev.end?.date ? new Date(ev.end.date + 'T00:00:00') : null;
}
function isAllDayEvent(ev) { return !!ev.start?.date && !ev.start?.dateTime; }
function fmtCalTime(ev) {
  if (isAllDayEvent(ev)) return 'All day';
  const d = calEventStart(ev);
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function eventsForDay(events, year, month, day) {
  return events.filter(ev => {
    const s = calEventStart(ev);
    return s && s.getFullYear() === year && s.getMonth() === month && s.getDate() === day;
  });
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function getMondayOfWeek(d) {
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0) ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// Day-name -> JS weekday index mapping used by recurrence parsing.
const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// Parse a recurrence field value from AI action syntax into a recurrence object.
// Returns null when val is 'off', otherwise returns a recurrence config object.
function parseRecurrenceValue(val) {
  if (val === 'off') return null;
  const [freq, intStr, daysStr, untilStr] = val.split(':');
  const interval = parseInt(intStr) || 1;
  const rec = { frequency: freq, interval, rescheduleFrom: 'dueDate', sendToInbox: false };
  if (daysStr) rec.weekDays = daysStr.split(',').map(d => DAY_MAP[d.toLowerCase()]).filter(n => n !== undefined);
  if (untilStr && /^\d{4}-\d{2}-\d{2}$/.test(untilStr)) rec.until = untilStr;
  return rec;
}

// Throws a descriptive error for non-ok API responses; otherwise returns parsed JSON.
// Use as: const data = await parseApiResponse(res, 'Gmail API');
async function parseApiResponse(res, label) {
  const lbl = label || 'API';
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error?.message || (lbl + ' ' + res.status));
  }
  try {
    return await res.json();
  } catch (err) {
    throw new Error(lbl + ': unexpected response format');
  }
}


export { CALENDAR_SCOPE, doCalendarFetchEvents, buildRRULE, firstOccurrenceDate, parseRRULE, doCalendarCreateEvent, doCalendarDeleteEvent, doCalendarUpdateEvent, calEventStart, calEventEnd, isAllDayEvent, fmtCalTime, eventsForDay, isSameDay, getMondayOfWeek, genId, DAY_MAP, parseRecurrenceValue, parseApiResponse };
