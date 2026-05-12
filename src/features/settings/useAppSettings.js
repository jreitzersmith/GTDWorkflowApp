import { useState, useEffect } from "react";

const DEFAULT_EFFORTS = ["2 min", "5 min", "10 min", "30 min", "1 hour", "2 hours", "6 hours", "1 day", "3 days", "1 week", "1 month"];

// ── useAppSettings ────────────────────────────────────────────────────────────
// Manages user-configurable settings (locations, efforts, calibration, tag display)
// and keeps them synced to localStorage.
function useAppSettings() {
  const [locations, setLocations] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("gtd_locations") || "null") || ["Computer", "Home", "Phone", "Work"]); } catch { return ["Computer", "Home", "Phone", "Work"]; }
  });
  const [efforts, setEfforts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_efforts") || "null") || DEFAULT_EFFORTS; } catch { return DEFAULT_EFFORTS; }
  });
  // calibrationOverrides: { [effortLabel]: overrideLabel | null }
  // Stores manual overrides set in Settings; auto-computed values are derived from tasks at runtime.
  const [calibrationOverrides, setCalibrationOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_effort_calibration") || "null") || {}; } catch { return {}; }
  });
  const [tagDisplay, setTagDisplay] = useState(() => localStorage.getItem("gtd_tag_display") || "below");
  const [categories, setCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_categories") || "null") || []; } catch { return []; }
  });
  // FR#37: calendar reminder interval (minutes, device-local preference)
  const [calendarReminderMinutes, setCalendarReminderMinutes] = useState(() => {
    const v = parseInt(localStorage.getItem("gtd_calendar_reminder_minutes"), 10);
    return isNaN(v) ? 10 : v;
  });

  useEffect(() => { localStorage.setItem("gtd_locations",          JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem("gtd_efforts",            JSON.stringify(efforts)); }, [efforts]);
  useEffect(() => { localStorage.setItem("gtd_effort_calibration", JSON.stringify(calibrationOverrides)); }, [calibrationOverrides]);
  useEffect(() => { localStorage.setItem("gtd_tag_display", tagDisplay); }, [tagDisplay]);
  useEffect(() => { localStorage.setItem("gtd_categories",         JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("gtd_calendar_reminder_minutes", String(calendarReminderMinutes)); }, [calendarReminderMinutes]);

  // Next Actions view mode: 'simple' (all bucket:next tasks) | 'gtd-strict' (one per project — stub, not yet implemented)
  const [nextActionsViewMode, setNextActionsViewMode] = useState(() =>
    localStorage.getItem('gtd_next_actions_mode') || 'simple'
  );
  useEffect(() => { localStorage.setItem('gtd_next_actions_mode', nextActionsViewMode); }, [nextActionsViewMode]);

  // reviewNodeTypes: which nodeTypes appear in the Project Review queue
  const [reviewNodeTypes, setReviewNodeTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_review_node_types') || 'null') || ['project', 'subproject', 'task']; } catch { return ['project', 'subproject', 'task']; }
  });
  useEffect(() => { localStorage.setItem('gtd_review_node_types', JSON.stringify(reviewNodeTypes)); }, [reviewNodeTypes]);

  return { locations, setLocations, efforts, setEfforts, calibrationOverrides, setCalibrationOverrides, tagDisplay, setTagDisplay, categories, setCategories, calendarReminderMinutes, setCalendarReminderMinutes, nextActionsViewMode, setNextActionsViewMode, reviewNodeTypes, setReviewNodeTypes };
}


export { useAppSettings, DEFAULT_EFFORTS };
