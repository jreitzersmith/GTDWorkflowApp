import { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { TaskActionsContext, TaskRowContext } from "./contexts.js";
import { COLORS, BUCKETS } from "./constants.jsx";
import { EmailManagementView } from "./features/email/email.jsx";
import { TodaysFocusView } from "./features/tasks/TodaysFocusView.jsx";
import { CalendarManagementView } from "./features/calendar/CalendarManagementView.jsx";
import { DeferCheckPrompt, NoteRollupPrompt, ActualEffortPrompt } from "./features/coach/AICoach.jsx";
import { SettingsPanel } from "./features/settings/SettingsPanel.jsx";
import { UsagePanel } from "./features/settings/UsagePanel.jsx";
import { TaskDetailPanel } from "./features/tasks/TaskDetailPanel.jsx";
import { ErrorBoundary } from "./shared/ErrorBoundary.jsx";
import { ResizeHandle } from "./shared/ResizeHandle.jsx";
import { AuthGate } from "./shared/AuthGate.jsx";
import { AppSidebar } from "./shared/AppSidebar.jsx";
import { SearchModal } from "./shared/SearchModal.jsx";
import { TaskBucketView } from "./features/tasks/TaskBucketView.jsx";
import { CoachPanel } from "./features/coach/CoachPanel.jsx";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth.js";
import { useGoogleAuth } from "./hooks/useGoogleAuth.js";
import { useAppSettings } from "./features/settings/useAppSettings.js";
import { useAIUsageTracking } from "./features/settings/useAIUsageTracking.js";
import { useProjectReview } from "./features/coach/useProjectReview.js";
import { useCalendarState } from "./features/calendar/useCalendarState.js";
import { useGmailState } from "./features/email/useGmailState.js";
import { useAICoachState } from "./features/coach/useAICoachState.js";
import { useTaskUIState } from "./features/tasks/useTaskUIState.js";
import { createEmptyUsageStats } from "./features/settings/useAIUsageTracking.js";

import { parseRRULE, calEventStart, isAllDayEvent, genId } from "./features/calendar/calendarApi.js";
import { todayStr, isDeferred, buildNextOccurrence, extractSuggestions, extractMetadata, getOrderedChildren, useResizer } from "./features/tasks/taskUtils.jsx";
import { useDragDrop } from "./features/tasks/useDragDrop.js";
import { useSupabaseSync } from "./hooks/useSupabaseSync.js";
import { useCallAI } from "./features/coach/useCallAI.js";
import { useInboxProcessing } from "./features/tasks/useInboxProcessing.js";
import { useTaskCrud } from "./features/tasks/useTaskCrud.js";
import { useSettings } from "./features/settings/useSettings.js";




const sleep = ms => new Promise(r => setTimeout(r, ms));















export default function GTDManager() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_tasks") || "[]"); } catch { return []; }
  });
  const { messages, setMessages, chatHistory, setChatHistory, coachMode, setCoachMode, chatInput, setChatInput, loading, setLoading, moveMenu, setMoveMenu, pendingAction, setPendingAction, chatEndRef, chatInputRef, provider, setProvider, localModel, setLocalModel, availableModels, setAvailableModels } = useAICoachState();
  const { locations, setLocations, efforts, setEfforts, calibrationOverrides, setCalibrationOverrides, tagDisplay, setTagDisplay, categories, setCategories } = useAppSettings();
  const { aiUsageStats, setAiUsageStats, sessionUsage, recordUsage } = useAIUsageTracking();
  const { currentView, setCurrentView, emailTab, setEmailTab, gmailQueue, setGmailQueue, gmailUnreadCount, setGmailUnreadCount } = useGmailState();
  const { calendarEvents, setCalendarEvents, calendarTab, setCalendarTab, skippedCalendarIds, setSkippedCalendarIds, seenCalendarEventIds, setSeenCalendarEventIds, recurringAcknowledgedMap, setRecurringAcknowledgedMap, recurringReviewDays, setRecurringReviewDays, calendarSuggestions, setCalendarSuggestions, calendarSuggestionsReady, setCalendarSuggestionsReady } = useCalendarState();
  const { googleToken, googleScope, calendarEnabled, driveEnabled, docsEnabled,
          sheetsEnabled, slidesEnabled, gmailError, scopePrefs,
          setScopePref, reauthorizeGoogle, connectCalendar, disconnectCalendar,
          disconnectAll, refreshGoogleToken } = useGoogleAuth({ setCalendarEvents });
  const { currentBucket, setCurrentBucket, addText, setAddText, showSettings, setShowSettings, showUsage, setShowUsage, nextGroupBy, setNextGroupBy, projectParentId, setProjectParentId, collapsedNodes, setCollapsedNodes, toggleCollapse, toggleCollapseLevel, selectedTaskId, setSelectedTaskId, actualEffortPrompt, setActualEffortPrompt, pendingRollup, setPendingRollup, pendingDeferCheck, setPendingDeferCheck, inboxSelectedIds, setInboxSelectedIds, pendingGroupSuggestion, setPendingGroupSuggestion, showCompletedInProjects, setShowCompletedInProjects } = useTaskUIState();
  const { reviewProjectIdx, setReviewProjectIdx, reviewSuggestions, setReviewSuggestions, reviewReady, setReviewReady, reviewMode, setReviewMode, metadataSuggestions, setMetadataSuggestions } = useProjectReview();
  const [projectCategoryFilter, setProjectCategoryFilter] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  // Compute Today's Focus count from localStorage for sidebar badge
  const focusCount = (() => {
    try {
      const today8601 = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem(`gtd-todays-focus-${today8601}`);
      if (!raw) return 0;
      const { ids } = JSON.parse(raw);
      return (ids || []).filter(id => tasks.find(t => t.id === id && !t.done)).length;
    } catch { return 0; }
  })();

  const [dailyReviewPhase, setDailyReviewPhase] = useState(() => {
    try {
      const raw = localStorage.getItem('gtd-daily-phase');
      if (!raw) return 'start';
      const { phase, date } = JSON.parse(raw);
      return date === new Date().toDateString() ? phase : 'start';
    } catch { return 'start'; }
  });

  // ── Auth ───────────────────────────────────────────────────────────────
  const { authUser, authLoading, authEmail, setAuthEmail, authSent, sendMagicLink } = useSupabaseAuth();

  // true when processing was triggered by 'Add & Ask AI' (single-task scope)
  const singleTaskMode = useRef(false);
  // id of the inbox task currently being processed by the AI coach
  const processingTaskId = useRef(null);
  // inbox task IDs skipped in the current processing session; reset on fresh startProcessInbox
  const skippedInSessionIds = useRef(new Set());

  const { syncStatus, supabaseReady } = useSupabaseSync({
    authUser, tasks, setTasks,
    locations, efforts, calibrationOverrides, categories,
    skippedCalendarIds, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays,
    setLocations, setEfforts, setCalibrationOverrides, setCategories,
    setSkippedCalendarIds, setSeenCalendarEventIds, setRecurringAcknowledgedMap, setRecurringReviewDays,
    setGmailQueue,
  });

  const { dragId, dropTarget, setDropTarget, handleProjectDragStart, handleProjectDragOver, handleProjectDragEnd, handleProjectDrop } = useDragDrop({ setTasks });

  // Panel resize state — persisted across sessions
  const [sidebarWidth, sidebarDragDown]      = useResizer("gtd_sidebar_w",     240,                                    { min: 160, max: 420, direction: 'h', sign:  1 });
  const [coachHeight,  coachDragDown]         = useResizer("gtd_coach_h",       Math.round(window.innerHeight * 0.42), { min: 80,  max: 650, direction: 'v', sign: -1 });
  const [detailWidth,  detailDragDown]        = useResizer("gtd_detail_w",      360,                                   { min: 240, max: 600, direction: 'h', sign: -1 });
  const [chatInputHeight, chatInputDragDown]  = useResizer("gtd_chat_input_h",  60,                                    { min: 36,  max: 300, direction: 'v', sign: -1 });



  // Fetch unread inbox count whenever the Gmail token changes
  // Use labels/INBOX endpoint — messagesUnread is exact; resultSizeEstimate on messages.list is unreliable
  useEffect(() => {
    if (!googleToken) { setGmailUnreadCount(null); return; }
    fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels/INBOX', {
      headers: { Authorization: `Bearer ${googleToken}` },
    })
      .then(r => r.json())
      .then(d => setGmailUnreadCount(d.messagesUnread ?? null))
      .catch(() => setGmailUnreadCount(null));
  }, [googleToken]);
  useEffect(() => { if (currentBucket !== "project") setProjectParentId("__new__"); }, [currentBucket]);
  useEffect(() => { setSelectedTaskId(null); }, [currentBucket]);
  // FR#61: when a project-bucket task is selected in Projects view, auto-populate the add bar parent.
  // tasks intentionally omitted from deps — react only to selection changes, not every task mutation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (currentBucket !== 'project') return;
    const sel = tasks.find(t => t.id === selectedTaskId);
    setProjectParentId(sel?.bucket === 'project' ? selectedTaskId : '__new__');
  }, [selectedTaskId, currentBucket]);

  // Global search — Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-surface: on mount, move any standalone deferred tasks whose wake date has passed into Inbox.
  // Only moves tasks with no parentId (project subtasks stay in place; their deferUntil just stops hiding them).
  useEffect(() => {
    const today = todayStr();
    setTasks(prev => {
      const wokeIds = new Set(
        prev.filter(t =>
          t.deferUntil && t.deferUntil <= today && !t.done && !t.parentId &&
          t.bucket !== "inbox" && t.bucket !== "done" && t.bucket !== "inboxHistory"
        ).map(t => t.id)
      );
      if (!wokeIds.size) return prev;
      return prev.map(t => wokeIds.has(t.id) ? { ...t, bucket: "inbox", deferUntil: null } : t);
    });
  }, []); // run once on mount

  const getTaskContext = useCallback((allowedBuckets = null) => {
    const today = todayStr();
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    const cutoff14 = new Date(todayDate); cutoff14.setDate(cutoff14.getDate() + 14);
    const BUCKET_CAPS = { next: 75, someday: 40 };
    const bucketNames = { inbox: "Inbox", next: "Next Actions", project: "Projects", waiting: "Waiting For", someday: "Someday/Maybe" };
    const sections = Object.entries(bucketNames).filter(([k]) => !allowedBuckets || allowedBuckets.includes(k)).map(([k, label]) => {
      const items = tasks.filter(t => t.bucket === k && !t.done);
      if (!items.length) return `${label}: empty`;
      const cap = BUCKET_CAPS[k];
      let displayItems;
      if (k === 'next') {
        const dueSoon = items
          .filter(t => t.dueDate && new Date(t.dueDate) <= cutoff14)
          .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const dueSoonIds = new Set(dueSoon.map(t => t.id));
        const rest = items
          .filter(t => !dueSoonIds.has(t.id))
          .sort((a, b) => b.created - a.created);
        displayItems = [...dueSoon, ...rest.slice(0, Math.max(0, cap - dueSoon.length))];
      } else {
        displayItems = cap && items.length > cap
          ? items.slice().sort((a, b) => b.created - a.created).slice(0, cap)
          : items;
      }
      const omitted = items.length - displayItems.length;
      // For Projects: reorder into depth-first tree order matching the sidebar; track depth for indentation
      let orderedItems = displayItems;
      const depthMap = new Map();
      if (k === 'project') {
        const byId = new Map(items.map(t => [t.id, t]));
        const roots = displayItems.filter(t => !t.parentId || !byId.get(t.parentId));
        const ordered = [];
        const visit = (task, depth) => {
          ordered.push(task);
          depthMap.set(task.id, depth);
          (task.childIds || []).forEach(cid => { const c = byId.get(cid); if (c && !c.done) visit(c, depth + 1); });
        };
        roots.forEach(t => visit(t, 0));
        const seen = new Set(ordered.map(t => t.id));
        displayItems.filter(t => !seen.has(t.id)).forEach(t => ordered.push(t));
        orderedItems = ordered;
      }
      const lines = orderedItems.map(t => {
        const meta = [];
        if (t.parentId)         meta.push(`parent:${t.parentId}`);
        if (t.dueDate)          meta.push(`due:${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}`);
        if (t.originalDueDate)  meta.push(`original-due:${t.originalDueDate}`);
        if (t.completedDate)    meta.push(`completed:${t.completedDate}`);
        if (t.deferUntil)       meta.push(`defer-until:${t.deferUntil}`);
        if (t.effort)           meta.push(`effort:${t.effort}`);
        if (t.actualEffort)     meta.push(`actual-effort:${t.actualEffort}`);
        if (t.location?.length) meta.push(`location:${t.location.join(",")}`);
        if (t.priority?.length) meta.push(`priority:${t.priority.join(",")}`);
        if (t.notes)            meta.push(`has-notes`);
        if (t.category)         meta.push(`category:${t.category}`);
        if (t.recurrence) {
          const r = t.recurrence;
          const days = r.weekDays?.length
            ? `:${r.weekDays.map(d => ["sun","mon","tue","wed","thu","fri","sat"][d]).join(",")}`
            : "";
          const until = r.until ? `:${r.until}` : "";
          meta.push(`recur:${r.frequency}:${r.interval || 1}${days}${until}`);
        }
        const indent = depthMap.has(t.id) ? '  '.repeat(depthMap.get(t.id)) : '';
        const idTag = `[id:${t.id}] `;
        return meta.length ? `${indent}- ${idTag}${t.text} [${meta.join("] [")}]` : `${indent}- ${idTag}${t.text}`;
      });
      return `${label} (${items.length}):\n${lines.join("\n")}${omitted ? `\n[… ${omitted} older items omitted]` : ''}`;
    });
    // Append upcoming calendar events (next 14 days) when calendar is connected
    let calSection = '';
    if (calendarEnabled && calendarEvents.length > 0) {
      const horizon = cutoff14;
      const upcoming = calendarEvents
        .filter(ev => {
          const s = calEventStart(ev);
          return s && s >= todayDate && s <= horizon;
        })
        .sort((a, b) => calEventStart(a) - calEventStart(b))
        .slice(0, 20);
      if (upcoming.length) {
        const lines = upcoming.map(ev => {
          const s = calEventStart(ev);
          const dateStr = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
          const timeStr = isAllDayEvent(ev) ? 'All day' : s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const loc = ev.location ? ` @ ${ev.location}` : '';
          return `- ${dateStr} ${timeStr}: "${ev.summary || '(No title)'}${loc}" [id:${ev.id}]`;
        });
        calSection = `\n\n[Upcoming Calendar Events — next 14 days]\n${lines.join('\n')}`;
      } else {
        calSection = '\n\n[Calendar: connected, no events in the next 14 days]';
      }
    } else if (calendarEnabled) {
      calSection = '\n\n[Calendar: connected — events loading or unavailable]';
    }

    return `Today's date: ${today}\n\n${sections.join("\n\n")}${calSection}`;
  }, [tasks, calendarEnabled, calendarEvents]);

  const { callAI, sendChat, fetchModels, lastInputLog } = useCallAI({
    tasks, efforts, calibrationOverrides,
    provider, localModel,
    googleToken, googleScope, calendarEnabled,
    authUser,
    coachMode, chatInput, chatHistory, loading,
    getTaskContext, recordUsage,
    setTasks, setCalendarEvents, setGmailQueue,
    setMessages, setChatHistory, setChatInput,
    setLoading, setAvailableModels, setPendingAction,
  });

  const switchCoachMode = useCallback((mode, introMsg) => {
    setCoachMode(mode);
    setChatHistory([]);
    setPendingAction(null);
    setMessages([{ role: "assistant", text: introMsg }]);
  }, []);

  const {
    processNextInboxItem,
    handleConfirmMove,
    handleSkipPendingAction,
    handleDeleteInboxItem,
    startProcessInbox,
    askAIAboutTask,
  } = useInboxProcessing({
    tasks, pendingAction,
    singleTaskMode, processingTaskId, skippedInSessionIds,
    setTasks, setCurrentBucket,
    setMessages, setChatHistory,
    setPendingAction,
    callAI, switchCoachMode,
  });

  const {
    addTask, addAndProcess, addProjectTask,
    moveTask, deleteTask,
    completeTask, finishComplete,
    handleRollupConfirm, handleRollupSkip,
    handleDeferCheckSkip, handleDeferCheckReview,
    handleActualEffortSave, handleActualEffortSkip,
    handleRecurringStillFine, handleRecurringNeedsWork,
    reassignProject, assignToProject, bulkAssignToProject,
  } = useTaskCrud({
    tasks,
    addText, setAddText,
    currentBucket, setCurrentBucket,
    projectParentId,
    pendingRollup, setPendingRollup,
    pendingDeferCheck, setPendingDeferCheck,
    actualEffortPrompt, setActualEffortPrompt,
    setTasks, setMoveMenu, setPendingAction,
    setInboxSelectedIds, setSelectedTaskId,
    setRecurringAcknowledgedMap,
    askAIAboutTask,
  });

  const startWeeklyReview = () => {
    const total = tasks.filter(t => t.bucket !== "done").length;
    const introMsg = "Let's do your Weekly Review. You have **" + total +
      " active task" + (total !== 1 ? "s" : "") + "** across your lists.\n\n" +
      "**Step 1: Capture loose ends.**\nLook around — any sticky notes, papers, or things not yet in your system?";
    const now = Date.now();
    const thresholdMs = recurringReviewDays * 86400000;
    const dueForReview = [];
    for (const [masterId, entry] of recurringAcknowledgedMap.entries()) {
      if (now - entry.acknowledgedAt >= thresholdMs) {
        dueForReview.push({ masterId, title: entry.title, recurrenceDesc: entry.recurrenceDesc, acknowledgedAt: entry.acknowledgedAt });
      }
    }
    const msgs = [{ role: 'assistant', text: introMsg }];
    if (dueForReview.length > 0) {
      msgs.push({ role: 'system', type: 'recurringReview', events: dueForReview });
    }
    setCoachMode("review");
    setChatHistory([]);
    setPendingAction(null);
    setMessages(msgs);
  };

  const handleSearchSelect = useCallback((task) => {
    setCurrentView("gtd");
    setCurrentBucket(task.bucket);
    setSelectedTaskId(task.id);
    setShowSettings(false);
    setShowUsage(false);
  }, [setCurrentView, setCurrentBucket, setSelectedTaskId, setShowSettings, setShowUsage]);

  const startBrainDump = () => {
    switchCoachMode("dump", "Let's surface everything in your head and get it into your inbox.\n\n**Starting with work:** What professional tasks, deadlines, or commitments have been on your mind that aren't written down anywhere?");
  };

  // FR#14/FR#64: Daily Review — toggles between Start Day and End Day, persists via localStorage.
  const startDailyReview = () => {
    const today = new Date().toDateString();
    const today8601 = new Date().toISOString().slice(0, 10);

    // Compute a week boundary (next 7 days, exclusive of today)
    const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEnd8601 = weekEnd.toISOString().slice(0, 10);

    // Calendar event IDs that tasks already have
    const calEventIds = new Set(calendarEvents.map(e => e.id).filter(Boolean));

    if (dailyReviewPhase === 'start') {
      const active = tasks.filter(t => !t.done && t.bucket !== 'done' && t.bucket !== 'inboxHistory');
      const overdue        = active.filter(t => t.dueDate && t.dueDate < today8601);
      const dueToday       = active.filter(t => t.dueDate === today8601);
      const dueThisWeek    = active.filter(t => t.dueDate && t.dueDate > today8601 && t.dueDate <= weekEnd8601 && effortToMinutes(t.effort) > 60);
      const noCalEvent     = active.filter(t => t.dueDate && !t.calendarEventId && calendarEnabled);
      const unprocessedInbox = tasks.filter(t => t.bucket === 'inbox' && !t.done).length;

      const lines = [
        `[SoD Summary]`,
        `- Overdue: ${overdue.length}`,
        `- Due today: ${dueToday.length}`,
        `- Due this week (>1 hr effort): ${dueThisWeek.length}`,
        calendarEnabled ? `- Have due date but no calendar event: ${noCalEvent.length}` : null,
        `- Unprocessed inbox items: ${unprocessedInbox}`,
        `[/SoD Summary]`,
      ].filter(Boolean).join('\n');

      const urgencyNote = overdue.length > 0 ? ` You have **${overdue.length} overdue item${overdue.length !== 1 ? 's' : ''}** that need attention.` : '';
      switchCoachMode('daily', `Good morning! Let's start your day.${urgencyNote}\n\n${lines}`);
      const newPhase = 'end';
      setDailyReviewPhase(newPhase);
      localStorage.setItem('gtd-daily-phase', JSON.stringify({ phase: newPhase, date: today }));
    } else {
      const active = tasks.filter(t => !t.done && t.bucket !== 'done' && t.bucket !== 'inboxHistory');
      const dueToday       = active.filter(t => t.dueDate === today8601);
      const inboxCount     = tasks.filter(t => t.bucket === 'inbox' && !t.done).length;

      // Check if a focus list was set today
      const focusKey = `gtd-todays-focus-${today8601}`;
      const focusData = (() => { try { return JSON.parse(localStorage.getItem(focusKey)); } catch { return null; } })();
      const focusIds = focusData?.ids || [];
      const focusDone = focusIds.filter(id => tasks.find(t => t.id === id && t.done)).length;

      const lines = [
        `[EoD Summary]`,
        `- Focus tasks completed: ${focusDone} / ${focusIds.length}`,
        `- Due today (not yet done): ${dueToday.filter(t => !t.done).length}`,
        `- Unprocessed inbox items: ${inboxCount}`,
        `[/EoD Summary]`,
      ].join('\n');

      switchCoachMode('daily', `Let's close out your day.\n\n${lines}`);
      const newPhase = 'start';
      setDailyReviewPhase(newPhase);
      localStorage.setItem('gtd-daily-phase', JSON.stringify({ phase: newPhase, date: today }));
    }
  };

  // Prefill the coach chat with email content so the user can process it into tasks
  const processEmailWithAI = useCallback((email) => {
    const body = email.body ? email.body.slice(0, 4000) : email.snippet;
    const prompt = `Please review this email and identify any action items, commitments, or tasks I should add to my GTD system. For each item found, suggest the best bucket (Next Actions, Projects, Waiting For, etc.) and offer to create it.\n\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${body}`;
    setCoachMode("chat");
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text: prompt }]);
    callAI(prompt, "chat", chatHistory);
  }, [setCoachMode, setChatInput, setMessages, callAI, chatHistory]);

  // Prefill the coach chat with a raw prompt (no email wrapper) — used by cleanup workflow buttons
  const openCoachChat = useCallback((prompt) => {
    setCoachMode("chat");
    setChatInput(prompt);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  }, [setCoachMode, setChatInput, chatInputRef]);

  // Process a Google Calendar event with AI — calls Claude directly and populates checkbox suggestions
  const processCalendarEventWithAI = useCallback(async (event) => {
    const title = event.summary || '(No title)';
    const startStr = event.start?.dateTime
      ? new Date(event.start.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : (event.start?.date || '');
    const endStr = event.end?.dateTime
      ? new Date(event.end.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
      : '';
    let recurrenceLine = null;
    if (event.recurrence?.length) {
      const rruleStr = event.recurrence.find(r => r.startsWith('RRULE:'));
      if (rruleStr) {
        const parsed = parseRRULE(rruleStr);
        const RD = ['sun','mon','tue','wed','thu','fri','sat'];
        const freqLabel = { daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' }[parsed.frequency] || parsed.frequency;
        const daysLabel  = parsed.weekDays?.length ? ` on ${parsed.weekDays.map(d => RD[d]).join(',')}` : '';
        const untilLabel = parsed.until ? ` until ${parsed.until}` : '';
        const intLabel   = parsed.interval > 1 ? ` every ${parsed.interval}` : '';
        const recurSyntax = [
          `recur:${parsed.frequency}:${parsed.interval || 1}`,
          parsed.weekDays?.length ? parsed.weekDays.map(d => RD[d]).join(',') : null,
          parsed.until || null,
        ].filter(Boolean).join(':');
        recurrenceLine = `Recurrence: ${freqLabel}${intLabel}${daysLabel}${untilLabel} [${recurSyntax}]`;
      }
    }
    const lines = [
      `Title: ${title}`,
      `Date/Time: ${startStr}${endStr ? ` → ${endStr}` : ''}`,
      recurrenceLine,
      event.location ? `Location: ${event.location}` : null,
      event.description ? `Description: ${event.description.replace(/<[^>]*>/g, '').slice(0, 500)}` : null,
    ].filter(Boolean).join('\n');

    setCoachMode("chat");
    setCalendarSuggestionsReady(false);
    setCalendarSuggestions([]);
    setMessages(prev => [...prev, { role: "user", text: `📅 Reviewing calendar event: **"${title}"**` }]);

    const reply = await callAI(lines, "calendarEvent", []);
    if (reply) {
      const suggestions = extractSuggestions(reply);
      setCalendarSuggestions(suggestions.map(text => ({ text, checked: true, bucket: 'inbox' })));
      setCalendarSuggestionsReady(true);
    }
  }, [callAI]);

  // Accept selected calendar suggestions — create tasks and clear the bar
  const acceptCalendarSuggestions = useCallback(() => {
    const selected = calendarSuggestions.filter(s => s.checked);
    if (selected.length) {
      const newTasks = selected.map(s => ({
        id: genId(), text: s.text, bucket: s.bucket || 'inbox',
        done: false, created: Date.now(), priority: [], location: [],
        dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null,
      }));
      setTasks(prev => [...newTasks, ...prev]);
      setMessages(prev => [...prev, { role: "assistant", text: `✓ Added **${selected.length} task${selected.length !== 1 ? 's' : ''}** to your GTD system.` }]);
      // Trigger AI project-grouping suggestion when multiple tasks were added together.
      if (selected.length >= 2) {
        suggestProjectGroup(newTasks.map(t => t.id), newTasks.map(t => t.text));
      }
    }
    setCalendarSuggestions([]);
    setCalendarSuggestionsReady(false);
  }, [calendarSuggestions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightweight AI call (no coach UI side-effects) to suggest a project home for a
  // batch of new tasks. Updates `pendingGroupSuggestion` state on success.
  const suggestProjectGroup = useCallback(async (newTaskIds, newTaskTitles) => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const projectLines = rootProjects.length
      ? rootProjects.map(p => `- [${p.id}] ${p.text}`).join("\n")
      : "(none)";
    const taskLines = newTaskTitles.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const prompt = `You are a GTD coach. The user just added ${newTaskTitles.length} related tasks to their inbox:\n${taskLines}\n\nExisting projects:\n${projectLines}\n\nDo these tasks belong together as a project? If yes:\n- If an existing project is a strong match, reply with exactly: →GROUP:existing|<project_id>|<project_name>\n- If no good match exists, suggest a concise project name and reply with exactly: →GROUP:new|<project name>\n- If they do NOT belong together as a project, reply with exactly: →GROUP:none\n\nReply with only one line, no other text.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 80,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const text = (data.content?.[0]?.text || "").trim();
      const match = text.match(/^→GROUP:(existing|new|none)\|?(.*?)?\|?(.*)?$/);
      if (!match) return;
      const [, type, part1, part2] = match;
      if (type === "none") return;
      if (type === "existing") {
        const projectId = part1?.trim();
        const projectName = part2?.trim() || rootProjects.find(p => p.id === projectId)?.text || projectId;
        if (projectId) setPendingGroupSuggestion({ taskIds: newTaskIds, suggestion: { type: "existing", projectId, name: projectName } });
      } else if (type === "new") {
        const name = part1?.trim();
        if (name) setPendingGroupSuggestion({ taskIds: newTaskIds, suggestion: { type: "new", name } });
      }
    } catch { /* silent — non-critical */ }
  }, [tasks]);

  // ── Mode A: Task-completeness review ────────────────────────────────────
  const reviewProject = useCallback(async (project, idx, total) => {
    setCurrentBucket("project");
    const children = getOrderedChildren(project.id, tasks);
    const subtaskLines = children.length
      ? children.map(t => `- ${t.text}${t.done ? " ✓" : ""}`).join("\n")
      : "(none yet)";
    const meta = [
      project.dueDate                        ? `Due: ${project.dueDate}`                         : null,
      (project.priority || []).length        ? `Priority: ${project.priority.join(", ")}`         : null,
      (project.location || []).length        ? `Location: ${project.location.join(", ")}`         : null,
    ].filter(Boolean).join(" | ") || "No metadata set";

    const prompt =
      `Project ${idx + 1} of ${total}: "${project.text}"\n` +
      `Metadata: ${meta}\n` +
      `Current subtasks:\n${subtaskLines}`;

    setMessages(prev => [...prev, { role: "user", text: `🔍 Reviewing **"${project.text}"** (${idx + 1} of ${total})` }]);
    setReviewReady(false);
    const reply = await callAI(prompt, "projectReview", []);
    if (reply) {
      const existingTexts = new Set(children.map(t => t.text.trim().toLowerCase()));
      const suggestions = extractSuggestions(reply)
        .filter(text => !existingTexts.has(text.trim().toLowerCase()));
      setReviewSuggestions(suggestions.map(text => ({ text, checked: true })));
      setReviewProjectIdx(idx);
      setReviewReady(true);
    }
  }, [tasks, callAI]);

  const advanceProjectReview = useCallback(() => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const project = rootProjects[reviewProjectIdx];

    // Add checked suggestions as new subtasks of the current project
    if (project) {
      const selected = reviewSuggestions.filter(s => s.checked);
      if (selected.length) {
        const newSubtasks = selected.map(s => ({
          id: genId(), text: s.text, bucket: "next", done: false,
          created: Date.now(), parentId: project.id,
          priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null,
        }));
        const newIds = newSubtasks.map(t => t.id);
        setTasks(prev => [
          ...prev.map(t =>
            t.id === project.id ? { ...t, childIds: [...(t.childIds || []), ...newIds] } : t
          ),
          ...newSubtasks,
        ]);
      }
    }

    setReviewSuggestions([]);
    setReviewReady(false);
    const nextIdx = reviewProjectIdx + 1;

    if (nextIdx >= rootProjects.length) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `🎉 **All ${rootProjects.length} project${rootProjects.length !== 1 ? "s" : ""} reviewed!** Your project list is up to date. Switch to Next Actions to see what's ready to work on.`,
      }]);
      setCoachMode("chat");
    } else {
      reviewProject(rootProjects[nextIdx], nextIdx, rootProjects.length);
    }
  }, [reviewProjectIdx, reviewSuggestions, tasks, reviewProject]);

  // Advances to the next project without adding any suggested tasks.
  const skipProjectReview = useCallback(() => {
    setReviewSuggestions([]);
    setReviewReady(false);
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const nextIdx = reviewProjectIdx + 1;

    if (nextIdx >= rootProjects.length) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `🎉 **All ${rootProjects.length} project${rootProjects.length !== 1 ? "s" : ""} reviewed!** Your project list is up to date. Switch to Next Actions to see what's ready to work on.`,
      }]);
      setCoachMode("chat");
    } else {
      reviewProject(rootProjects[nextIdx], nextIdx, rootProjects.length);
    }
  }, [reviewProjectIdx, tasks, reviewProject]);

  // ── Mode B: Metadata-quality review ─────────────────────────────────────
  const reviewProjectMetadata = useCallback(async (project, idx, total) => {
    setCurrentBucket("project");
    const children = getOrderedChildren(project.id, tasks);
    const activeTasks = children.filter(t => !t.done);
    const taskLines = activeTasks.length
      ? activeTasks.map(t => {
          const meta = [
            `effort:${t.effort || "none"}`,
            `due:${t.dueDate || "none"}`,
            `defer:${t.deferUntil || "none"}`,
          ].join(", ");
          return `- [${t.id}] ${t.text} (${meta})`;
        }).join("\n")
      : "(no active subtasks)";

    const prompt =
      `Project ${idx + 1} of ${total}: "${project.text}"\n` +
      `Today: ${todayStr()}\n` +
      `Active subtasks:\n${taskLines}`;

    setMessages(prev => [...prev, { role: "user", text: `🏷 Reviewing metadata for **"${project.text}"** (${idx + 1} of ${total})` }]);
    setReviewReady(false);
    const reply = await callAI(prompt, "projectMetadata", []);
    if (reply) {
      const parsed = extractMetadata(reply);
      const suggestions = parsed.map(({ taskId, fields }) => {
        const task = tasks.find(t => t.id === taskId);
        return {
          taskId,
          taskText: task ? task.text : taskId,
          fields,                  // original AI suggestion
          overrides: { ...fields }, // user-editable copy shown in bar
          accepted: true,
        };
      });
      setMetadataSuggestions(suggestions);
      setReviewProjectIdx(idx);
      setReviewReady(true);
    }
  }, [tasks, callAI]);

  const updateTask = useCallback((id, changes) => {
    setTasks(prev => {
      // Auto-set originalDueDate on first dueDate assignment
      const existing = prev.find(t => t.id === id);
      const ch = (existing && "dueDate" in changes && changes.dueDate && !existing.originalDueDate)
        ? { ...changes, originalDueDate: changes.dueDate }
        : changes;
      // Fast path: no deferUntil change — simple single-task update
      if (!("deferUntil" in ch)) {
        return prev.map(t => t.id === id ? { ...t, ...ch } : t);
      }
      // Collect all descendant IDs recursively via childIds
      const getDescendants = (taskId) => {
        const task = prev.find(t => t.id === taskId);
        if (!task || !task.childIds?.length) return [];
        return task.childIds.flatMap(cid => [cid, ...getDescendants(cid)]);
      };
      const target = prev.find(t => t.id === id);
      if (!target) return prev.map(t => t.id === id ? { ...t, ...ch } : t);
      const oldDefer = target.deferUntil;
      const newDefer = ch.deferUntil ?? null;
      const descendants = new Set(getDescendants(id));
      return prev.map(t => {
        if (t.id === id) return { ...t, ...ch };
        if (!descendants.has(t.id)) return t;
        if (newDefer !== null) {
          // Setting: cascade new date to all descendants
          return { ...t, deferUntil: newDefer };
        } else {
          // Clearing: only clear descendants that shared the old value
          return t.deferUntil === oldDefer ? { ...t, deferUntil: null } : t;
        }
      });
    });
  }, []);

  const spawnNextOccurrence = useCallback((task) => {
    if (!task.recurrence) return;
    const newTask = buildNextOccurrence(task);
    if (newTask) setTasks(prev => [newTask, ...prev]);
  }, []);

  const skipRecurrence = useCallback((id) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task || !task.recurrence) return prev;
      const newTask = buildNextOccurrence(task);
      return newTask ? [newTask, ...prev.filter(t => t.id !== id)] : prev.filter(t => t.id !== id);
    });
  }, []);

  const advanceMetadataReview = useCallback(() => {
    // Apply all accepted metadata suggestions
    metadataSuggestions
      .filter(s => s.accepted)
      .forEach(s => updateTask(s.taskId, s.overrides));

    setMetadataSuggestions([]);
    setReviewReady(false);
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const nextIdx = reviewProjectIdx + 1;

    if (nextIdx >= rootProjects.length) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `🎉 **All ${rootProjects.length} project${rootProjects.length !== 1 ? "s" : ""} reviewed!** Metadata has been updated across your projects.`,
      }]);
      setCoachMode("chat");
    } else {
      reviewProjectMetadata(rootProjects[nextIdx], nextIdx, rootProjects.length);
    }
  }, [reviewProjectIdx, metadataSuggestions, tasks, reviewProjectMetadata, updateTask]);

  // Advances to the next project without applying any metadata suggestions.
  const skipMetadataReview = useCallback(() => {
    setMetadataSuggestions([]);
    setReviewReady(false);
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    const nextIdx = reviewProjectIdx + 1;

    if (nextIdx >= rootProjects.length) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `🎉 **All ${rootProjects.length} project${rootProjects.length !== 1 ? "s" : ""} reviewed!** Metadata has been updated across your projects.`,
      }]);
      setCoachMode("chat");
    } else {
      reviewProjectMetadata(rootProjects[nextIdx], nextIdx, rootProjects.length);
    }
  }, [reviewProjectIdx, tasks, reviewProjectMetadata]);

  // ── Entry point + mode selection ────────────────────────────────────────
  const startProjectReview = useCallback(() => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    if (!rootProjects.length) {
      switchCoachMode("chat", "You have no active projects to review. Add some projects first, then come back!");
      return;
    }
    setCoachMode("projectReview");
    setChatHistory([]);
    setPendingAction(null);
    setReviewProjectIdx(0);
    setReviewSuggestions([]);
    setMetadataSuggestions([]);
    setReviewReady(false);
    setReviewMode(null);
    setMessages([{
      role: "assistant",
      text: `Let's review your **${rootProjects.length} active project${rootProjects.length !== 1 ? "s" : ""}**. What should we focus on?`,
    }]);
    // ReviewModeBar renders now; actual review starts after mode selection
  }, [tasks, switchCoachMode]);

  const selectReviewMode = useCallback((mode) => {
    const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
    setReviewMode(mode);
    if (mode === "tasks") {
      reviewProject(rootProjects[0], 0, rootProjects.length);
    } else {
      reviewProjectMetadata(rootProjects[0], 0, rootProjects.length);
    }
  }, [tasks, reviewProject, reviewProjectMetadata]);


  const {
    addLocation, renameLocation, removeLocation,
    addEffort, renameEffort, removeEffort,
    addCategory, renameCategory, removeCategory,
    setCalibrationOverride, clearCalibrationOverride,
    handleExport, handleImport,
  } = useSettings({
    tasks, setTasks,
    locations, setLocations,
    efforts, setEfforts,
    setCalibrationOverrides,
    categories, setCategories,
  });

  // "deferred" is a virtual view — tasks keep their original bucket, filtered by deferUntil > today.
  const bucketTasks = currentBucket === "deferred"
    ? tasks.filter(t => isDeferred(t) && !t.done).sort((a, b) => (a.deferUntil > b.deferUntil ? 1 : -1))
    : tasks.filter(t => t.bucket === currentBucket);
  const counts = Object.fromEntries(Object.keys(BUCKETS).map(k =>
    k === "deferred"
      ? [k, tasks.filter(t => isDeferred(t) && !t.done).length]
      : [k, tasks.filter(t => t.bucket === k).length]
  ));

  // Fuzzy dupe check: warn if what the user is typing resembles a deferred task.
  const deferredDupeWarning = (() => {
    const text = addText.toLowerCase().trim();
    if (text.length < 4) return null;
    const words = text.split(/\s+/).filter(w => w.length > 3);
    if (!words.length) return null;
    return tasks.find(t => isDeferred(t) && !t.done && words.some(w => t.text.toLowerCase().includes(w))) || null;
  })();

  const s = {
    app:         { display: "flex", height: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif", fontSize: 14, overflow: "hidden" },
    main:        { flex: 1, display: "flex", flexDirection: "row", overflow: "hidden" },
    mainLeft:    { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    taskRow:     { flex: 1, display: "flex", overflow: "hidden" },
    taskPanel:   { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    detailPanel: { width: detailWidth, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden" },
  };

  // ── Context values ─────────────────────────────────────────────────────
  const taskActionsValue = {
    onComplete:           completeTask,
    onDelete:             deleteTask,
    onMove:               moveTask,
    onAskAI:              askAIAboutTask,
    onUpdateTask:         updateTask,
    onAssignToProject:    assignToProject,
    onSkipRecurrence:     skipRecurrence,
    onNavigate:           setCurrentBucket,
    onOpenDetail:         setSelectedTaskId,
    onToggleCollapse:     toggleCollapse,
    onToggleCollapseLevel: toggleCollapseLevel,
  };
  const taskRowValue = {
    currentBucket,
    allTasks: tasks,
    moveMenu,
    setMoveMenu,
    pendingAction,
    collapsedNodes,
    selectedTaskId,
    locations,
    efforts,
    tagDisplay,
    categories,
    projectCategoryFilter,
    setProjectCategoryFilter,
    showCompletedInProjects,
  };

  return (
    <AuthGate
      authLoading={authLoading}
      authUser={authUser}
      authSent={authSent}
      authEmail={authEmail}
      setAuthEmail={setAuthEmail}
      sendMagicLink={sendMagicLink}
    >
      <div style={s.app} onClick={() => setMoveMenu(null)}>
        <AppSidebar
          sidebarWidth={sidebarWidth}
          supabaseReady={supabaseReady}
          syncStatus={syncStatus}
          counts={counts}
          currentBucket={currentBucket}
          currentView={currentView}
          gmailUnreadCount={gmailUnreadCount}
          calendarEnabled={calendarEnabled}
          onSelectBucket={key => () => { setCurrentBucket(key); setCurrentView("gtd"); setShowSettings(false); }}
          onSelectFocus={() => { setCurrentView("focus"); setShowSettings(false); setSelectedTaskId(null); }}
          focusCount={focusCount}
          onSelectEmail={() => { setCurrentView("email"); setShowSettings(false); setSelectedTaskId(null); }}
          onSelectCalendar={() => { setCurrentView("calendar"); setShowSettings(false); setSelectedTaskId(null); }}
          onToggleSettings={() => { setShowSettings(v => !v); setShowUsage(false); }}
          onToggleUsage={() => { setShowUsage(v => !v); setShowSettings(false); }}
          onDailyReview={startDailyReview}
          dailyReviewPhase={dailyReviewPhase}
          onWeeklyReview={startWeeklyReview}
          onBrainDump={startBrainDump}
          onOpenSearch={() => setSearchOpen(true)}
        />
        {searchOpen && (
          <SearchModal
            tasks={tasks}
            onSelect={handleSearchSelect}
            onClose={() => setSearchOpen(false)}
          />
        )}
        <ResizeHandle onMouseDown={sidebarDragDown} direction="h" />

        <div style={s.main}>
          <div style={s.mainLeft}>
            <div style={s.taskRow}>
              <ErrorBoundary label="Task Panel">
                <TaskActionsContext.Provider value={taskActionsValue}>
                  <TaskRowContext.Provider value={taskRowValue}>
                    <div style={s.taskPanel}>
                      {showSettings ? (
                        <SettingsPanel
                          locations={locations}
                          tasks={tasks}
                          onAdd={addLocation}
                          onRename={renameLocation}
                          onRemove={removeLocation}
                          efforts={efforts}
                          onAddEffort={addEffort}
                          onRenameEffort={renameEffort}
                          onRemoveEffort={removeEffort}
                          calibrationOverrides={calibrationOverrides}
                          onSetCalibrationOverride={setCalibrationOverride}
                          onClearCalibrationOverride={clearCalibrationOverride}
                          tagDisplay={tagDisplay}
                          onSetTagDisplay={setTagDisplay}
                          categories={categories}
                          onAddCategory={addCategory}
                          onRenameCategory={renameCategory}
                          onRemoveCategory={removeCategory}
                          onExport={handleExport}
                          onImport={handleImport}
                          onClose={() => setShowSettings(false)}
                          googleToken={googleToken}
                          gmailScope={googleScope}
                          gmailError={gmailError}
                          calendarEnabled={calendarEnabled}
                          driveEnabled={driveEnabled}
                          docsEnabled={docsEnabled}
                          sheetsEnabled={sheetsEnabled}
                          slidesEnabled={slidesEnabled}
                          scopePrefs={scopePrefs}
                          onSetScopePref={setScopePref}
                          onReauthorizeGoogle={reauthorizeGoogle}
                          onDisconnectCalendar={disconnectCalendar}
                          onDisconnectAll={disconnectAll}
                          recurringReviewDays={recurringReviewDays}
                          onSetRecurringReviewDays={setRecurringReviewDays}
                        />
                      ) : showUsage ? (
                        <UsagePanel
                          stats={aiUsageStats}
                          lastInputLog={lastInputLog}
                          onClear={() => setAiUsageStats(createEmptyUsageStats())}
                          onClose={() => setShowUsage(false)}
                        />
                      ) : currentView === "email" ? (
                        <EmailManagementView
                          googleToken={googleToken}
                          googleScope={googleScope}
                          gmailQueue={gmailQueue}
                          setGmailQueue={setGmailQueue}
                          emailTab={emailTab}
                          setEmailTab={setEmailTab}
                          processEmailWithAI={processEmailWithAI}
                          openCoachChat={openCoachChat}
                          authUser={authUser}
                        />
                      ) : currentView === "calendar" ? (
                        <CalendarManagementView
                          googleToken={googleToken}
                          calendarEnabled={calendarEnabled}
                          calendarTab={calendarTab}
                          setCalendarTab={setCalendarTab}
                          tasks={tasks}
                          setTasks={setTasks}
                          calendarEvents={calendarEvents}
                          setCalendarEvents={setCalendarEvents}
                          processCalendarEventWithAI={processCalendarEventWithAI}
                          onConnectCalendar={connectCalendar}
                          onOpenDetail={setSelectedTaskId}
                          selectedTaskId={selectedTaskId}
                          skippedCalendarIds={skippedCalendarIds}
                          setSkippedCalendarIds={setSkippedCalendarIds}
                          seenCalendarEventIds={seenCalendarEventIds}
                          setSeenCalendarEventIds={setSeenCalendarEventIds}
                          recurringAcknowledgedMap={recurringAcknowledgedMap}
                          recurringReviewDays={recurringReviewDays}
                          setRecurringAcknowledgedMap={setRecurringAcknowledgedMap}
                        />
                      ) : currentView === "focus" ? (
                        <TodaysFocusView
                          tasks={tasks}
                          calendarEvents={calendarEvents}
                          calendarEnabled={calendarEnabled}
                          onDailyReview={startDailyReview}
                          onOpenDetail={setSelectedTaskId}
                        />
                      ) : (
                        <TaskBucketView
                          currentBucket={currentBucket}
                          tasks={tasks}
                          bucketTasks={bucketTasks}
                          addText={addText}
                          setAddText={setAddText}
                          addTask={addTask}
                          addAndProcess={addAndProcess}
                          addProjectTask={addProjectTask}
                          projectParentId={projectParentId}
                          setProjectParentId={setProjectParentId}
                          nextGroupBy={nextGroupBy}
                          setNextGroupBy={setNextGroupBy}
                          setCollapsedNodes={setCollapsedNodes}
                          setDropTarget={setDropTarget}
                          inboxSelectedIds={inboxSelectedIds}
                          setInboxSelectedIds={setInboxSelectedIds}
                          dragId={dragId}
                          dropTarget={dropTarget}
                          onDragStart={handleProjectDragStart}
                          onDragOver={handleProjectDragOver}
                          onDragEnd={handleProjectDragEnd}
                          onDrop={handleProjectDrop}
                          deferredDupeWarning={deferredDupeWarning}
                          onViewDeferred={() => setCurrentBucket("deferred")}
                          loading={loading}
                          onStartProjectReview={startProjectReview}
                          onBulkAssign={bulkAssignToProject}
                          categories={categories}
                          projectCategoryFilter={projectCategoryFilter}
                          setProjectCategoryFilter={setProjectCategoryFilter}
                          showCompletedInProjects={showCompletedInProjects}
                          setShowCompletedInProjects={setShowCompletedInProjects}
                        />
                      )}
                    </div>
                  </TaskRowContext.Provider>
                </TaskActionsContext.Provider>
              </ErrorBoundary>
            </div>
            <ResizeHandle onMouseDown={coachDragDown} direction="v" />
            <ErrorBoundary label="AI Coach">
              <CoachPanel
                coachHeight={coachHeight}
                coachMode={coachMode}
                messages={messages}
                loading={loading}
                pendingAction={pendingAction}
                reviewMode={reviewMode}
                reviewReady={reviewReady}
                reviewSuggestions={reviewSuggestions}
                metadataSuggestions={metadataSuggestions}
                calendarSuggestionsReady={calendarSuggestionsReady}
                calendarSuggestions={calendarSuggestions}
                pendingGroupSuggestion={pendingGroupSuggestion}
                reviewProjectIdx={reviewProjectIdx}
                totalReviewProjects={tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done).length}
                provider={provider}
                setProvider={setProvider}
                localModel={localModel}
                setLocalModel={setLocalModel}
                availableModels={availableModels}
                fetchModels={fetchModels}
                chatInput={chatInput}
                setChatInput={setChatInput}
                chatInputHeight={chatInputHeight}
                chatInputDragDown={chatInputDragDown}
                chatEndRef={chatEndRef}
                chatInputRef={chatInputRef}
                sessionUsage={sessionUsage}
                onSendChat={sendChat}
                onConfirmMove={handleConfirmMove}
                onDismissPendingAction={handleSkipPendingAction}
                onDeleteInboxItem={handleDeleteInboxItem}
                onRecurringStillFine={handleRecurringStillFine}
                onRecurringNeedsWork={handleRecurringNeedsWork}
                onSelectReviewMode={selectReviewMode}
                onToggleReviewSuggestion={idx => setReviewSuggestions(prev =>
                  prev.map((sg, i) => i === idx ? { ...sg, checked: !sg.checked } : sg)
                )}
                onAdvanceProjectReview={advanceProjectReview}
                onSkipProjectReview={skipProjectReview}
                onToggleMetadataSuggestion={idx => setMetadataSuggestions(prev =>
                  prev.map((sg, i) => i === idx ? { ...sg, accepted: !sg.accepted } : sg)
                )}
                onChangeMetadataOverride={(idx, field, value) => setMetadataSuggestions(prev =>
                  prev.map((sg, i) => i === idx ? { ...sg, overrides: { ...sg.overrides, [field]: value } } : sg)
                )}
                onAdvanceMetadataReview={advanceMetadataReview}
                onSkipMetadataReview={skipMetadataReview}
                onToggleCalendarSuggestion={idx => setCalendarSuggestions(prev =>
                  prev.map((sg, i) => i === idx ? { ...sg, checked: !sg.checked } : sg)
                )}
                onChangeCalendarSuggestionBucket={(idx, bucket) => setCalendarSuggestions(prev =>
                  prev.map((sg, i) => i === idx ? { ...sg, bucket } : sg)
                )}
                onAcceptCalendarSuggestions={acceptCalendarSuggestions}
                onDismissCalendarSuggestions={() => { setCalendarSuggestions([]); setCalendarSuggestionsReady(false); }}
                onAcceptGroupSuggestion={(projectId, newProjectName) => {
                  bulkAssignToProject(new Set(pendingGroupSuggestion.taskIds), projectId, newProjectName);
                  setPendingGroupSuggestion(null);
                }}
                onDismissGroupSuggestion={() => setPendingGroupSuggestion(null)}
                tasks={tasks}
                onStartProcessInbox={startProcessInbox}
                onStartWeeklyReview={startWeeklyReview}
                onStartBrainDump={startBrainDump}
                onStartProjectReview={startProjectReview}
                onSwitchToChat={() => switchCoachMode("chat", "I can see your task list. Ask me anything — clarify a task, plan your day, or check in on your system.")}
              />
            </ErrorBoundary>
          </div>

          <ErrorBoundary label="Task Detail">
            {selectedTaskId && currentView !== "email" && (() => {
              const selTask = tasks.find(t => t.id === selectedTaskId);
              return selTask ? (
                <>
                  <ResizeHandle onMouseDown={detailDragDown} direction="h" />
                  <TaskDetailPanel
                    task={selTask}
                    allTasks={tasks}
                    currentBucket={currentBucket}
                    locations={locations}
                    efforts={efforts}
                    categories={categories}
                    driveEnabled={driveEnabled}
                    googleAccessToken={googleToken}
                    onUpdate={updateTask}
                    onComplete={(id) => { completeTask(id); setSelectedTaskId(null); }}
                    onDelete={(id) => { setTasks(prev => prev.filter(t => t.id !== id)); setSelectedTaskId(null); }}
                    onReassignProject={reassignProject}
                    onSkipRecurrence={(id) => { skipRecurrence(id); setSelectedTaskId(null); }}
                    onClose={() => setSelectedTaskId(null)}
                    style={s.detailPanel}
                  />
                </>
              ) : null;
            })()}
          </ErrorBoundary>
        </div>

        {pendingRollup && (
          <NoteRollupPrompt
            taskText={pendingRollup.taskText}
            notes={pendingRollup.notes}
            parentText={pendingRollup.parentText}
            onConfirm={handleRollupConfirm}
            onSkip={handleRollupSkip}
          />
        )}
        {pendingDeferCheck && (
          <DeferCheckPrompt
            taskText={pendingDeferCheck.taskText}
            deferredChildren={pendingDeferCheck.deferredChildren}
            onSkip={handleDeferCheckSkip}
            onReview={handleDeferCheckReview}
          />
        )}
        {actualEffortPrompt && (
          <ActualEffortPrompt
            taskText={actualEffortPrompt.taskText}
            estimatedEffort={actualEffortPrompt.estimatedEffort}
            efforts={efforts}
            onSave={handleActualEffortSave}
            onSkip={handleActualEffortSkip}
          />
        )}
      </div>
    </AuthGate>
  );
}
