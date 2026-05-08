import { useState, useEffect, useRef, useCallback, useMemo, useContext } from "react";
import { TaskActionsContext, TaskRowContext } from "./contexts.js";
import { COLORS, BUCKETS, COACH_MODES, SYSTEM_PROMPTS, OPENWEBUI_URL } from "./constants.jsx";
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
import { DEFAULT_EFFORTS } from "./hooks/useAppSettings.js";
import { supabase, queueEntryToRow, rowToQueueEntry, taskToDb, dbToTask } from "./api/supabase.js";
import { TOOLS, doWebSearch, GMAIL_SEARCH_TOOL, generateCodeVerifier, generateCodeChallenge, doGmailSearch, GMAIL_LIST_LABELS_TOOL, GMAIL_LABEL_TOOL, GMAIL_BATCH_LABEL_TOOL, GMAIL_COMPOSE_TOOL, GMAIL_SEND_TOOL, GMAIL_CREATE_LABEL_TOOL, GMAIL_LIST_FILTERS_TOOL, GMAIL_CREATE_FILTER_TOOL, GMAIL_DELETE_FILTER_TOOL, GMAIL_BULK_ACTION_TOOL, GMAIL_QUEUE_ADD_TOOL, GMAIL_SCOPE_OPTS, GMAIL_SCOPE_DISPLAY, doGmailListLabels, doGmailFetchLabelsRaw, doGmailLabel, doGmailBatchLabel, buildRawMessage, doGmailCompose, doGmailSend, doGmailCreateLabel, doGmailListFilters, doGmailCreateFilter, doGmailDeleteFilter, doGmailBulkAction, extractGmailPlainText, doGmailFetchInbox, doGmailGetMessageBody, doGmailFetchFilters } from "./api/gmailTools.js";
import { CALENDAR_SCOPE, doCalendarFetchEvents, buildRRULE, firstOccurrenceDate, parseRRULE, doCalendarCreateEvent, doCalendarDeleteEvent, doCalendarUpdateEvent, calEventStart, calEventEnd, isAllDayEvent, fmtCalTime, eventsForDay, isSameDay, getMondayOfWeek, genId, DAY_MAP, parseRecurrenceValue, parseApiResponse } from "./api/calendarApi.js";
import { todayStr, isDeferred, subtractFromDate, buildNextOccurrence, formatBubble, extractAction, extractUpdateAction, extractAddAction, extractCreateAction, extractCalendarCreateAction, extractCalendarUpdateAction, extractCalendarDeleteAction, waterfallFilter, groupByField, effortToMinutes, effortAccuracyColor, minutesToEffortLabel, MIN_CALIBRATION_SAMPLES, buildCalibrationContext, sumDescendantEffort, countDescendants, extractSuggestions, extractMetadata, getOrderedChildren, moveTaskInTree, useResizer } from "./utils/taskUtils.jsx";




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
  const { currentBucket, setCurrentBucket, addText, setAddText, showSettings, setShowSettings, showUsage, setShowUsage, nextGroupBy, setNextGroupBy, projectParentId, setProjectParentId, collapsedNodes, setCollapsedNodes, selectedTaskId, setSelectedTaskId, actualEffortPrompt, setActualEffortPrompt, pendingRollup, setPendingRollup, pendingDeferCheck, setPendingDeferCheck, dragId, setDragId, dropTarget, setDropTarget, inboxSelectedIds, setInboxSelectedIds, pendingGroupSuggestion, setPendingGroupSuggestion } = useTaskUIState();
  const { reviewProjectIdx, setReviewProjectIdx, reviewSuggestions, setReviewSuggestions, reviewReady, setReviewReady, reviewMode, setReviewMode, metadataSuggestions, setMetadataSuggestions } = useProjectReview();

  // ── Auth ───────────────────────────────────────────────────────────────
  const { authUser, authLoading, authEmail, setAuthEmail, authSent, sendMagicLink } = useSupabaseAuth();

  // true once the initial Supabase read (or migration) has completed
  const [supabaseReady, setSupabaseReady] = useState(false);
  // tracks previous tasks snapshot for write-sync diffing
  const prevTasksRef = useRef(null);
  // gates settings write-sync — flipped true after initial load/migration completes
  const settingsReadyRef = useRef(false);
  // debounce timer for settings upsert
  const settingsDebounceRef = useRef(null);
  // true when processing was triggered by 'Add & Ask AI' (single-task scope)
  const singleTaskMode = useRef(false);
  // id of the inbox task currently being processed by the AI coach
  const processingTaskId = useRef(null);
  // inbox task IDs skipped in the current processing session; reset on fresh startProcessInbox
  const skippedInSessionIds = useRef(new Set());
  // 'synced' | 'offline'
  const [syncStatus, setSyncStatus] = useState('synced');

  // Panel resize state — persisted across sessions
  const [sidebarWidth, sidebarDragDown]      = useResizer("gtd_sidebar_w",     240,                                    { min: 160, max: 420, direction: 'h', sign:  1 });
  const [coachHeight,  coachDragDown]         = useResizer("gtd_coach_h",       Math.round(window.innerHeight * 0.42), { min: 80,  max: 650, direction: 'v', sign: -1 });
  const [detailWidth,  detailDragDown]        = useResizer("gtd_detail_w",      360,                                   { min: 240, max: 600, direction: 'h', sign: -1 });
  const [chatInputHeight, chatInputDragDown]  = useResizer("gtd_chat_input_h",  60,                                    { min: 36,  max: 300, direction: 'v', sign: -1 });

  useEffect(() => {
    localStorage.setItem("gtd_tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Supabase read: fetch tasks once auth resolves; auto-migrate localStorage if empty
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase read error:', error);
          setSupabaseReady(true);
          return;
        }
        if (data && data.length > 0) {
          // Supabase has data — use it as the source of truth
          setTasks(data.map(dbToTask));
          setSupabaseReady(true);
        } else {
          // Supabase is empty — migrate from localStorage
          const local = (() => {
            try { return JSON.parse(localStorage.getItem('gtd_tasks') || '[]'); } catch { return []; }
          })();
          if (local.length > 0) {
            const rows = local.map(t => taskToDb(t, authUser.id));
            supabase.from('tasks').insert(rows).then(({ error: e2 }) => {
              if (e2) console.error('Migration failed:', e2);
              setSupabaseReady(true);
            });
          } else {
            setSupabaseReady(true);
          }
        }
      });
  }, [authUser]);

  // Supabase read: fetch user_settings once auth resolves; auto-migrate localStorage if empty
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', authUser.id)
      .single()
      .then(({ data, error }) => {
        // PGRST116 = no rows returned — treat as "not yet migrated"
        if (error && error.code !== 'PGRST116') {
          console.error('Settings load error:', error);
          settingsReadyRef.current = true;
          return;
        }
        if (data) {
          // Server wins — overwrite local state
          if (Array.isArray(data.locations)) setLocations([...data.locations].sort((a, b) => a.localeCompare(b)));
          if (Array.isArray(data.efforts)) setEfforts(data.efforts);
          if (data.calibration_overrides && typeof data.calibration_overrides === 'object')
            setCalibrationOverrides(data.calibration_overrides);
          if (Array.isArray(data.cal_skipped_tasks)) setSkippedCalendarIds(new Set(data.cal_skipped_tasks));
          if (Array.isArray(data.cal_seen_events))   setSeenCalendarEventIds(new Set(data.cal_seen_events));
          if (Array.isArray(data.cal_recurring_acknowledged)) setRecurringAcknowledgedMap(new Map(data.cal_recurring_acknowledged));
          if (typeof data.recurring_review_days === 'number') setRecurringReviewDays(data.recurring_review_days);
          settingsReadyRef.current = true;
        } else {
          // Supabase empty — migrate from localStorage
          const localLocations = (() => { try { return JSON.parse(localStorage.getItem('gtd_locations') || 'null') || ["Home","Work","Phone","Computer"]; } catch { return ["Home","Work","Phone","Computer"]; } })();
          const localEfforts   = (() => { try { return JSON.parse(localStorage.getItem('gtd_efforts')   || 'null') || DEFAULT_EFFORTS; } catch { return DEFAULT_EFFORTS; } })();
          const localCalib     = (() => { try { return JSON.parse(localStorage.getItem('gtd_effort_calibration') || 'null') || {}; } catch { return {}; } })();
          const localSkipped = (() => { try { return JSON.parse(localStorage.getItem('gtd_cal_skipped') || '[]'); } catch { return []; } })();
          supabase.from('user_settings').insert({
            user_id: authUser.id,
            locations: localLocations,
            efforts: localEfforts,
            calibration_overrides: localCalib,
            cal_skipped_tasks: localSkipped,
            cal_seen_events: [],
          }).then(({ error: e2 }) => {
            if (e2) console.error('Settings migration failed:', e2);
            settingsReadyRef.current = true;
          });
        }
      });
  }, [authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase write: diff tasks on every change and sync inserts/updates/deletes
  useEffect(() => {
    if (!authUser || !supabaseReady) { prevTasksRef.current = tasks; return; }
    const prev = prevTasksRef.current;
    prevTasksRef.current = tasks;
    if (!prev) return;

    const prevMap = new Map(prev.map(t => [t.id, t]));
    const currMap = new Map(tasks.map(t => [t.id, t]));

    const upserts = tasks.filter(t => {
      const old = prevMap.get(t.id);
      return !old || JSON.stringify(old) !== JSON.stringify(t);
    });
    const deletes = prev.filter(t => !currMap.has(t.id));
    if (!upserts.length && !deletes.length) return;

    const queuePending = (ops) => {
      const existing = JSON.parse(localStorage.getItem('gtd_pending_writes') || '[]');
      localStorage.setItem('gtd_pending_writes', JSON.stringify([...existing, ...ops]));
      setSyncStatus('offline');
    };

    if (upserts.length) {
      supabase.from('tasks')
        .upsert(upserts.map(t => taskToDb(t, authUser.id)), { onConflict: 'id' })
        .then(({ error }) => {
          if (error) {
            console.error('Supabase upsert:', error);
            queuePending(upserts.map(t => ({ type: 'upsert', row: taskToDb(t, authUser.id) })));
          } else { setSyncStatus('synced'); }
        });
    }
    if (deletes.length) {
      supabase.from('tasks').delete()
        .in('id', deletes.map(t => t.id)).eq('user_id', authUser.id)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase delete:', error);
            queuePending(deletes.map(t => ({ type: 'delete', id: t.id })));
          } else if (!upserts.length) { setSyncStatus('synced'); }
        });
    }
  }, [tasks, authUser, supabaseReady]);

  // Supabase write: debounced upsert of settings whenever locations/efforts/calibration change
  useEffect(() => {
    if (!authUser || !settingsReadyRef.current) return;
    clearTimeout(settingsDebounceRef.current);
    settingsDebounceRef.current = setTimeout(() => {
      supabase.from('user_settings')
        .upsert({
          user_id: authUser.id,
          locations,
          efforts,
          calibration_overrides: calibrationOverrides,
          cal_skipped_tasks: [...skippedCalendarIds],
          cal_seen_events:   [...seenCalendarEventIds],
          cal_recurring_acknowledged: [...recurringAcknowledgedMap.entries()],
          recurring_review_days: recurringReviewDays,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.error('Settings sync error:', error);
          else setSyncStatus('synced');
        });
    }, 1500);
    return () => clearTimeout(settingsDebounceRef.current);
  }, [locations, efforts, calibrationOverrides, skippedCalendarIds, seenCalendarEventIds, recurringAcknowledgedMap, recurringReviewDays, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: keep localStorage in sync for unauthenticated sessions
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_cal_skipped',     JSON.stringify([...skippedCalendarIds]));
  }, [skippedCalendarIds, authUser]);
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_cal_seen_events', JSON.stringify([...seenCalendarEventIds]));
  }, [seenCalendarEventIds, authUser]);
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_cal_recurring_ack', JSON.stringify([...recurringAcknowledgedMap.entries()]));
  }, [recurringAcknowledgedMap, authUser]);
  useEffect(() => {
    if (!authUser) localStorage.setItem('gtd_recurring_review_days', String(recurringReviewDays));
  }, [recurringReviewDays, authUser]);

  // Phase 6 — offline resilience: flush pending writes when connectivity returns
  useEffect(() => {
    const flushPending = async () => {
      const raw = localStorage.getItem('gtd_pending_writes');
      if (!raw || !authUser) return;
      const pending = JSON.parse(raw);
      if (!pending?.length) return;
      const upserts = pending.filter(p => p.type === 'upsert');
      const deletes = pending.filter(p => p.type === 'delete');
      let ok = true;
      if (upserts.length) {
        const { error } = await supabase.from('tasks')
          .upsert(upserts.map(p => p.row), { onConflict: 'id' });
        if (error) { console.error('Flush upsert failed:', error); ok = false; }
      }
      if (ok && deletes.length) {
        const { error } = await supabase.from('tasks').delete()
          .in('id', deletes.map(p => p.id)).eq('user_id', authUser.id);
        if (error) { console.error('Flush delete failed:', error); ok = false; }
      }
      if (ok) {
        localStorage.removeItem('gtd_pending_writes');
        setSyncStatus('synced');
      }
    };
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    window.addEventListener('online', flushPending);
    window.addEventListener('offline', () => setSyncStatus('offline'));
    return () => {
      window.removeEventListener('online', flushPending);
      window.removeEventListener('offline', () => setSyncStatus('offline'));
    };
  }, [authUser]);

  // Phase 7 — realtime: receive changes from other devices
  useEffect(() => {
    if (!authUser || !supabaseReady) return;
    const channel = supabase
      .channel(`tasks-${authUser.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks',
        filter: `user_id=eq.${authUser.id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const incoming = dbToTask(payload.new);
          setTasks(prev => {
            const idx = prev.findIndex(t => t.id === incoming.id);
            if (idx === -1) return [incoming, ...prev];
            const next = [...prev];
            next[idx] = incoming;
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [authUser, supabaseReady]);

  // Load gmail_queue from Supabase on auth ready, merge with any localStorage entries
  useEffect(() => {
    if (!authUser || !supabaseReady) return;
    supabase.from('gmail_queue').select('*').eq('user_id', authUser.id).then(({ data, error }) => {
      if (error) { console.error('gmail_queue load error', error); return; }
      if (!data || data.length === 0) return;
      const fromServer = data.map(rowToQueueEntry);
      setGmailQueue(prev => {
        const serverIds = new Set(fromServer.map(e => e.id));
        const localOnly = prev.filter(e => !serverIds.has(e.id));
        return [...fromServer, ...localOnly];
      });
    });
  }, [authUser, supabaseReady]); // eslint-disable-line

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

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${OPENWEBUI_URL}/api/models`, {
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}` },
      });
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      if (models.length) setAvailableModels(models);
    } catch { /* Open WebUI not reachable — fail silently */ }
  }, []);

  useEffect(() => {
    if (provider === "local") fetchModels();
  }, [provider, fetchModels]);



  const callAI = useCallback(async (userMsg, mode, history) => {
    // Inject calibration context only for modes that suggest effort estimates
    const calibCtx = (mode === "process" || mode === "projectMetadata")
      ? buildCalibrationContext(tasks, efforts, calibrationOverrides)
      : "";
    const systemPrompt = SYSTEM_PROMPTS[mode] + calibCtx + "\n\n[Current Task List]\n" + getTaskContext();
    const newHistory = [...history, { role: "user", content: userMsg }];

    setLoading(true);
    try {
      let reply;

      if (provider === "claude") {
        let apiMessages = [...newHistory];
        let loopCount = 0;
        while (loopCount < 15) {
          loopCount++;
          const reqBody = {
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            system: systemPrompt,
            messages: apiMessages,
          };
          if (mode === "chat") {
            const availableTools = [];
            if (import.meta.env.VITE_TAVILY_API_KEY) availableTools.push(...TOOLS);
            if (googleToken) {
              availableTools.push(GMAIL_SEARCH_TOOL);
              if (googleScope === 'modify' || googleScope === 'compose' || googleScope === 'send') {
                availableTools.push(GMAIL_LIST_LABELS_TOOL);
                availableTools.push(GMAIL_LABEL_TOOL);
                availableTools.push(GMAIL_BATCH_LABEL_TOOL);
                availableTools.push(GMAIL_CREATE_LABEL_TOOL);
                availableTools.push(GMAIL_LIST_FILTERS_TOOL);
                availableTools.push(GMAIL_CREATE_FILTER_TOOL);
                availableTools.push(GMAIL_DELETE_FILTER_TOOL);
                availableTools.push(GMAIL_BULK_ACTION_TOOL);
                availableTools.push(GMAIL_QUEUE_ADD_TOOL);
              }
              if (googleScope === 'compose' || googleScope === 'send')
                availableTools.push(GMAIL_COMPOSE_TOOL);
              if (googleScope === 'send')
                availableTools.push(GMAIL_SEND_TOOL);
            }
            if (availableTools.length > 0) reqBody.tools = availableTools;
          }
          if (loopCount > 1) {
            setMessages(prev => [...prev, { role: "assistant", text: `⏳ Thinking... (step ${loopCount})`, isSearchChip: true }]);
          }
          const reqStart = Date.now();
          const abortCtrl = new AbortController();
          const abortTimer = setTimeout(() => abortCtrl.abort(), 90000);
          let res, data;
          try {
            res = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
              },
              body: JSON.stringify(reqBody),
              signal: abortCtrl.signal,
            });
            data = await res.json();
          } catch (fetchErr) {
            if (fetchErr.name === 'AbortError') throw new Error('Request timed out after 90 seconds — try a simpler request or break it into smaller steps.');
            throw fetchErr;
          } finally {
            clearTimeout(abortTimer);
          }
          if (!res.ok || data.error) {
            throw new Error(`Anthropic error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
          }
          if (data.usage) recordUsage(data.usage.input_tokens || 0, data.usage.output_tokens || 0, Date.now() - reqStart, mode, 'claude');
          if (data.stop_reason === "tool_use") {
            const toolUseBlocks = data.content.filter(b => b.type === "tool_use");
            const toolResults = [];
            for (const toolUse of toolUseBlocks) {
              if (toolUse.name === "web_search") {
                const query = toolUse.input.query;
                setMessages(prev => [...prev, {
                  role: "assistant", text: `🔍 Searching: "${query}"`, isSearchChip: true,
                }]);
                try {
                  const result = await doWebSearch(query);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_search") {
                const query = toolUse.input.query;
                setMessages(prev => [...prev, {
                  role: "assistant", text: `📧 Searching Gmail: "${query}"`, isSearchChip: true,
                }]);
                try {
                  const result = await doGmailSearch(query, googleToken, toolUse.input.max_results || 10);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_list_labels") {
                try {
                  const result = await doGmailListLabels(googleToken);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_create_label") {
                try {
                  const result = await doGmailCreateLabel(toolUse.input.name, googleToken);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_list_filters") {
                try {
                  const result = await doGmailListFilters(googleToken);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_create_filter") {
                setMessages(prev => [...prev, { role: "assistant", text: `🔧 Creating filter...`, isSearchChip: true }]);
                try {
                  const result = await doGmailCreateFilter(
                    toolUse.input.criteria_from, toolUse.input.criteria_to,
                    toolUse.input.criteria_subject, toolUse.input.criteria_query,
                    toolUse.input.action_add_label_ids, toolUse.input.action_remove_label_ids,
                    googleToken
                  );
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_delete_filter") {
                try {
                  const result = await doGmailDeleteFilter(toolUse.input.filter_id, googleToken);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_batch_label") {
                setMessages(prev => [...prev, { role: "assistant", text: `🏷️ Labelling ${toolUse.input.message_ids?.length || 0} message(s)...`, isSearchChip: true }]);
                try {
                  const result = await doGmailBatchLabel(
                    toolUse.input.message_ids, toolUse.input.add_label_ids,
                    toolUse.input.remove_label_ids, googleToken
                  );
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_bulk_action") {
                setMessages(prev => [...prev, { role: "assistant", text: `🏷️ Bulk action: searching all matching emails…`, isSearchChip: true }]);
                try {
                  const result = await doGmailBulkAction(
                    toolUse.input.query, toolUse.input.add_label_ids,
                    toolUse.input.remove_label_ids, googleToken
                  );
                  setMessages(prev => [...prev, { role: "assistant", text: `✅ Bulk action complete — ${result.succeeded ?? 0} message(s) updated.`, isSearchChip: true }]);
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_queue_add") {
                try {
                  const entry = {
                    id: genId(),
                    savedAt: new Date().toISOString(),
                    labelName:    toolUse.input.label_name,
                    labelId:      toolUse.input.label_id || null,
                    query:        toolUse.input.query,
                    description:  toolUse.input.description,
                    archive:      toolUse.input.archive !== false,
                    createFilter: toolUse.input.create_filter !== false,
                    status: 'pending',
                  };
                  setGmailQueue(prev => [entry, ...prev]);
                  if (authUser) {
                    supabase.from('gmail_queue').upsert(queueEntryToRow(entry, authUser.id)).then(({ error }) => {
                      if (error) console.error('gmail_queue upsert error', error);
                    });
                  }
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify({ status: 'Saved to cleanup queue', id: entry.id }) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_label") {
                try {
                  const result = await doGmailLabel(
                    toolUse.input.message_id, toolUse.input.add_label_ids,
                    toolUse.input.remove_label_ids, googleToken
                  );
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_compose") {
                setMessages(prev => [...prev, { role: "assistant", text: `✏️ Creating draft...`, isSearchChip: true }]);
                try {
                  const result = await doGmailCompose(
                    toolUse.input.to, toolUse.input.subject, toolUse.input.body,
                    toolUse.input.thread_id, googleToken
                  );
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              } else if (toolUse.name === "gmail_send") {
                setMessages(prev => [...prev, { role: "assistant", text: `📤 Sending email...`, isSearchChip: true }]);
                try {
                  const result = await doGmailSend(
                    toolUse.input.to, toolUse.input.subject, toolUse.input.body,
                    toolUse.input.thread_id, googleToken
                  );
                  toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
                } catch (e) { toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, is_error: true, content: e.message }); }
              }
            }
            // Ensure every tool_use block has a result (empty content triggers Anthropic 400)
            for (const tu of toolUseBlocks) {
              if (!toolResults.find(r => r.tool_use_id === tu.id)) {
                toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: "(no result)" });
              }
            }
            apiMessages = [
              ...apiMessages,
              { role: "assistant", content: data.content },
              { role: "user", content: toolResults },
            ];
          } else {
            reply = data.content?.find(b => b.type === "text")?.text || "Sorry, something went wrong.";
            break;
          }
        }
        if (!reply) reply = "I ran out of steps before finishing — the operation may be too complex for one turn. Try breaking it into smaller requests (e.g. one sender at a time).";
      } else {
        const ollamaStart = Date.now();
        const res = await fetch(`${OPENWEBUI_URL}/api/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_OPENWEBUI_API_KEY}`,
          },
          body: JSON.stringify({
            model: localModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...newHistory,
            ],
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(`Open WebUI error ${res.status}: ${data.error?.message || JSON.stringify(data)}`);
        }
        if (data.usage) recordUsage(data.usage.prompt_tokens || 0, data.usage.completion_tokens || 0, Date.now() - ollamaStart, mode, 'ollama');
        reply = data.choices?.[0]?.message?.content || "Sorry, something went wrong.";
      }

      const updatedHistory = [...newHistory, { role: "assistant", content: reply }];
      setChatHistory(updatedHistory);

      // Apply →ACTION lines when in chat mode — supports multiple actions per response
      let updateChip = null;
      let actionError = null;
      if (mode === "chat") {
        const taskActionLines = reply.split('\n')
          .map(l => l.trim())
          .filter(l => /^→ACTION:(update|add|create)\|/.test(l));

        if (taskActionLines.length > 0) {
          // Process all actions against a local working copy so parent lookups
          // work across the batch (e.g. create parent then add children in same response)
          let workingTasks = [...tasks];
          const chips = [];
          const actionErrors = [];

          for (const line of taskActionLines) {
            const upd = extractUpdateAction(line);
            if (upd) {
              const target = workingTasks.find(t => t.id === upd.taskId);
              if (target) {
                workingTasks = workingTasks.map(t =>
                  t.id === upd.taskId ? { ...t, ...upd.changes } : t
                );
                const fieldLabels = Object.keys(upd.changes).map(k => ({
                  notes: 'notes', dueDate: 'due date', deferUntil: 'defer date',
                  effort: 'effort', actualEffort: 'actual effort', text: 'title', bucket: 'bucket',
                  priority: 'priority', location: 'location', recurrence: 'recurrence',
                }[k] || k));
                chips.push({ taskName: target.text, fields: fieldLabels });
              } else {
                actionErrors.push(`⚠ Action failed: no task found with ID "${upd.taskId}". The task may have been deleted or the ID is incorrect.`);
              }
              continue;
            }

            const add = extractAddAction(line);
            if (add) {
              const { title, parentId: parentRef, bucket = "next", dueDate = null,
                      deferUntil = null, effort = null, location = [], recurrence = null } = add;
              // ID lookup first; fall back to exact title match (supports newly-created parents)
              const parent = workingTasks.find(t => t.id === parentRef)
                          || workingTasks.find(t => t.text.toLowerCase() === parentRef.toLowerCase());
              if (parent) {
                const newId = genId();
                const newTask = {
                  id: newId, text: title, bucket, done: false, created: Date.now(),
                  parentId: parent.id, priority: [], location, dueDate, effort,
                  actualEffort: null, deferUntil, notes: null, recurrence,
                };
                workingTasks = [
                  ...workingTasks.map(t => t.id === parent.id
                    ? { ...t, childIds: [...(t.childIds || []), newId] }
                    : t
                  ),
                  newTask,
                ];
                chips.push({ taskName: title, fields: ["added under " + parent.text] });
              } else {
                actionErrors.push(`⚠ Action failed: no task found with ID or title "${parentRef}". The parent may not exist or has been deleted.`);
              }
              continue;
            }

            const create = extractCreateAction(line);
            if (create) {
              const { title, bucket, dueDate = null, dueTime = null, deferUntil = null,
                      effort = null, location = [], recurrence = null } = create;
              const newId = genId();
              const newTask = {
                id: newId, text: title, bucket, done: false, created: Date.now(),
                priority: [], location, dueDate, dueTime, effort, actualEffort: null,
                deferUntil, notes: null, recurrence,
              };
              workingTasks = [newTask, ...workingTasks];
              chips.push({ taskName: title, fields: ["created in " + bucket] });
            }
          }

          // Commit all mutations in one setTasks call
          setTasks(workingTasks);

          if (chips.length === 1) {
            updateChip = chips[0];
          } else if (chips.length > 1) {
            updateChip = { taskName: `${chips.length} tasks`, fields: ["created/updated"] };
          }
          if (actionErrors.length > 0) {
            actionError = actionErrors.join('\n');
          }
        }
      }

      if (googleToken && calendarEnabled) {
        const calCreate = extractCalendarCreateAction(reply);
        const calUpdate = extractCalendarUpdateAction(reply);
        const calDelete = extractCalendarDeleteAction(reply);
        if (calCreate) {
          try {
            const ev = await doCalendarCreateEvent(googleToken, {
              summary: calCreate.title, description: calCreate.description || '',
              date: calCreate.date, startTime: calCreate.startTime, endTime: calCreate.endTime,
              attendees: calCreate.attendees, sendUpdates: calCreate.sendUpdates,
              recurrence: calCreate.recurrence || null,
            });
            setCalendarEvents(prev => [...prev, ev]);
            if (calCreate.taskId) {
              setTasks(prev => prev.map(t => t.id === calCreate.taskId ? { ...t, calendarEventId: ev.id } : t));
            } else {
              const newId = genId();
              setTasks(prev => [{
                id: newId, text: calCreate.title, bucket: 'inbox', done: false, created: Date.now(),
                priority: [], location: [], dueDate: calCreate.date, effort: null, actualEffort: null,
                deferUntil: null, notes: calCreate.description || null, recurrence: null,
                calendarEventId: ev.id,
              }, ...prev]);
            }
            updateChip = { taskName: calCreate.title, fields: ['created in Google Calendar', 'added to Inbox'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        } else if (calUpdate) {
          try {
            const ev = await doCalendarUpdateEvent(googleToken, calUpdate.eventId, {
              summary: calUpdate.title, date: calUpdate.date,
              startTime: calUpdate.startTime, endTime: calUpdate.endTime,
              attendees: calUpdate.attendees, sendUpdates: calUpdate.sendUpdates,
            });
            setCalendarEvents(prev => prev.map(e => e.id === ev.id ? ev : e));
            if (calUpdate.taskId) {
              setTasks(prev => prev.map(t => t.id === calUpdate.taskId ? { ...t, dueDate: calUpdate.date } : t));
            }
            updateChip = { taskName: calUpdate.title || calUpdate.eventId, fields: ['updated in Google Calendar'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        } else if (calDelete) {
          try {
            const delResult = await doCalendarDeleteEvent(googleToken, calDelete.eventId);
            if (delResult) {
              const { masterEventId, cutoffDateStr } = delResult;
              setCalendarEvents(prev => prev.filter(e => {
                const eId = e.recurringEventId || e.id;
                if (eId !== masterEventId && e.id !== masterEventId) return true;
                if (cutoffDateStr === null) return false;
                const eStart = e.start?.date || e.start?.dateTime?.slice(0, 10);
                return eStart && eStart < cutoffDateStr;
              }));
              setTasks(prev => prev.map(t =>
                (t.calendarEventId === calDelete.eventId || t.calendarEventId === masterEventId)
                  ? { ...t, calendarEventId: null } : t
              ));
            } else {
              setCalendarEvents(prev => prev.filter(e => e.id !== calDelete.eventId));
              setTasks(prev => prev.map(t => t.calendarEventId === calDelete.eventId ? { ...t, calendarEventId: null } : t));
            }
            updateChip = { taskName: 'Calendar event', fields: ['deleted from Google Calendar'] };
          } catch (e) { actionError = `⚠ Calendar action failed: ${e.message}`; }
        }
      }

      if (actionError) {
        setMessages(prev => [...prev,
          { role: "assistant", text: reply, updateChip },
          { role: "assistant", text: actionError },
        ]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: reply, updateChip }]);
      }

      const action = extractAction(reply);
      if (action) setPendingAction(action);

      return reply;
    } catch (e) {
      console.error("[callAI error]", e);
      const err = `Error: ${e.message}`;
      setMessages(prev => [...prev, { role: "assistant", text: err }]);
    } finally {
      setLoading(false);
    }
  }, [getTaskContext, tasks, efforts, calibrationOverrides, provider, localModel, googleToken, googleScope, calendarEnabled, setCalendarEvents]);

  const sendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || loading) return;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    await callAI(text, coachMode, chatHistory);
  }, [chatInput, loading, coachMode, chatHistory, callAI]);

  const switchCoachMode = useCallback((mode, introMsg) => {
    setCoachMode(mode);
    setChatHistory([]);
    setPendingAction(null);
    setMessages([{ role: "assistant", text: introMsg }]);
  }, []);

  const processNextInboxItem = useCallback(async (task) => {
    processingTaskId.current = task.id;
    setPendingAction(null);
    setChatHistory([]);
    const prompt = `Process this GTD inbox item: "${task.text}"`;
    setMessages(prev => [...prev, { role: "user", text: `Processing: **"${task.text}"**` }]);
    await callAI(prompt, "process", []);
  }, [callAI]);

  const handleConfirmMove = useCallback(() => {
    if (!pendingAction) return;
    const { type, title, nextAction, dueDate: aiDue, deferUntil: aiDefer } = pendingAction;

    const current = tasks.find(t => t.id === processingTaskId.current)
      ?? tasks.filter(t => t.bucket === "inbox")[0];
    const nextItem = tasks.filter(t => t.bucket === "inbox" && t.id !== current?.id && !skippedInSessionIds.current.has(t.id))[0];

    if (!current) return;

    // Archive the original inbox item
    setTasks(prev => prev.map(t =>
      t.id === current.id ? { ...t, bucket: "inboxHistory" } : t
    ));

    // Create new tasks based on action type, applying any AI-suggested dates
    if (type === "next") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "next", done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null }, ...prev]);
    } else if (type === "project") {
      const projectId = genId();
      const actionId = genId();
      setTasks(prev => [
        { id: projectId, text: title || current.text, bucket: "project", done: false, created: Date.now(), childIds: [actionId], priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null },
        { id: actionId, text: nextAction || title, bucket: "next", done: false, created: Date.now(), parentId: projectId, priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null },
        ...prev,
      ]);
    } else if (type === "someday") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "someday", done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null }, ...prev]);
    } else if (type === "waiting") {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: "waiting", done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, notes: null }, ...prev]);
    }
    // type === "delete": just archive, no new task

    setPendingAction(null);

    // Auto-continue to next inbox item (skip in single-task mode)
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
      setMessages(prev => [...prev, { role: "assistant", text: "✅ **Done!** Your task has been processed and filed." }]);
    } else {
      setMessages(prev => [...prev, { role: "assistant", text: "🎉 **Inbox is clear!** Every item has been processed. Well done." }]);
    }
  }, [pendingAction, tasks, processNextInboxItem]);

  const handleSkipPendingAction = useCallback(() => {
    const current = tasks.find(t => t.id === processingTaskId.current);
    skippedInSessionIds.current.add(processingTaskId.current);
    const nextItem = tasks.filter(t => t.bucket === "inbox" && t.id !== processingTaskId.current && !skippedInSessionIds.current.has(t.id))[0];
    setPendingAction(null);
    if (current) {
      setMessages(prev => [...prev, { role: "assistant", text: `⏭ Skipping **"${current.text}"** — it stays in your inbox for later.` }]);
    }
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
    } else {
      setMessages(prev => [...prev, { role: "assistant", text: "🎉 **All caught up!** Any skipped items remain in your inbox." }]);
    }
  }, [tasks, processNextInboxItem]);

  const handleDeleteInboxItem = useCallback(() => {
    const current = tasks.find(t => t.id === processingTaskId.current)
      ?? tasks.filter(t => t.bucket === "inbox")[0];
    if (!current) return;
    setTasks(prev => prev.map(t => t.id === current.id ? { ...t, bucket: "inboxHistory" } : t));
    const nextItem = tasks.filter(t => t.bucket === "inbox" && t.id !== current.id && !skippedInSessionIds.current.has(t.id))[0];
    setPendingAction(null);
    setMessages(prev => [...prev, { role: "assistant", text: `🗑 Deleted **"${current.text}"**.` }]);
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
    } else {
      setMessages(prev => [...prev, { role: "assistant", text: "🎉 **All caught up!** Inbox fully processed." }]);
    }
  }, [tasks, processNextInboxItem]);

  const startProcessInbox = useCallback(async () => {
    singleTaskMode.current = false;
    skippedInSessionIds.current = new Set();
    setCurrentBucket("inbox");
    const inbox = tasks.filter(t => t.bucket === "inbox");
    if (inbox.length === 0) {
      switchCoachMode("process", "Your inbox is empty — nothing to process! Add some tasks first or do a Brain Dump.");
      return;
    }
    switchCoachMode("process", `You have **${inbox.length} item${inbox.length > 1 ? "s" : ""}** in your inbox. Processing them one by one…`);
    setTimeout(() => processNextInboxItem(inbox[0]), 100);
  }, [tasks, switchCoachMode, processNextInboxItem]);

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

  const askAIAboutTask = useCallback(async (task) => {
    setCurrentBucket("inbox");
    singleTaskMode.current = true;
    switchCoachMode("process", `Let's clarify: **"${task.text}"**`);
    setTimeout(() => processNextInboxItem(task), 100);
  }, [switchCoachMode, processNextInboxItem]);

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

  const handleProjectDragStart = useCallback((id) => {
    setDragId(id);
    setDropTarget(null);
  }, []);

  const handleProjectDragOver = useCallback((e, taskId) => {
    if (taskId === dragId) return;                          // don't target self
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const position = ratio < 0.33 ? "before" : ratio > 0.67 ? "after" : "inside";
    setDropTarget(prev =>
      prev?.id === taskId && prev?.position === position ? prev : { id: taskId, position }
    );
  }, [dragId]);

  const handleProjectDragEnd = useCallback(() => {
    setDragId(null);
    setDropTarget(null);
  }, []);

  const handleProjectDrop = useCallback((targetId) => {
    setDropTarget(prev => {
      if (prev && dragId) {
        setTasks(all => moveTaskInTree(all, dragId, targetId, prev.position));
      }
      return null;
    });
    setDragId(null);
  }, [dragId]);

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
