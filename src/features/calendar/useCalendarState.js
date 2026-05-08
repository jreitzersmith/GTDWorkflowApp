import { useState, useEffect } from "react";

// ── useCalendarState ──────────────────────────────────────────────────────────
// Owns all calendar-related UI state and simple localStorage persistence.
// Note: Supabase-dependent effects that consume this state (settings read/write,
// localStorage fallbacks keyed on authUser) remain in GTDManager until auth state
// is also extracted.
function useCalendarState() {
  const [calendarEvents, setCalendarEvents]               = useState([]);
  const [calendarTab, setCalendarTab]                     = useState(() => localStorage.getItem('gtd_calendar_tab') || 'month');
  const [skippedCalendarIds, setSkippedCalendarIds]       = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('gtd_cal_skipped') || '[]')); }
    catch { return new Set(); }
  });
  const [seenCalendarEventIds, setSeenCalendarEventIds]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('gtd_cal_seen_events') || '[]')); }
    catch { return new Set(); }
  });
  const [recurringAcknowledgedMap, setRecurringAcknowledgedMap] = useState(() => {
    try { const raw = JSON.parse(localStorage.getItem('gtd_cal_recurring_ack') || '[]');
          return new Map(raw); }
    catch { return new Map(); }
  });
  const [recurringReviewDays, setRecurringReviewDays]     = useState(() => {
    const v = parseInt(localStorage.getItem('gtd_recurring_review_days') || '7', 10);
    return isNaN(v) ? 7 : v;
  });
  const [calendarSuggestions, setCalendarSuggestions]           = useState([]);
  const [calendarSuggestionsReady, setCalendarSuggestionsReady] = useState(false);

  useEffect(() => { localStorage.setItem('gtd_calendar_tab', calendarTab); }, [calendarTab]);

  return {
    calendarEvents, setCalendarEvents,
    calendarTab, setCalendarTab,
    skippedCalendarIds, setSkippedCalendarIds,
    seenCalendarEventIds, setSeenCalendarEventIds,
    recurringAcknowledgedMap, setRecurringAcknowledgedMap,
    recurringReviewDays, setRecurringReviewDays,
    calendarSuggestions, setCalendarSuggestions,
    calendarSuggestionsReady, setCalendarSuggestionsReady,
  };
}


export { useCalendarState };
