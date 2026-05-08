import { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { TaskActionsContext, TaskRowContext } from "./contexts.js";
import { COLORS, BUCKETS } from "./constants.jsx";
import { EmailManagementView } from "./components/email.jsx";
import { CalendarManagementView } from "./components/CalendarManagementView.jsx";
import { DeferCheckPrompt, NoteRollupPrompt, ActualEffortPrompt } from "./components/AICoach.jsx";
import { SettingsPanel } from "./components/SettingsPanel.jsx";
import { UsagePanel } from "./components/UsagePanel.jsx";
import { TaskDetailPanel } from "./components/TaskDetailPanel.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { ResizeHandle } from "./components/ResizeHandle.jsx";
import { AuthGate } from "./components/AuthGate.jsx";
import { AppSidebar } from "./components/AppSidebar.jsx";
import { TaskBucketView } from "./components/TaskBucketView.jsx";
import { CoachPanel } from "./components/CoachPanel.jsx";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth.js";
import { useGoogleAuth } from "./hooks/useGoogleAuth.js";
import { useAppSettings } from "./hooks/useAppSettings.js";
import { useAIUsageTracking } from "./hooks/useAIUsageTracking.js";
import { useProjectReview } from "./hooks/useProjectReview.js";
import { useCalendarState } from "./hooks/useCalendarState.js";
import { useGmailState } from "./hooks/useGmailState.js";
import { useAICoachState } from "./hooks/useAICoachState.js";
import { useTaskUIState } from "./hooks/useTaskUIState.js";
import { createEmptyUsageStats } from "./hooks/useAIUsageTracking.js";
import { supabase, queueEntryToRow } from "./api/supabase.js";

import { parseRRULE, calEventStart, isAllDayEvent, genId } from "./api/calendarApi.js";
import { todayStr, isDeferred, buildNextOccurrence, effortToMinutes, extractSuggestions, extractMetadata, getOrderedChildren, useResizer } from "./utils/taskUtils.jsx";
import { useDragDrop } from "./hooks/useDragDrop.js";
import { useSupabaseSync } from "./hooks/useSupabaseSync.js";
import { useCallAI } from "./hooks/useCallAI.js";
import { useInboxProcessing } from "./hooks/useInboxProcessing.js";




const sleep = ms => new Promise(r => setTimeout(r, ms));















export default function GTDManager() {
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_tasks") || "[]"); } catch { return []; }
  });
  const { messages, setMessages, chatHistory, setChatHistory, coachMode, setCoachMode, chatInput, setChatInput, loading, setLoading, moveMenu, setMoveMenu, pendingAction, setPendingAction, chatEndRef, chatInputRef, provider, setProvider, localModel, setLocalModel, availableModels, setAvailableModels } = useAICoachState();
  const { locations, setLocations, efforts, setEfforts, calibrationOverrides, setCalibrationOverrides, tagDisplay, setTagDisplay } = useAppSettings();
  const { aiUsageStats, setAiUsageStats, sessionUsage, recordUsage } = useAIUsageTracking();
  const { currentView, setCurrentView, emailTab, setEmailTab, gmailQueue, setGmailQueue, gmailUnreadCount, setGmailUnreadCount } = useGmailState();
  const { calendarEvents, setCalendarEvents, calendarTab, setCalendarTab, skippedCalendarIds, setSkippedCalendarIds, seenCalendarEventIds, setSeenCalendarEventIds, recurringAcknowledgedMap, setRecurringAcknowledgedMap, recurringReviewDays, setRecurringReviewDays, calendarSuggestions, setCalendarSuggestions, calendarSuggestionsReady, setCalendarSuggestionsReady } = useCalendarState();
  const { googleToken, googleScope, calendarEnabled, gmailError,
          signInWithGoogle, disconnectGmail, connectCalendar, disconnectCalendar,
          refreshGoogleToken } = useGoogleAuth({ setCalendarEvents });
  const { currentBucket, setCurrentBucket, addText, setAddText, showSettings, setShowSettings, showUsage, setShowUsage, nextGroupBy, setNextGroupBy, projectParentId, setProjectParentId, collapsedNodes, setCollapsedNodes, selectedTaskId, setSelectedTaskId, actualEffortPrompt, setActualEffortPrompt, pendingRollup, setPendingRollup, pendingDeferCheck, setPendingDeferCheck, inboxSelectedIds, setInboxSelectedIds, pendingGroupSuggestion, setPendingGroupSuggestion } = useTaskUIState();
  const { reviewProjectIdx, setReviewProjectIdx, reviewSuggestions, setReviewSuggestions, reviewReady, setReviewReady, reviewMode, setReviewMode, metadataSuggestions, setMetadataSuggestions } = useProjectReview();

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
    locations, efforts, calibrationOverrides,
    skippedCalendarIds, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays,
    setLocations, setEfforts, setCalibrationOverrides,
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

  const getTaskContext = useCallback(() => {
    const today = todayStr();
    const bucketNames = { inbox: "Inbox", next: "Next Actions", project: "Projects", waiting: "Waiting For", someday: "Someday/Maybe" };
    const sections = Object.entries(bucketNames).map(([k, label]) => {
      const items = tasks.filter(t => t.bucket === k && !t.done);
      if (!items.length) return `${label}: empty`;
      const lines = items.map(t => {
        const meta = [];
        if (t.dueDate)          meta.push(`due:${t.dueDate}${t.dueTime ? ' ' + t.dueTime : ''}`);
        if (t.originalDueDate)  meta.push(`original-due:${t.originalDueDate}`);
        if (t.completedDate)    meta.push(`completed:${t.completedDate}`);
        if (t.deferUntil)       meta.push(`defer-until:${t.deferUntil}`);
        if (t.effort)           meta.push(`effort:${t.effort}`);
        if (t.actualEffort)     meta.push(`actual-effort:${t.actualEffort}`);
        if (t.location?.length) meta.push(`location:${t.location.join(",")}`);
        if (t.priority?.length) meta.push(`priority:${t.priority.join(",")}`);
        if (t.notes)            meta.push(`has-notes`);
        if (t.recurrence) {
          const r = t.recurrence;
          const days = r.weekDays?.length
            ? `:${r.weekDays.map(d => ["sun","mon","tue","wed","thu","fri","sat"][d]).join(",")}`
            : "";
          const until = r.until ? `:${r.until}` : "";
          meta.push(`recur:${r.frequency}:${r.interval || 1}${days}${until}`);
        }
        const idTag = `[id:${t.id}] `;
        return meta.length ? `- ${idTag}${t.text} [${meta.join("] [")}]` : `- ${idTag}${t.text}`;
      });
      return `${label} (${items.length}):\n${lines.join("\n")}`;
    });
    // Append upcoming calendar events (next 14 days) when calendar is connected
    let calSection = '';
    if (calendarEnabled && calendarEvents.length > 0) {
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const horizon = new Date(todayDate);
      horizon.setDate(horizon.getDate() + 14);
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

  const { callAI, sendChat } = useCallAI({
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

  const handleRecurringStillFine = useCallback((masterId) => {
    setRecurringAcknowledgedMap(prev => {
      const next = new Map(prev);
      const entry = next.get(masterId);
      if (entry) next.set(masterId, { ...entry, acknowledgedAt: Date.now() });
      return next;
    });
  }, []);

  const handleRecurringNeedsWork = useCallback((masterId, title) => {
    const newId = genId();
    const newTask = {
      id: newId, text: title, bucket: 'inbox', done: false, created: Date.now(),
      priority: [], location: [], dueDate: null, dueTime: null, effort: null,
      actualEffort: null, deferUntil: null,
      notes: 'Recurring calendar event — needs follow-up',
      recurrence: null, childIds: [], parentId: null,
    };
    setTasks(prev => [newTask, ...prev]);
    setSelectedTaskId(newId);
    setCurrentBucket('inbox');
    setRecurringAcknowledgedMap(prev => {
      const next = new Map(prev);
      const entry = next.get(masterId);
      if (entry) next.set(masterId, { ...entry, acknowledgedAt: Date.now() });
      return next;
    });
  }, []);

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

  const startBrainDump = () => {
    switchCoachMode("dump", "Let's surface everything in your head and get it into your inbox.\n\n**Starting with work:** What professional tasks, deadlines, or commitments have been on your mind that aren't written down anywhere?");
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


  const addTask = (bucket) => {
    const text = addText.trim();
    if (!text) return;
    setTasks(prev => [{ id: genId(), text, bucket: bucket || currentBucket, done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null }, ...prev]);
    setAddText("");
  };

  const addAndProcess = () => {
    const text = addText.trim();
    if (!text) return;
    const task = { id: genId(), text, bucket: "inbox", done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null };
    setTasks(prev => [task, ...prev]);
    setAddText("");
    setCurrentBucket("inbox");
    askAIAboutTask(task);
  };

  const addProjectTask = () => {
    const text = addText.trim();
    if (!text) return;
    if (projectParentId === "__new__") {
      // Create a new root project
      setTasks(prev => [
        { id: genId(), text, bucket: "project", done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [] },
        ...prev,
      ]);
    } else {
      // Add as next-action child of an existing project
      const childId = genId();
      setTasks(prev => [
        ...prev.map(t =>
          t.id === projectParentId
            ? { ...t, childIds: [...(t.childIds || []), childId] }
            : t
        ),
        { id: childId, text, bucket: "next", done: false, created: Date.now(), parentId: projectParentId, priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null },
      ]);
    }
    setAddText("");
  };

  const moveTask = (id, bucket) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, bucket, done: bucket === "done" } : t));
    setMoveMenu(null);
    setPendingAction(null);
  };

  const deleteTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

  const completeTask = useCallback((id, options = {}) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // When marking DONE (not un-doing):
    if (!task.done) {
      // 1. Deferred/Someday child check — warn if any children are in defer or someday
      if (!options.skipDeferCheck) {
        const deferredKids = tasks.filter(t => t.parentId === id && (t.bucket === "deferred" || t.bucket === "someday") && !t.done);
        if (deferredKids.length > 0) {
          setPendingDeferCheck({ taskId: id, taskText: task.text, deferredChildren: deferredKids });
          return;
        }
      }
      // 2. Roll-up prompt: subtask with notes gets a chance to append to immediate parent
      if (task.notes && task.parentId) {
        const parent = tasks.find(t => t.id === task.parentId);
        if (parent) {
          setPendingRollup({ taskId: id, taskText: task.text, notes: task.notes, parentId: parent.id, parentText: parent.text });
          return;
        }
      }
      // 3. Effort prompt: task has estimate but no recorded actual time
      if (task.effort && !task.actualEffort) {
        setActualEffortPrompt({ taskId: id, taskText: task.text, estimatedEffort: task.effort });
        return;
      }
    }

    if (!task.done) {
      const nextOcc = task.recurrence ? buildNextOccurrence(task) : null;
      setTasks(prev => {
        const mapped = prev.map(t => t.id === id ? { ...t, done: true, bucket: "done", completedDate: new Date().toISOString().split('T')[0] } : t);
        return nextOcc ? [nextOcc, ...mapped] : mapped;
      });
    } else {
      setTasks(prev => prev.map(t => t.id === id
        ? { ...t, done: false, bucket: "inbox", actualEffort: null, completedDate: null }
        : t
      ));
    }
  }, [tasks]);

  // After roll-up decision, check if effort prompt is also needed, then complete the task.
  const finishComplete = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.effort && !task.actualEffort) {
      setActualEffortPrompt({ taskId, taskText: task.text, estimatedEffort: task.effort });
    } else {
      const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
      setTasks(prev => {
        const mapped = prev.map(t => t.id === taskId ? { ...t, done: true, bucket: "done", completedDate: new Date().toISOString().split('T')[0] } : t);
        return nextOcc ? [nextOcc, ...mapped] : mapped;
      });
    }
  }, [tasks]);

  const handleRollupConfirm = useCallback((heading) => {
    if (!pendingRollup) return;
    const { taskId, notes, parentId } = pendingRollup;
    // heading is the (possibly edited) label line from NoteRollupPrompt
    const stamp = `${heading}\n${notes}`;
    setTasks(prev => prev.map(t => {
      if (t.id !== parentId) return t;
      const existing = t.notes ? t.notes.trim() : "";
      return { ...t, notes: existing ? `${existing}\n\n---\n${stamp}` : stamp };
    }));
    setPendingRollup(null);
    finishComplete(taskId);
  }, [pendingRollup, finishComplete]);

  const handleRollupSkip = useCallback(() => {
    if (!pendingRollup) return;
    const { taskId } = pendingRollup;
    setPendingRollup(null);
    finishComplete(taskId);
  }, [pendingRollup, finishComplete]);

  const handleDeferCheckSkip = useCallback(() => {
    if (!pendingDeferCheck) return;
    const { taskId } = pendingDeferCheck;
    setPendingDeferCheck(null);
    completeTask(taskId, { skipDeferCheck: true });
  }, [pendingDeferCheck, completeTask]);

  const handleDeferCheckReview = useCallback(() => {
    setPendingDeferCheck(null);
  }, []);

  const handleActualEffortSave = useCallback((actualEffort) => {
    if (!actualEffortPrompt) return;
    const task = tasks.find(t => t.id === actualEffortPrompt.taskId);
    const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
    setTasks(prev => {
      const mapped = prev.map(t =>
        t.id === actualEffortPrompt.taskId
          ? { ...t, done: true, bucket: "done", actualEffort, completedDate: new Date().toISOString().split('T')[0] }
          : t
      );
      return nextOcc ? [nextOcc, ...mapped] : mapped;
    });
    setActualEffortPrompt(null);
  }, [actualEffortPrompt, tasks]);

  const handleActualEffortSkip = useCallback(() => {
    if (!actualEffortPrompt) return;
    const task = tasks.find(t => t.id === actualEffortPrompt.taskId);
    const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
    setTasks(prev => {
      const mapped = prev.map(t =>
        t.id === actualEffortPrompt.taskId
          ? { ...t, done: true, bucket: "done", completedDate: new Date().toISOString().split('T')[0] }
          : t
      );
      return nextOcc ? [nextOcc, ...mapped] : mapped;
    });
    setActualEffortPrompt(null);
  }, [actualEffortPrompt, tasks]);
  // Toggle collapse for a single node (subtask level: hides its children).
  const toggleCollapse = useCallback((id) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Toggle collapse for an array of child IDs (project level: fold/unfold to next level).
  // If all children are already collapsed, expands them; otherwise collapses all.
  const toggleCollapseLevel = useCallback((childIds) => {
    setCollapsedNodes(prev => {
      const allCollapsed = childIds.length > 0 && childIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allCollapsed) {
        childIds.forEach(id => next.delete(id));
      } else {
        childIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  // Move a task to a different project, or make it standalone (newProjectId === null).
  // Handles: removing from old parent's childIds, adding to new parent's childIds,
  // and guards against circular references (can't assign a task to one of its own descendants).
  const reassignProject = useCallback((taskId, newProjectId, newProjectName) => {
    // If a new project name is provided, create the project first then reassign.
    if (newProjectName) {
      const newProjId = genId();
      setTasks(prev => {
        const task = prev.find(t => t.id === taskId);
        if (!task) return prev;
        const oldProjectId = task.parentId || null;
        const updated = prev.map(t => {
          if (t.id === taskId) return { ...t, parentId: newProjId };
          if (oldProjectId && t.id === oldProjectId)
            return { ...t, childIds: (t.childIds || []).filter(id => id !== taskId) };
          return t;
        });
        const newProject = {
          id: newProjId, text: newProjectName.trim(), bucket: "project",
          done: false, created: Date.now(), priority: [], location: [],
          dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null,
          childIds: [taskId],
        };
        return [...updated, newProject];
      });
      return;
    }

    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const oldProjectId = task.parentId || null;
      if (oldProjectId === newProjectId) return prev; // no-op

      // Guard: prevent circular reference — don't allow assigning to a descendant.
      if (newProjectId) {
        function isDescendant(ancestorId, nodeId, seen = new Set()) {
          if (seen.has(nodeId) || !nodeId) return false;
          seen.add(nodeId);
          const node = prev.find(t => t.id === nodeId);
          if (!node) return false;
          return (node.childIds || []).some(cid => cid === ancestorId || isDescendant(ancestorId, cid, seen));
        }
        if (isDescendant(taskId, newProjectId)) return prev;
      }

      return prev.map(t => {
        // Update the task itself
        if (t.id === taskId) return { ...t, parentId: newProjectId || null };
        // Remove from old parent's childIds
        if (oldProjectId && t.id === oldProjectId) {
          return { ...t, childIds: (t.childIds || []).filter(id => id !== taskId) };
        }
        // Add to new parent's childIds (avoid duplicates)
        if (newProjectId && t.id === newProjectId) {
          const existing = t.childIds || [];
          return existing.includes(taskId) ? t : { ...t, childIds: [...existing, taskId] };
        }
        return t;
      });
    });
  }, []);

  // Assign a Next Action (no parentId) to an existing or new project
  const assignToProject = useCallback((taskId, projectId, newProjectName) => {
    if (newProjectName) {
      const newProjId = genId();
      setTasks(prev => [
        ...prev.map(t => t.id === taskId ? { ...t, parentId: newProjId } : t),
        { id: newProjId, text: newProjectName.trim(), bucket: "project", done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [taskId] },
      ]);
    } else if (projectId) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId)   return { ...t, parentId: projectId };
        if (t.id === projectId) return { ...t, childIds: [...(t.childIds || []), taskId] };
        return t;
      }));
    }
  }, []);

  // Assign multiple selected inbox tasks to an existing or new project at once.
  const bulkAssignToProject = useCallback((selectedIds, projectId, newProjectName) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (newProjectName) {
      const newProjId = genId();
      setTasks(prev => {
        const updated = prev.map(t => ids.includes(t.id) ? { ...t, parentId: newProjId } : t);
        const newProject = {
          id: newProjId, text: newProjectName.trim(), bucket: "project",
          done: false, created: Date.now(), priority: [], location: [],
          dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null,
          childIds: ids,
        };
        return [...updated, newProject];
      });
    } else if (projectId) {
      setTasks(prev => prev.map(t => {
        if (ids.includes(t.id)) return { ...t, parentId: projectId };
        if (t.id === projectId) {
          const existing = t.childIds || [];
          const toAdd = ids.filter(id => !existing.includes(id));
          return toAdd.length ? { ...t, childIds: [...existing, ...toAdd] } : t;
        }
        return t;
      }));
    }
    setInboxSelectedIds(new Set());
  }, []);

  const addLocation = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLocations(prev => prev.includes(trimmed) ? prev : [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
  }, []);

  const renameLocation = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setLocations(prev => prev.map(l => l === oldName ? trimmed : l).sort((a, b) => a.localeCompare(b)));
    setTasks(prev => prev.map(t => ({
      ...t,
      location: (t.location || []).map(l => l === oldName ? trimmed : l),
    })));
  }, []);

  const removeLocation = useCallback((name, replaceName) => {
    setLocations(prev => prev.filter(l => l !== name));
    setTasks(prev => prev.map(t => {
      const loc = t.location || [];
      if (!loc.includes(name)) return t;
      const next = loc.filter(l => l !== name);
      if (replaceName && !next.includes(replaceName)) next.push(replaceName);
      return { ...t, location: next };
    }));
  }, []);

  const addEffort = useCallback((name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEfforts(prev => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed].sort((a, b) => effortToMinutes(a) - effortToMinutes(b));
    });
  }, []);

  const renameEffort = useCallback((oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setEfforts(prev => prev.map(e => e === oldName ? trimmed : e));
    setTasks(prev => prev.map(t => ({
      ...t,
      effort:       t.effort       === oldName ? trimmed : t.effort,
      actualEffort: t.actualEffort === oldName ? trimmed : t.actualEffort,
    })));
  }, []);

  const removeEffort = useCallback((name) => {
    setEfforts(prev => prev.filter(e => e !== name));
    setTasks(prev => prev.map(t => ({
      ...t,
      effort:       t.effort       === name ? null : t.effort,
      actualEffort: t.actualEffort === name ? null : t.actualEffort,
    })));
  }, []);

  const setCalibrationOverride = useCallback((label, overrideLabel) => {
    setCalibrationOverrides(prev => ({ ...prev, [label]: overrideLabel || null }));
  }, []);

  const clearCalibrationOverride = useCallback((label) => {
    setCalibrationOverrides(prev => {
      const next = { ...prev };
      delete next[label];
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const data = { version: 1, exportedAt: new Date().toISOString(), tasks, locations, efforts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gtd-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tasks, locations, efforts]);

  const handleImport = useCallback((data, mode = "replace") => {
    if (!data || !Array.isArray(data.tasks)) {
      alert("Invalid backup file — expected a tasks array.");
      return;
    }
    if (mode === "replace") {
      if (!window.confirm(`Replace all ${tasks.length} current tasks with ${data.tasks.length} imported tasks?`)) return;
      setTasks(data.tasks);
      if (Array.isArray(data.locations)) setLocations([...data.locations].sort((a, b) => a.localeCompare(b)));
      if (Array.isArray(data.efforts)) setEfforts(data.efforts);
    } else {
      const existingIds = new Set(tasks.map(t => t.id));
      const incoming = data.tasks.filter(t => !existingIds.has(t.id));
      if (!incoming.length) {
        alert("Nothing to merge — all tasks in this backup already exist.");
        return;
      }
      setTasks(prev => [...incoming, ...prev]);
      if (Array.isArray(data.locations))
        setLocations(prev => [...new Set([...prev, ...data.locations])].sort((a, b) => a.localeCompare(b)));
      if (Array.isArray(data.efforts))
        setEfforts(prev => { const s = new Set(prev); return [...prev, ...data.efforts.filter(e => !s.has(e))]; });
      alert(`Merged ${incoming.length} new task${incoming.length !== 1 ? "s" : ""}.`);
    }
  }, [tasks]);

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
          onSelectEmail={() => { setCurrentView("email"); setShowSettings(false); setSelectedTaskId(null); }}
          onSelectCalendar={() => { setCurrentView("calendar"); setShowSettings(false); setSelectedTaskId(null); }}
          onToggleSettings={() => { setShowSettings(v => !v); setShowUsage(false); }}
          onToggleUsage={() => { setShowUsage(v => !v); setShowSettings(false); }}
          onProcessInbox={startProcessInbox}
          onWeeklyReview={startWeeklyReview}
          onBrainDump={startBrainDump}
        />
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
                          onExport={handleExport}
                          onImport={handleImport}
                          onClose={() => setShowSettings(false)}
                          googleToken={googleToken}
                          googleScope={googleScope}
                          onConnectGmail={signInWithGoogle}
                          onDisconnectGmail={disconnectGmail}
                          gmailError={gmailError}
                          calendarEnabled={calendarEnabled}
                          onConnectCalendar={connectCalendar}
                          onDisconnectCalendar={disconnectCalendar}
                          recurringReviewDays={recurringReviewDays}
                          onSetRecurringReviewDays={setRecurringReviewDays}
                        />
                      ) : showUsage ? (
                        <UsagePanel
                          stats={aiUsageStats}
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
                    locations={locations}
                    efforts={efforts}
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
