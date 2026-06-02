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
import { AnalyticsArea } from "./features/tasks/AnalyticsArea.jsx";
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

import { parseRRULE, calEventStart, isAllDayEvent, genId, doCalendarCreateEvent } from "./features/calendar/calendarApi.js";
import { driveUploadFile } from "./api/driveApi.js";
import { doGmailSend, doGmailLabel, doGmailGetMessageBody } from "./features/email/gmailTools.js";
import { sheetsAppendRows } from './api/sheetsApi.js';
import { extractReceiptFields } from './features/email/receiptUtils.js';
import { todayStr, isDeferred, buildNextOccurrence, extractSuggestions, extractMetadata, getOrderedChildren, useResizer, effortToMinutes } from "./features/tasks/taskUtils.jsx";
import { useDragDrop } from "./features/tasks/useDragDrop.js";
import { useSupabaseSync } from "./hooks/useSupabaseSync.js";
import { useCallAI } from "./features/coach/useCallAI.js";
import { useInboxProcessing } from "./features/tasks/useInboxProcessing.js";
import { useTaskCrud } from "./features/tasks/useTaskCrud.js";
import { ContactsPanel } from "./features/contacts/ContactsPanel.jsx";
import { useContacts } from "./features/contacts/useContacts.js";
import { HealthPanel } from "./features/health/HealthPanel.jsx";
import { useHealth } from "./features/health/useHealth.js";
import { useSettings } from "./features/settings/useSettings.js";




const sleep = ms => new Promise(r => setTimeout(r, ms));















export default function GTDManager() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_tasks") || "[]"); } catch { return []; }
  });
  const { locations, setLocations, efforts, setEfforts, calibrationOverrides, setCalibrationOverrides, tagDisplay, setTagDisplay, categories, setCategories, calendarReminderMinutes, setCalendarReminderMinutes, nextActionsViewMode, setNextActionsViewMode, reviewNodeTypes, setReviewNodeTypes, focusExpandedDefaults, setFocusExpandedDefaults, shortcutModifier, setShortcutModifier, driveBaseFolderId, setDriveBaseFolderId, driveConversationExportFolderId, setDriveConversationExportFolderId, driveSlideDeckFolderId, setDriveSlideDeckFolderId, driveSpreadsheetFolderId, setDriveSpreadsheetFolderId, driveDocumentFolderId, setDriveDocumentFolderId, driveBaseFolderPath, setDriveBaseFolderPath, driveConversationExportFolderPath, setDriveConversationExportFolderPath, driveSlideDeckFolderPath, setDriveSlideDeckFolderPath, driveSpreadsheetFolderPath, setDriveSpreadsheetFolderPath, driveDocumentFolderPath, setDriveDocumentFolderPath, driveBackupFolderId, setDriveBackupFolderId, driveBackupFolderPath, setDriveBackupFolderPath, exportSettings, setExportSettings, userCity, setUserCity, userHomeAddress, setUserHomeAddress, userWorkAddress, setUserWorkAddress, coachName, setCoachName, userName, setUserName, exportTemplates, setExportTemplates, receiptSheetId, setReceiptSheetId, contactRelationshipTags, setContactRelationshipTags, contactLikesCategories, setContactLikesCategories, contactEmailLinkingMode, setContactEmailLinkingMode, taskCompletionToContactNotes, setTaskCompletionToContactNotes} = useAppSettings();
  const { messages, setMessages, chatHistory, setChatHistory, coachMode, setCoachMode, chatInput, setChatInput, loading, setLoading, moveMenu, setMoveMenu, pendingAction, setPendingAction, chatEndRef, chatInputRef, provider, setProvider, localModel, setLocalModel, availableModels, setAvailableModels } = useAICoachState(coachName);
  const { aiUsageStats, setAiUsageStats, sessionUsage, recordUsage } = useAIUsageTracking();
  const { currentView, setCurrentView, emailTab, setEmailTab, gmailQueue, setGmailQueue, gmailUnreadCount, setGmailUnreadCount } = useGmailState();
  const [inboxSenderEmails, setInboxSenderEmails] = useState(new Set()); // FR#176
  const { calendarEvents, setCalendarEvents, calendarTab, setCalendarTab, skippedCalendarIds, setSkippedCalendarIds, seenCalendarEventIds, setSeenCalendarEventIds, recurringAcknowledgedMap, setRecurringAcknowledgedMap, recurringReviewDays, setRecurringReviewDays, calendarSuggestions, setCalendarSuggestions, calendarSuggestionsReady, setCalendarSuggestionsReady } = useCalendarState();
  const { googleToken, googleScope, calendarEnabled, driveEnabled, docsEnabled,
          sheetsEnabled, slidesEnabled, contactsEnabled, gmailError, scopePrefs,
          setScopePref, reauthorizeGoogle, connectCalendar, disconnectCalendar,
          disconnectContacts, disconnectAll, refreshGoogleToken } = useGoogleAuth({ setCalendarEvents });
  const { currentBucket, setCurrentBucket, addText, setAddText, showSettings, setShowSettings, showUsage, setShowUsage, nextGroupBy, setNextGroupBy, projectParentId, setProjectParentId, collapsedNodes, setCollapsedNodes, toggleCollapse, toggleCollapseLevel, selectedTaskId, setSelectedTaskId, actualEffortPrompt, setActualEffortPrompt, pendingRollup, setPendingRollup, pendingDeferCheck, setPendingDeferCheck, inboxSelectedIds, setInboxSelectedIds, pendingGroupSuggestion, setPendingGroupSuggestion, showCompletedInProjects, setShowCompletedInProjects, showWaitingInProjects, setShowWaitingInProjects, showSomeDayInProjects, setShowSomeDayInProjects, focusedTaskId, setFocusedTaskId, pendingDeleteConfirm, setPendingDeleteConfirm } = useTaskUIState();
  const { reviewProjectIdx, setReviewProjectIdx, reviewSuggestions, setReviewSuggestions, reviewReady, setReviewReady, reviewMode, setReviewMode, metadataSuggestions, setMetadataSuggestions } = useProjectReview();
  const [projectCategoryFilter, setProjectCategoryFilter] = useState(null);
  const [uncategorizedProjectId, setUncategorizedProjectId] = useState(null);
  const [pendingEmailContext, setPendingEmailContext] = useState(null); // { id, subject } — set while processing an email
  const preEmailTaskIdsRef = useRef(null); // snapshot of task IDs at email processing start
  const [searchOpen, setSearchOpen] = useState(false);
  const [rawApiThread, setRawApiThread] = useState([]);
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
  // Stable ref so useInboxProcessing can call suggestProjectGroup without a TDZ forward-reference
  const suggestProjectGroupRef = useRef(null);
  // Stable ref so useInboxProcessing can re-link contact gifts/promises after task replacement (Issue#39)
  const relinkTaskContactsRef = useRef(null);

  const { syncStatus, supabaseReady, settingsReady } = useSupabaseSync({
    authUser, tasks, setTasks,
    locations, efforts, calibrationOverrides, categories,
    skippedCalendarIds, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays,
    uncategorizedProjectId, setUncategorizedProjectId,
    reviewNodeTypes, setReviewNodeTypes,
    setLocations, setEfforts, setCalibrationOverrides, setCategories,
    setSkippedCalendarIds, setSeenCalendarEventIds, setRecurringAcknowledgedMap, setRecurringReviewDays,
    setGmailQueue,
    exportTemplates, setExportTemplates,
    contactRelationshipTags, setContactRelationshipTags,
    contactLikesCategories, setContactLikesCategories,
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
    if (!googleToken) { setGmailUnreadCount(null); setInboxSenderEmails(new Set()); return; }
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

  // Eagerly fetch local models on mount so Ctrl+Alt+Y can cycle immediately
  useEffect(() => { fetchModels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Stable ref updated every render so the shortcut listener below never goes stale
  const shortcutActionsRef = useRef({});
  const pendingModelCycleRef = useRef(false);
  useEffect(() => {
    const nav = (bucket) => () => { setCurrentBucket(bucket); setCurrentView("gtd"); setShowSettings(false); setSelectedTaskId(null); };
    shortcutActionsRef.current = {
      _modifier: shortcutModifier,
      // Views
      I: nav("inbox"),
      N: nav("next"),
      P: nav("project"),
      W: nav("waiting"),
      S: nav("someday"),
      D: nav("deferred"),
      A: nav("done"),
      F: () => { setCurrentView("focus"); setShowSettings(false); setSelectedTaskId(null); },
      E: () => { setCurrentView("email"); setShowSettings(false); setSelectedTaskId(null); },
      L: () => { setCurrentView("calendar"); setShowSettings(false); setSelectedTaskId(null); },
      K: () => setSearchOpen(true),
      O: () => setShowSettings(v => !v),
      U: () => setShowUsage(v => !v),
      // Modes
      Q: () => startDailyReview(),
      V: () => startDailyReview(),
      R: () => startWeeklyReview(),
      X: () => startProjectReview(),
      Z: () => startProcessInbox(),
      B: () => startBrainDump(),
      Y: () => {
        // Cycle: claude → local[0] → local[1] → ... → claude
        const allModels = ['claude', ...(availableModels.length ? availableModels : [])];
        const currentKey = provider === 'claude' ? 'claude' : localModel;
        const currentIdx = allModels.indexOf(currentKey);
        const nextIdx = (currentIdx + 1) % allModels.length;
        const next = allModels[nextIdx];
        if (next === 'claude') {
          setProvider('claude');
        } else {
          setProvider('local');
          setLocalModel(next);
        }
      },
    };
  });

  // Global Ctrl+Shift shortcuts — views and coach modes
  useEffect(() => {
    const handler = (e) => {
      const mod = shortcutActionsRef.current._modifier || 'ctrl+alt';
      const match =
        mod === 'ctrl+alt'  ? (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey) :
        mod === 'alt+shift' ? (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) :
        mod === 'ctrl+shift'? (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) : false;
      if (!match) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const action = shortcutActionsRef.current[e.key.toUpperCase()];
      if (action) { e.preventDefault(); action(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Complete a pending model cycle once availableModels populates
  useEffect(() => {
    if (!pendingModelCycleRef.current || !availableModels.length) return;
    pendingModelCycleRef.current = false;
    setProvider('local');
    setLocalModel(availableModels[0]);
  }, [availableModels]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-link email to any tasks created during an active email processing session
  useEffect(() => {
    if (!pendingEmailContext || !preEmailTaskIdsRef.current) return;
    const newTasks = tasks.filter(t =>
      !preEmailTaskIdsRef.current.has(t.id) &&
      !(t.driveAttachments || []).some(a => a.id === pendingEmailContext.id)
    );
    if (!newTasks.length) return;
    // Immediately extend the snapshot so re-firing the effect skips these tasks
    newTasks.forEach(t => preEmailTaskIdsRef.current.add(t.id));
    const emailId = pendingEmailContext.id;
    const emailAtt = {
      id: emailId,
      name: pendingEmailContext.subject || 'Email',
      mimeType: 'message/rfc822',
      url: `https://mail.google.com/mail/#inbox/${emailId}`,
    };
    const newIds = new Set(newTasks.map(t => t.id));
    setTasks(prev => prev.map(t => {
      if (!newIds.has(t.id)) return t;
      const existing = t.driveAttachments || [];
      // Dedup inside the functional update — guards against concurrent calls
      if (existing.some(a => a.id === emailId)) return t;
      return { ...t, driveAttachments: [...existing, emailAtt] };
    }));
  }, [tasks, pendingEmailContext]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-surface: on mount, move any uncategorized deferred tasks whose wake date has passed into Inbox.
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
    const bucketNames = { inbox: "Inbox", next: "Next Actions", project: "Projects", waiting: "Waiting For", someday: "Someday/Maybe", done: "Archive" };
    const sections = Object.entries(bucketNames).filter(([k]) => !allowedBuckets || allowedBuckets.includes(k)).map(([k, label]) => {
      const items = k === 'next'
        ? tasks.filter(t => t.isNextAction && !t.isSomeday && !t.isWaitingFor && !t.done)
        : k === 'someday'
        ? tasks.filter(t => t.isSomeday && !t.done)
        : k === 'waiting'
        ? tasks.filter(t => t.isWaitingFor && !t.done)
        : tasks.filter(t => t.bucket === k && !t.done);
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
      // FR#32: build map of next/waiting children per project parent
      const nextChildrenMap = new Map();
      if (k === 'project') {
        tasks.filter(t => t.isNextAction && t.parentId && !t.done)
          .forEach(t => {
            if (!nextChildrenMap.has(t.parentId)) nextChildrenMap.set(t.parentId, []);
            nextChildrenMap.get(t.parentId).push(t);
          });
      }
      const buildLine = (t, overrideDepth) => {
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
        if (t.nodeType)         meta.push(`type:${t.nodeType}`);
        if (t.recurrence) {
          const r = t.recurrence;
          const days = r.weekDays?.length
            ? `:${r.weekDays.map(d => ["sun","mon","tue","wed","thu","fri","sat"][d]).join(",")}`
            : "";
          const until = r.until ? `:${r.until}` : "";
          meta.push(`recur:${r.frequency}:${r.interval || 1}${days}${until}`);
        }
        const depth = overrideDepth !== undefined ? overrideDepth : (depthMap.has(t.id) ? depthMap.get(t.id) : 0);
        const indent = '  '.repeat(depth);
        const idTag = `[id:${t.id}] `;
        const bucketTag = overrideDepth !== undefined ? ` [${t.bucket}]` : '';
        return meta.length ? `${indent}- ${idTag}${t.text}${bucketTag} [${meta.join("] [")}]` : `${indent}- ${idTag}${t.text}${bucketTag}`;
      };
      const lines = orderedItems.flatMap(t => {
        const line = buildLine(t);
        if (k !== 'project') return [line];
        const depth = depthMap.has(t.id) ? depthMap.get(t.id) : 0;
        const children = nextChildrenMap.get(t.id) || [];
        const childLines = children.map(c => buildLine(c, depth + 1));
        return [line, ...childLines];
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

  const contactActionsRef = useRef({});
  const { callAI, sendChat, sendChatWithText, fetchModels, lastInputLog, setEmailContext,
} = useCallAI({
    tasks, efforts, calibrationOverrides,
    provider, localModel,
    googleToken, googleScope, calendarEnabled,
    authUser,
    docsEnabled, sheetsEnabled, slidesEnabled,
    contactsEnabled,
    coachMode, chatInput, chatHistory, loading,
    getTaskContext, recordUsage,
    setTasks, setCalendarEvents, setGmailQueue,
    setMessages, setChatHistory, setChatInput,
    setLoading, setAvailableModels, setPendingAction,
    setRawApiThread,
    calendarReminderMinutes,
    uncategorizedProjectId,
    exportFormat: exportSettings.format,
    userCity,
    userHomeAddress,
    userWorkAddress,
    coachName,
    userName,
    driveEnabled,
    driveDocumentFolderId,
    driveSpreadsheetFolderId,
    driveSlideDeckFolderId,
    driveBaseFolderId,
    receiptSheetId,
    healthItems,
    onFocusSet: () => setCurrentView('focus'),
    contactActionsRef,
    refreshGoogleToken,
  });

  const switchCoachMode = useCallback((mode, introMsg) => {
    setEmailContext(null);
    setPendingEmailContext(null);
    preEmailTaskIdsRef.current = null;
    setCoachMode(mode);
    setChatHistory([]);
    setRawApiThread([]);
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
    tasks, pendingAction, efforts,
    uncategorizedProjectId,
    singleTaskMode, processingTaskId, skippedInSessionIds,
    setTasks, setCurrentBucket,
    setMessages, setChatHistory,
    setPendingAction,
    callAI, switchCoachMode,
    onSessionTasksCreated: (ids, titles) => suggestProjectGroupRef.current?.(ids, titles),
    onTaskReplaced: (oldId, newId) => relinkTaskContactsRef.current?.(oldId, newId),
  });

  // Intercepts gmail_send before delegating to the inbox-processing confirm handler.
  const handleConfirmMoveWithSend = useCallback(async () => {
    if (pendingAction?.type === 'gmail_send') {
      const { to, subject, body, threadId } = pendingAction;
      setPendingAction(null);
      try {
        await doGmailSend(to, subject, body, threadId, googleToken);
        setMessages(prev => [...prev, { role: 'assistant', text: `Email sent to ${to}.` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'assistant', text: `Failed to send email: ${e.message}` }]);
      }
      return;
    }
    handleConfirmMove();
  }, [pendingAction, googleToken, handleConfirmMove, setPendingAction, setMessages]);

  // Ref-forwarded callback so useTaskCrud can notify contacts of task done/undo
  // (contacts + togglers come from useContacts which is called after useTaskCrud)
  const handleTaskDoneChangedRef = useRef(null);
  const stableTaskDoneChanged = useCallback((...args) => handleTaskDoneChangedRef.current?.(...args), []);

  const {
    addTask, addAndProcess, addProjectTask,
    moveTask, deleteTask, confirmDelete,
    archiveTask, finishComplete,
    handleRollupConfirm, handleRollupSkip,
    handleDeferCheckSkip, handleDeferCheckReview,
    handleActualEffortSave, handleActualEffortSkip,
    handleRecurringStillFine, handleRecurringNeedsWork,
    reassignProject, assignToProject, bulkAssignToProject,
  } = useTaskCrud({
    tasks,
    uncategorizedProjectId,
    setPendingDeleteConfirm,
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
    onTaskDoneChanged: stableTaskDoneChanged,
  });

  // Create an Inbox or Waiting For task from a contact; returns the new task id.
  // options.isWaitingFor = true → places task in Inbox with isWaitingFor flag for GTD processing (FR#134, FR#146)
  const createInboxTask = useCallback((text, options = {}) => {
    const newId = genId();
    const baseTask = {
      id: newId, text, done: false,
      created: Date.now(), priority: [], location: [], dueDate: null,
      effort: null, actualEffort: null, deferUntil: null, notes: null,
      ...(options.contactId ? { contactId: options.contactId } : {}),
    };
    if (options.isWaitingFor) {
      setTasks(prev => [{ ...baseTask, bucket: 'inbox', isWaitingFor: true }, ...prev]);
    } else {
      setTasks(prev => [{ ...baseTask, bucket: 'inbox' }, ...prev]);
    }
    return newId;
  }, [setTasks]);

  // Mark a task as done from the Contacts panel (promise/gift sync — FR#133, FR#135).
  const markTaskDone = useCallback((taskId) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: true } : t));
  }, [setTasks]);

  const { contacts, selectedContactId, setSelectedContactId,
          contactsLoading, contactsSyncing, contactsError, lastSyncedAt,
          syncContacts, updateStandardFields, updateCustomFields,
          addPromise, togglePromiseDone, linkPromiseToTask, deletePromise,
          addLike, deleteLike, addDislike, deleteDislike, addGiftIdea, toggleGiftGiven, deleteGiftIdea,
          linkGiftToTask,
          renameContactRelationshipTag, removeContactRelationshipTag,
          renameContactLikeCategory, removeContactLikeCategory,
          mergeOrphanIntoContact,
          deleteOrphanContact,
    addContactEmail,
    addDriveAttachment,
    removeDriveAttachment,
    toggleFavorite,
  } = useContacts({ googleToken, contactsEnabled, supabaseReady, refreshGoogleToken, userId: authUser?.id, createTask: createInboxTask });
  contactActionsRef.current = { contacts, addPromise, addLike, addDislike, addGiftIdea, updateCustomFields, createInboxTask };

  const { healthItems, healthLoading, addHealthItem, updateHealthItem, removeHealthItem } = useHealth({ supabaseReady, userId: authUser?.id });

  // FR#154: one-time backfill of contact tags already on contacts into the settings list
  const contactTagsBackfilledRef = useRef(false);
  useEffect(() => {
    if (contactTagsBackfilledRef.current || !settingsReady || !contacts.length) return;
    contactTagsBackfilledRef.current = true;
    const allTagsSet = new Set(contacts.flatMap(c => c.relationshipTags || []));
    const newTags = [...allTagsSet].filter(t => !contactRelationshipTags.includes(t));
    if (newTags.length > 0) {
      setContactRelationshipTags(prev => [...new Set([...prev, ...newTags])]);
    }
  }, [settingsReady, contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wire up the task-done→contact sync now that contacts + togglers are available (FR#148, FR#145)
  handleTaskDoneChangedRef.current = (taskId, isDone) => {
    contacts.forEach(contact => {
      const promise = (contact.promises || []).find(p => p.taskId === taskId);
      if (promise && Boolean(promise.done) !== isDone) togglePromiseDone(contact.id, promise.id);
      const gift = (contact.giftIdeas || []).find(g => g.taskId === taskId);
      if (gift && Boolean(gift.given) !== isDone) toggleGiftGiven(contact.id, gift.id);
    });
    // FR#186: when a contact-linked task is marked done, append a completion entry to that contact's notes
    if (isDone && taskCompletionToContactNotes) {
      const task = tasks.find(t => t.id === taskId);
      if (task?.contactId) {
        const contact = contacts.find(c => c.id === task.contactId);
        if (contact) {
          const date = new Date().toISOString().slice(0, 10);
          const entry = `[${date}] Completed: ${task.text}` + (task.notes ? `\n${task.notes}` : '');
          const existing = contact.notes ? contact.notes.trim() : '';
          updateCustomFields(task.contactId, { notes: existing ? `${existing}\n\n${entry}` : entry });
        }
      }
    }
  };

  // Re-link contact gifts/promises when inbox processing replaces a task (Issue#39)
  relinkTaskContactsRef.current = (oldId, newId) => {
    contacts.forEach(contact => {
      const linkedGifts = (contact.giftIdeas || []).filter(g => g.taskId === oldId);
      linkedGifts.forEach(gift => linkGiftToTask(contact.id, gift.id, newId));
      const linkedPromises = (contact.promises || []).filter(p => p.taskId === oldId);
      linkedPromises.forEach(promise => linkPromiseToTask(contact.id, promise.id, newId));
    });
  };

  // Navigate to a specific task from the Contacts panel (promise task link).
  // Switches to the task's bucket view and opens the task detail panel.
  const navigateToTask = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setCurrentBucket(task.bucket);
    setCurrentView('gtd');
    setSelectedTaskId(taskId);
    setShowSettings(false);
  }, [tasks, setCurrentBucket, setCurrentView, setSelectedTaskId, setShowSettings]);

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
    // Seed chatHistory with the intro so the API knows it already presented Step 1.
    // Anthropic API requires conversations to start with a user message, so we
    // prepend a synthetic trigger that stays invisible in the UI (messages state).
    setChatHistory([
      { role: 'user', content: '[Starting Weekly Review]' },
      { role: 'assistant', content: introMsg },
    ]);
    setRawApiThread([]);
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
      const dueDateChildParents = new Set(active.filter(t => t.dueDate && t.parentId).map(t => t.parentId));
      const noCalEvent     = active.filter(t => t.dueDate && !t.calendarEventId && calendarEnabled && !dueDateChildParents.has(t.id));
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

      const urgencyNote = overdue.length > 0 ? ` You have ${overdue.length} overdue item${overdue.length !== 1 ? 's' : ''} that need attention.` : '';
      setCoachMode('daily');
      setChatHistory([]);
      setRawApiThread([]);
      setPendingAction(null);
      setMessages([{ role: 'user', text: `Good morning! Let's start my day.` }]);
      callAI(`Good morning! Let's start my day.${urgencyNote}\n\n${lines}`, 'daily', []);
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

      setCoachMode('daily');
      setChatHistory([]);
      setRawApiThread([]);
      setPendingAction(null);
      setMessages([{ role: 'user', text: `Let's close out my day.` }]);
      callAI(`Let's close out my day.\n\n${lines}`, 'daily', []);
      const newPhase = 'start';
      setDailyReviewPhase(newPhase);
      localStorage.setItem('gtd-daily-phase', JSON.stringify({ phase: newPhase, date: today }));
    }
  };

  // Daily review MIT picker — user selected tasks via checkboxes; write focus and trigger AI close
  const handleMITSubmit = (ids) => {
    const today8601 = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`gtd-todays-focus-${today8601}`, JSON.stringify({ ids, date: today8601 }));
    const selected = tasks.filter(t => ids.includes(t.id));
    const listText = selected.map(t => `- ${t.text} [id:${t.id}]`).join('\n');
    // Remove the picker message so it doesn't stay in history
    setMessages(prev => prev.filter(m => m.type !== 'mit-picker'));
    // Show the user selection as a chat bubble
    const userMsg = `My MITs for today:\n${listText}`;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    callAI(userMsg, 'daily', chatHistory);
    setCurrentView('focus');
  };

  // Prefill the coach chat with email content so the user can process it into tasks
  const processEmailWithAI = useCallback(async (email) => {
    // When triggered from toolbar (not detail panel) the email object has no body or attachments.
    // Fetch the full message so attachment metadata is available to the AI.
    let fullEmail = email;
    if (!email.body && email.id && googleToken) {
      try { fullEmail = await doGmailGetMessageBody(email.id, googleToken); }
      catch { /* fall back to metadata-only */ }
    }
    const body = fullEmail.body ? fullEmail.body.slice(0, 4000) : email.snippet;
    const prompt = [
      `Please review this email and handle it completely using this workflow:`,
      ``,
      `**Tasks:** Identify all action items. Before creating each task, ask me:`,
      `  - Which project or parent it belongs under (suggest the most relevant existing project based on the content — don't default to Uncategorized)`,
      `  - What category it belongs to`,
      `  - Effort estimate and any relevant location`,
      `Once confirmed, create the task with full metadata (category, effort, location, project). The email will be automatically linked.`,
      ``,
      `**Calendar:** Check if this email contains any scheduling information, meeting requests, invitations, or appointment details. If found, summarise the proposed time/date and offer to create a calendar event. Wait for confirmation before emitting →ACTION:calendar_create.`,
      ``,
      `**Contact note:** If the sender matches a contact in your enrichment context, offer to add a brief note summarising the key communication. Use →ACTION:contact_note if the user confirms.`,
      ``,
      `**Similar emails:** After tasks are confirmed, search Gmail for other emails from this sender or with a similar subject — report briefly.`,
      ``,
      `**Filter / label:** Ask whether I'd like a Gmail filter + label for future emails like this. If yes, create the label then the filter.`,
      ``,
      `**Archive:** Once ALL other steps are complete, archive this email via gmail_batch_label with message_ids: ["${email.id}"] and remove_label_ids: ["INBOX"]. Confirm when done.`,
      ``,
      `Email:`,
      `From: ${fullEmail.from || email.from}`,
      `Subject: ${fullEmail.subject || email.subject}`,
      `Date: ${fullEmail.date || email.date}`,
      `Gmail-ID: ${email.id}`,
      ``,
      body,
      ...(fullEmail.attachments && fullEmail.attachments.length > 0 ? [
        ``,
        `Attachments: ${fullEmail.attachments.map(a => `${a.filename} (${a.mimeType})`).join(', ')}`,
        `Attachment IDs for tool use: ${JSON.stringify(fullEmail.attachments)}`,
      ] : []),
    ].join('\n');
    // FR#161: auto-link email to matching contact if setting allows
    if (contactEmailLinkingMode === 'onProcess' || contactEmailLinkingMode === 'both') {
      const rawFrom = email.from || '';
      const senderEmail = (/<([^>]+)>/.exec(rawFrom)?.[1] || rawFrom).trim().toLowerCase();
      if (senderEmail) {
        const matchedContact = contacts.find(ct =>
          (ct.emails || []).some(e => (e.value || '').toLowerCase() === senderEmail)
        );
        if (matchedContact) {
          addContactEmail(matchedContact.id, {
            messageId: email.id,
            threadId:  email.threadId || email.id,
            subject:   email.subject  || '',
            snippet:   email.snippet  || (email.body ? email.body.slice(0, 120) : ''),
            date:      email.date     || new Date().toISOString(),
            direction: 'received',
          });
        }
      }
    }
    preEmailTaskIdsRef.current = new Set(tasks.map(t => t.id));
    setPendingEmailContext({ id: email.id, subject: email.subject });
    setEmailContext({ id: email.id, subject: email.subject });
    setCoachMode("chat");
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text: prompt }]);
    callAI(prompt, "chat", chatHistory, { emailContext: { id: email.id, subject: email.subject } });
  }, [setCoachMode, setChatInput, setMessages, callAI, chatHistory, contacts, addContactEmail, contactEmailLinkingMode]);

  // Attach an email as a driveAttachments entry on a task (FR#40)
  const attachEmailToTask = useCallback((taskId, emailAttachment) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const existing = t.driveAttachments || [];
      if (existing.find(a => a.id === emailAttachment.id)) return t; // dedup
      return { ...t, driveAttachments: [...existing, emailAttachment] };
    }));
  }, [setTasks]);

  // Log an email as a receipt to the configured Google Sheet (FR#46)
  const logEmailAsReceipt = useCallback(async (email) => {
    if (!receiptSheetId || !sheetsEnabled || !googleToken) return;
    const fields = await extractReceiptFields(email, import.meta.env.VITE_ANTHROPIC_API_KEY);
    const row = [
      fields.date || new Date().toISOString().slice(0, 10),
      fields.vendor || '(unknown)',
      fields.amount || '',
      fields.currency || 'USD',
      fields.category || '',
      fields.description || email.subject || '',
      email.id ? `https://mail.google.com/mail/#inbox/${email.id}` : '',
    ];
    await sheetsAppendRows({ token: googleToken, spreadsheetId: receiptSheetId, range: 'Sheet1', values: [row] });
  }, [receiptSheetId, sheetsEnabled, googleToken]);

  // Mark an email as spam via Gmail API (FR#131)
  const markAsSpam = useCallback(async (email) => {
    if (!googleToken || !email?.id) return;
    await doGmailLabel(email.id, ['SPAM'], ['INBOX'], googleToken);
  }, [googleToken]);

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
    const rootProjects = buildReviewQueue(tasks);
    const projectLines = rootProjects.length
      ? rootProjects.map(p => {
          const sample = getOrderedChildren(p.id, tasks)
            .slice(0, 3).map(c => c.text).join(', ');
          return `- [${p.id}] ${p.text}${sample ? ` (e.g. ${sample})` : ''}`;
        }).join("\n")
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
  suggestProjectGroupRef.current = suggestProjectGroup;

  // ── Project review queue ─────────────────────────────────────────────────
  // Includes ALL non-done project-bucket tasks except pure containers
  // (those whose direct children are exclusively other project-bucket tasks).
  // Sub-projects (parentId set) are now included so every level gets reviewed.
  const buildReviewQueue = useCallback((allTasks) => {
    return allTasks.filter(t => {
      if (t.bucket !== 'project' || t.done || t.reviewed) return false;
      const nt = t.nodeType ?? 'project';
      if (!reviewNodeTypes.includes(nt)) return false;
      // Pure container: all direct children are project-bucket nodes (subprojects/categories).
      // These group other nodes but have no actionable tasks of their own — skip.
      const children = (t.childIds || []).map(id => allTasks.find(c => c.id === id)).filter(Boolean);
      if (children.length > 0 && children.every(c => c.bucket === 'project')) return false;
      return true;
    });
  }, [reviewNodeTypes]);

  // Returns "Grandparent > Parent > Project" path string for AI context
  const getProjectPath = useCallback((project, allTasks) => {
    const parts = [project.text];
    let cur = project;
    while (cur.parentId) {
      const parent = allTasks.find(t => t.id === cur.parentId);
      if (!parent) break;
      parts.unshift(parent.text);
      cur = parent;
    }
    return parts.join(' > ');
  }, []);

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

    const path = getProjectPath(project, tasks);
    const prompt =
      `Project ${idx + 1} of ${total}: "${path}"\n` +
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
  }, [tasks, callAI, getProjectPath, buildReviewQueue]);

  const advanceProjectReview = useCallback(() => {
    const rootProjects = buildReviewQueue(tasks);
    const project = rootProjects[reviewProjectIdx];

    // Add checked suggestions as new subtasks of the current project
    if (project) {
      const selected = reviewSuggestions.filter(s => s.checked);
      if (selected.length) {
        const newSubtasks = selected.map(s => ({
          id: genId(), text: s.text, bucket: "project", isNextAction: true, done: false,
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

    if (project) setTasks(prev => prev.map(t => t.id === project.id ? { ...t, reviewed: true } : t));
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
    const rootProjects = buildReviewQueue(tasks);
    const project = rootProjects[reviewProjectIdx];
    if (project) setTasks(prev => prev.map(t => t.id === project.id ? { ...t, reviewed: true } : t));
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
  }, [reviewProjectIdx, tasks, reviewProject]);

  // ── Mode B: Metadata-quality review ─────────────────────────────────────
  const reviewProjectMetadata = useCallback(async (project, idx, total) => {
    setCurrentBucket("project");
    const children = getOrderedChildren(project.id, tasks);
    const activeTasks = children.filter(t => !t.done);
    const toMetaLine = t => {
      const meta = [
        `effort:${t.effort || "none"}`,
        `due:${t.dueDate || "none"}`,
        `dueTime:${t.dueTime || "none"}`,
        `defer:${t.deferUntil || "none"}`,
        `priority:${(t.priority || []).join(',') || "none"}`,
        `location:${(t.location || []).join(',') || "none"}`,
        `category:${t.category || "none"}`,
        `nodeType:${t.nodeType || "none"}`,
      ].join(", ");
      return `- ${t.text} [id:${t.id}] (${meta})`;
    };
    const taskLines = [
      toMetaLine(project) + ' ← container node',
      ...(activeTasks.length ? activeTasks.map(toMetaLine) : ['  (no active subtasks)']),
    ].join("\n");

    const path = getProjectPath(project, tasks);
    const prompt =
      `Project ${idx + 1} of ${total}: "${path}"\n` +
      `Today: ${todayStr()}\n` +
      (locations.length ? `Available locations: ${locations.join(', ')}\n` : '') +
      (efforts.length ? `Available efforts: ${efforts.join(', ')}\n` : '') +
      `Nodes to review:\n${taskLines}`;

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
  }, [tasks, callAI, getProjectPath, buildReviewQueue]);

  const updateTask = useCallback((id, changes) => {
    setTasks(prev => {
      // Auto-set originalDueDate on first dueDate assignment
      const existing = prev.find(t => t.id === id);
      const ch = (existing && "dueDate" in changes && changes.dueDate && !existing.originalDueDate)
        ? { ...changes, originalDueDate: changes.dueDate }
        : changes;
      // Fast path: no cascadeable fields changed — simple single-task update
      const hasCascade = "deferUntil" in ch || "isWaitingFor" in ch || "isSomeday" in ch;
      if (!hasCascade) {
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
      const descendants = new Set(getDescendants(id));
      // Build cascade changes for descendants
      const descendantChanges = {};
      if ("deferUntil" in ch) {
        const oldDefer2 = target.deferUntil;
        const newDefer2 = ch.deferUntil ?? null;
        descendantChanges._deferUntil = { old: oldDefer2, new: newDefer2 };
      }
      if ("isWaitingFor" in ch) descendantChanges._isWaitingFor = ch.isWaitingFor;
      if ("isSomeday" in ch) descendantChanges._isSomeday = ch.isSomeday;
      return prev.map(t => {
        if (t.id === id) {
          const inc = 'deferUntil' in ch && ch.deferUntil != null ? 1 : 0;
          return inc ? { ...t, ...ch, deferCount: (t.deferCount || 0) + 1 } : { ...t, ...ch };
        }
        if (!descendants.has(t.id)) return t;
        const dc = {};
        if (descendantChanges._deferUntil !== undefined) {
          const { old: oldD, new: newD } = descendantChanges._deferUntil;
          if (newD !== null) dc.deferUntil = newD;
          else if (t.deferUntil === oldD) dc.deferUntil = null;
        }
        if (descendantChanges._isWaitingFor !== undefined) dc.isWaitingFor = descendantChanges._isWaitingFor;
        if (descendantChanges._isSomeday !== undefined) dc.isSomeday = descendantChanges._isSomeday;
        return Object.keys(dc).length ? { ...t, ...dc } : t;
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
      .forEach(s => {
        // Normalise fields the user may have edited as comma strings back to arrays
        const overrides = { ...s.overrides };
        if (typeof overrides.priority === 'string')
          overrides.priority = overrides.priority.split(',').map(v => v.trim()).filter(Boolean);
        if (typeof overrides.location === 'string')
          overrides.location = overrides.location.split(',').map(v => v.trim()).filter(Boolean);
        updateTask(s.taskId, overrides);
      });

    const rootProjects = buildReviewQueue(tasks);
    const project = rootProjects[reviewProjectIdx];
    if (project) setTasks(prev => prev.map(t => t.id === project.id ? { ...t, reviewed: true } : t));
    setMetadataSuggestions([]);
    setReviewReady(false);
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
    const rootProjects = buildReviewQueue(tasks);
    const project = rootProjects[reviewProjectIdx];
    if (project) setTasks(prev => prev.map(t => t.id === project.id ? { ...t, reviewed: true } : t));
    setMetadataSuggestions([]);
    setReviewReady(false);
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
    const rootProjects = buildReviewQueue(tasks);
    if (!rootProjects.length) {
      switchCoachMode("chat", "You have no active projects to review. Add some projects first, then come back!");
      return;
    }
    setCoachMode("projectReview");
    setChatHistory([]);
    setRawApiThread([]);
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
    const rootProjects = buildReviewQueue(tasks);
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

  const handleDriveBackup = useCallback(async () => {
    if (!googleToken) throw new Error('Google Drive is not connected.');
    const data = { version: 1, exportedAt: new Date().toISOString(), tasks, locations, efforts, categories };
    const filename = `gtd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    await driveUploadFile({
      token: googleToken,
      name: filename,
      mimeType: 'application/json',
      content: JSON.stringify(data, null, 2),
      parents: driveBackupFolderId ? [driveBackupFolderId] : [],
    });
  }, [googleToken, tasks, locations, efforts, categories, driveBackupFolderId]);

  // "deferred" is a virtual view — tasks keep their original bucket, filtered by deferUntil > today.
  const bucketTasks = currentBucket === "deferred"
    ? tasks.filter(t => isDeferred(t) && !t.done).sort((a, b) => (a.deferUntil > b.deferUntil ? 1 : -1))
    : currentBucket === "waiting"
    ? tasks.filter(t => t.isWaitingFor && !t.done)
    : currentBucket === "someday"
    ? tasks.filter(t => t.isSomeday && !t.done)
    : currentBucket === "next"
    ? tasks.filter(t => t.isNextAction && !t.isSomeday && !t.isWaitingFor && !t.done)
    : tasks.filter(t => t.bucket === currentBucket);
  const counts = Object.fromEntries(Object.keys(BUCKETS).map(k =>
    k === "deferred"
      ? [k, tasks.filter(t => isDeferred(t) && !t.done).length]
      : k === "waiting"
      ? [k, tasks.filter(t => t.isWaitingFor && !t.done).length]
      : k === "someday"
      ? [k, tasks.filter(t => t.isSomeday && !t.done).length]
      : k === "next"
      ? [k, tasks.filter(t => t.isNextAction && !t.isSomeday && !t.isWaitingFor && !t.done).length]
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
    onComplete:           archiveTask,
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
    showWaitingInProjects,
    showSomeDayInProjects,
    uncategorizedProjectId,
    focusedTaskId,
    setFocusedTaskId,
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
          onSelectAnalytics={() => { setCurrentView("analytics"); setShowSettings(false); setSelectedTaskId(null); }}
          contactsEnabled={contactsEnabled}
          onSelectContacts={() => { setCurrentView("contacts"); setShowSettings(false); setSelectedTaskId(null); }}
          onSelectHealth={() => { setCurrentView("health"); setShowSettings(false); setSelectedTaskId(null); }}
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
          
            shortcutModifier={shortcutModifier}
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
                          focusExpandedDefaults={focusExpandedDefaults}
                          onSetFocusExpandedDefaults={setFocusExpandedDefaults}
                          shortcutModifier={shortcutModifier}
                          onSetShortcutModifier={setShortcutModifier}
                          nextActionsViewMode={nextActionsViewMode}
                          onSetNextActionsViewMode={setNextActionsViewMode}
                          reviewNodeTypes={reviewNodeTypes}
                          onSetReviewNodeTypes={setReviewNodeTypes}
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
                          contactsEnabled={contactsEnabled}
                          scopePrefs={scopePrefs}
                          onSetScopePref={setScopePref}
                          onReauthorizeGoogle={reauthorizeGoogle}
                          onDisconnectCalendar={disconnectCalendar}
                          onDisconnectContacts={disconnectContacts}
                          onDisconnectAll={disconnectAll}
                          recurringReviewDays={recurringReviewDays}
                          onSetRecurringReviewDays={setRecurringReviewDays}
                          calendarReminderMinutes={calendarReminderMinutes}
                          onSetCalendarReminderMinutes={setCalendarReminderMinutes}
                          driveBaseFolderId={driveBaseFolderId}
                          onSetDriveBaseFolderId={setDriveBaseFolderId}
                          driveConversationExportFolderId={driveConversationExportFolderId}
                          onSetDriveConversationExportFolderId={setDriveConversationExportFolderId}
                          driveSlideDeckFolderId={driveSlideDeckFolderId}
                          onSetDriveSlideDeckFolderId={setDriveSlideDeckFolderId}
                          driveSpreadsheetFolderId={driveSpreadsheetFolderId}
                          onSetDriveSpreadsheetFolderId={setDriveSpreadsheetFolderId}
                          driveDocumentFolderId={driveDocumentFolderId}
                          onSetDriveDocumentFolderId={setDriveDocumentFolderId}
                          driveBaseFolderPath={driveBaseFolderPath}
                          onSetDriveBaseFolderPath={setDriveBaseFolderPath}
                          driveConversationExportFolderPath={driveConversationExportFolderPath}
                          onSetDriveConversationExportFolderPath={setDriveConversationExportFolderPath}
                          driveSlideDeckFolderPath={driveSlideDeckFolderPath}
                          onSetDriveSlideDeckFolderPath={setDriveSlideDeckFolderPath}
                          driveSpreadsheetFolderPath={driveSpreadsheetFolderPath}
                          onSetDriveSpreadsheetFolderPath={setDriveSpreadsheetFolderPath}
                          driveDocumentFolderPath={driveDocumentFolderPath}
                          onSetDriveDocumentFolderPath={setDriveDocumentFolderPath}
                          driveBackupFolderId={driveBackupFolderId}
                          onSetDriveBackupFolderId={setDriveBackupFolderId}
                          driveBackupFolderPath={driveBackupFolderPath}
                          onSetDriveBackupFolderPath={setDriveBackupFolderPath}
                          onBackupToDrive={handleDriveBackup}
                          exportSettings={exportSettings}
                          onExportSettingsChange={setExportSettings}
                          exportTemplates={exportTemplates}
                          onExportTemplatesChange={setExportTemplates}
                          userCity={userCity}
                          onSetUserCity={setUserCity}
                          userHomeAddress={userHomeAddress}
                          onSetUserHomeAddress={setUserHomeAddress}
                          userWorkAddress={userWorkAddress}
                          onSetUserWorkAddress={setUserWorkAddress}
                          coachName={coachName}
                          onSetCoachName={setCoachName}
                          userName={userName}
                          onSetUserName={setUserName}
                          receiptSheetId={receiptSheetId}
                          onSetReceiptSheetId={setReceiptSheetId}
                          contactRelationshipTags={contactRelationshipTags}
                          onSetContactRelationshipTags={setContactRelationshipTags}
                          contactLikesCategories={contactLikesCategories}
                          onSetContactLikesCategories={setContactLikesCategories}
                          contacts={contacts}
                          onRenameContactRelationshipTag={renameContactRelationshipTag}
                          onRemoveContactRelationshipTag={removeContactRelationshipTag}
                          onRenameContactLikeCategory={renameContactLikeCategory}
                          onRemoveContactLikeCategory={removeContactLikeCategory}
                          contactEmailLinkingMode={contactEmailLinkingMode}
                          onSetContactEmailLinkingMode={setContactEmailLinkingMode}
                          taskCompletionToContactNotes={taskCompletionToContactNotes}
                          onSetTaskCompletionToContactNotes={setTaskCompletionToContactNotes}
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
                          attachEmailToTask={attachEmailToTask}
                          tasks={tasks}
                          contacts={contacts}
                          addContactEmail={addContactEmail}
                          contactEmailLinkingMode={contactEmailLinkingMode}
                          openCoachChat={openCoachChat}
                          authUser={authUser}
                          logEmailAsReceipt={logEmailAsReceipt}
                          markAsSpam={markAsSpam}
                          onInboxLoaded={setInboxSenderEmails}
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
                          calendarReminderMinutes={calendarReminderMinutes}
                        />
                      ) : currentView === "focus" ? (
                        <TodaysFocusView
                          tasks={tasks}
                          calendarEvents={calendarEvents}
                          calendarEnabled={calendarEnabled}
                          onDailyReview={startDailyReview}
                          onOpenDetail={setSelectedTaskId}
                          tagDisplay={tagDisplay}
                          focusExpandedDefaults={focusExpandedDefaults}
                          onSetFocusExpandedDefaults={setFocusExpandedDefaults}
                          shortcutModifier={shortcutModifier}
                          onSetShortcutModifier={setShortcutModifier}
                          googleToken={googleToken}
                          docsEnabled={docsEnabled}
                          driveConversationExportFolderId={driveConversationExportFolderId}
                          exportTemplates={exportTemplates}
                        />
                      ) : currentView === "health" ? (
                        <HealthPanel
                          healthItems={healthItems}
                          healthLoading={healthLoading}
                          addHealthItem={addHealthItem}
                          updateHealthItem={updateHealthItem}
                          removeHealthItem={removeHealthItem}
                          googleToken={googleToken}
                          driveEnabled={driveEnabled}
                          calendarEnabled={calendarEnabled}
                          calendarEvents={calendarEvents}
                          onSummarizeDoc={(item) => {
                            setCurrentView("gtd");
                            openCoachChat(`Please summarize this medical document from Drive (file ID: ${item.drive_file_id}, name: "${item.name}"). Use the get_drive_file tool to read it, then write a brief plain-language summary I can save to my health records.`);
                          }}
                          onCreateCalendarEvent={async (form) => {
                            if (!googleToken || !form.appointmentDate) return;
                            try {
                              const dt = new Date(form.appointmentDate);
                              const date = dt.toISOString().slice(0, 10);
                              const startTime = dt.toTimeString().slice(0, 5);
                              const endTime = new Date(dt.getTime() + 30 * 60000).toTimeString().slice(0, 5);
                              const desc = [form.provider && `Provider: ${form.provider}`, form.notes].filter(Boolean).join("\n");
                              const ev = await doCalendarCreateEvent(googleToken, { summary: form.name, description: desc, date, startTime, endTime, reminderMinutes: calendarReminderMinutes ?? 10 });
                              setCalendarEvents(prev => [...prev, ev]);
                            } catch { /* health item saved regardless */ }
                          }}
                        />
                      ) : currentView === "contacts" ? (
                        <ContactsPanel
                          contacts={contacts}
                          selectedContactId={selectedContactId}
                          setSelectedContactId={setSelectedContactId}
                          contactsLoading={contactsLoading}
                          contactsSyncing={contactsSyncing}
                          contactsError={contactsError}
                          lastSyncedAt={lastSyncedAt}
                          contactsEnabled={contactsEnabled}
                          syncContacts={syncContacts}
                          updateStandardFields={updateStandardFields}
                          updateCustomFields={updateCustomFields}
                          addPromise={addPromise}
                          togglePromiseDone={togglePromiseDone}
                          linkPromiseToTask={linkPromiseToTask}
                          deletePromise={deletePromise}
                          addLike={addLike}
                          deleteLike={deleteLike}
                          addDislike={addDislike}
                          deleteDislike={deleteDislike}
                          addGiftIdea={addGiftIdea}
                          toggleGiftGiven={toggleGiftGiven}
                          deleteGiftIdea={deleteGiftIdea}
                          tasks={tasks}
                          createInboxTask={createInboxTask}
                          onNavigateToTask={navigateToTask}
                          markTaskDone={markTaskDone}
                          linkGiftToTask={linkGiftToTask}
                          mergeOrphanIntoContact={mergeOrphanIntoContact}
                          deleteOrphanContact={deleteOrphanContact}
                          onOpenSettings={() => setShowSettings(true)}
                          contactRelationshipTags={contactRelationshipTags}
                          setContactRelationshipTags={setContactRelationshipTags}
                          contactLikesCategories={contactLikesCategories}
                          addDriveAttachment={addDriveAttachment}
                          removeDriveAttachment={removeDriveAttachment}
                          googleToken={googleToken}
                          driveEnabled={driveEnabled}
                          toggleFavorite={toggleFavorite}
                          inboxSenderEmails={inboxSenderEmails}
                        />
                      ) : currentView === "analytics" ? (
                        <AnalyticsArea
                          tasks={tasks}
                          contacts={contacts}
                          onNavigateToContact={(id) => { setCurrentView('contacts'); setSelectedContactId(id); }}
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
                          locations={locations}
                          projectCategoryFilter={projectCategoryFilter}
                          setProjectCategoryFilter={setProjectCategoryFilter}
                          showCompletedInProjects={showCompletedInProjects}
                          showWaitingInProjects={showWaitingInProjects}
                          setShowWaitingInProjects={setShowWaitingInProjects}
                          showSomeDayInProjects={showSomeDayInProjects}
                          setShowSomeDayInProjects={setShowSomeDayInProjects}
                          setShowCompletedInProjects={setShowCompletedInProjects}
                          focusedTaskId={focusedTaskId}
                          setFocusedTaskId={setFocusedTaskId}
                          googleToken={googleToken}
                          docsEnabled={docsEnabled}
                          driveConversationExportFolderId={driveConversationExportFolderId}
                          exportTemplates={exportTemplates}
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
                totalReviewProjects={buildReviewQueue(tasks).length}
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
                onConfirmMove={handleConfirmMoveWithSend}
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
                efforts={efforts}
                locations={locations}
                categories={categories}
                onUpdatePendingAction={(field, value) => setPendingAction(prev => prev ? ({ ...prev, [field]: value }) : prev)}
                onStartBrainDump={startBrainDump}
                onStartProjectReview={startProjectReview}
                onStartDailyReview={startDailyReview}
                onSwitchToChat={() => switchCoachMode("chat", "I can see your task list. Ask me anything — clarify a task, plan your day, or check in on your system.")}
                onMITSubmit={handleMITSubmit}
                docsEnabled={docsEnabled}
                driveConversationExportFolderId={driveConversationExportFolderId}
                exportSettings={exportSettings}
                onExportSettingsChange={setExportSettings}
                exportTemplates={exportTemplates}
                googleToken={googleToken}
                rawApiThread={rawApiThread}
                coachName={coachName}
                userName={userName}
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
                    slidesEnabled={slidesEnabled}
                    googleAccessToken={googleToken}
                    onUpdate={updateTask}
                    onComplete={(id) => { archiveTask(id); setSelectedTaskId(null); }}
                    onDelete={(id) => { setTasks(prev => prev.filter(t => t.id !== id)); setSelectedTaskId(null); }}
                    onReassignProject={reassignProject}
                    onSkipRecurrence={(id) => { skipRecurrence(id); setSelectedTaskId(null); }}
                    onClose={() => setSelectedTaskId(null)}
                    style={s.detailPanel}
                    contactName={selTask.contactId ? (contacts.find(c => c.id === selTask.contactId)?.displayName || null) : null}
                    contacts={contacts}
                    onNavigateToContact={(contactId) => { setCurrentView('contacts'); setSelectedContactId(contactId); }}
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
        {pendingDeleteConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ background: '#1a1c18', border: '1px solid #333530', borderRadius: 12, padding: '24px 28px', maxWidth: 400, width: '90%' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#e8e4dc', marginBottom: 8 }}>Delete project?</div>
              <div style={{ fontSize: 13, color: '#a8a49c', marginBottom: 20, lineHeight: 1.5 }}>
                <strong style={{ color: '#e8e4dc' }}>{pendingDeleteConfirm.taskText}</strong> has subtasks.<br />
                Delete all subtasks, or move them to UnCategorized?
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setPendingDeleteConfirm(null)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #333530', background: 'transparent', color: '#a8a49c', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => confirmDelete(pendingDeleteConfirm.taskId, false)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #5a8fd4', background: '#5a8fd422', color: '#5a8fd4', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Move to UnCategorized</button>
                <button onClick={() => confirmDelete(pendingDeleteConfirm.taskId, true)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #d4845a', background: '#d4845a22', color: '#d4845a', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Delete all</button>
              </div>
            </div>
          </div>
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
