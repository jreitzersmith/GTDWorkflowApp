import { useCallback, useRef } from 'react';
import { genId } from '../calendar/calendarApi.js';
import { normalizeEffort } from './taskUtils.jsx';

/**
 * Owns all inbox-processing logic: AI-driven item processing, confirm/skip/delete
 * actions on the pending suggestion bar, the full-inbox start flow, and the
 * single-task "Add & Ask AI" entry point.
 *
 * @param {{
 *   tasks: Array, pendingAction: object|null,
 *   singleTaskMode: React.MutableRefObject<boolean>,
 *   processingTaskId: React.MutableRefObject<string|null>,
 *   skippedInSessionIds: React.MutableRefObject<Set<string>>,
 *   setTasks: Function, setCurrentBucket: Function,
 *   setMessages: Function, setChatHistory: Function,
 *   setPendingAction: Function,
 *   callAI: Function, switchCoachMode: Function,
 *   onSessionTasksCreated: Function,
 * }} params
 * @returns {{
 *   processNextInboxItem: Function,
 *   handleConfirmMove: Function,
 *   handleSkipPendingAction: Function,
 *   handleDeleteInboxItem: Function,
 *   startProcessInbox: Function,
 *   askAIAboutTask: Function,
 * }}
 */
function useInboxProcessing({
  tasks, pendingAction, efforts,
  uncategorizedProjectId,
  singleTaskMode, processingTaskId, skippedInSessionIds,
  setTasks, setCurrentBucket,
  setMessages, setChatHistory,
  setPendingAction,
  callAI, switchCoachMode,
  onSessionTasksCreated,
  onTaskReplaced,
}) {
  // Tracks tasks created during this processing session (for FR#8 group suggestion).
  const sessionCreatedTasksRef = useRef([]);

  const processNextInboxItem = useCallback(async (task) => {
    processingTaskId.current = task.id;
    setPendingAction(null);
    setChatHistory([]);
    const prompt = `Process this GTD inbox item: "${task.text}"`;
    setMessages(prev => [...prev, { role: 'user', text: `Processing: **"${task.text}"**` }]);
    await callAI(prompt, 'process', []);
  }, [callAI, processingTaskId, setPendingAction, setChatHistory, setMessages]);

  const handleConfirmMove = useCallback(() => {
    if (!pendingAction) return;
    const { type, title, nextAction, parentRef, dueDate: aiDue, deferUntil: aiDefer, recurrence: aiRecurrence, effort: aiEffort, category: aiCategory, priority: aiPriority, location: aiLocation, isSomeday: aiSomeday, isWaitingFor: aiWaitingFor, notes: aiNotes } = pendingAction;

    // Only treat as inbox context when a formal processing session is active
    // (processingTaskId is set). Falling back to the first inbox item caused review-mode
    // confirmations to accidentally archive inbox tasks and show 'inbox cleared'.
    const current = tasks.find(t => t.id === processingTaskId.current) ?? null;
    const nextItem = current
      ? tasks.filter(t => t.bucket === 'inbox' && t.id !== current.id && !skippedInSessionIds.current.has(t.id))[0]
      : null;

    // current may be null when the pending action was triggered from chat/review (not inbox processing).
    // In that case skip archiving and inbox advancement; just create the task.
    const hasInboxContext = !!current;

    if (hasInboxContext) {
      // Archive the original inbox item
      setTasks(prev => prev.map(t =>
        t.id === current.id ? { ...t, bucket: 'inboxHistory' } : t
      ));
    }

    // Create new tasks based on action type, applying any AI-suggested dates
    if (type === 'next') {
      const newId = genId();
      const newTask = { id: newId, text: title || current?.text || '', bucket: 'project', isNextAction: true, done: false, created: Date.now(), priority: aiPriority || [], location: aiLocation || [], dueDate: aiDue || null, effort: normalizeEffort(aiEffort, efforts) || null, actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: aiNotes || null, category: aiCategory || null, reviewed: true, ...(aiSomeday ? { isSomeday: true } : {}), ...(aiWaitingFor ? { isWaitingFor: true } : {}), ...(uncategorizedProjectId ? { parentId: uncategorizedProjectId } : {}), ...(current?.contactId ? { contactId: current.contactId } : {}) };
      sessionCreatedTasksRef.current.push({ id: newId, text: newTask.text });
      setTasks(prev => {
        if (uncategorizedProjectId) {
          return [newTask, ...prev.map(t => t.id === uncategorizedProjectId ? { ...t, childIds: [...(t.childIds || []), newId] } : t)];
        }
        return [newTask, ...prev];
      });
      if (hasInboxContext) onTaskReplaced?.(current.id, newId);
    } else if (type === 'project') {
      const projectId = genId();
      const actionId = genId();
      // Resolve optional parent (category or subcategory) by ID or exact title
      const parentNode = parentRef
        ? (tasks.find(t => t.id === parentRef) || tasks.find(t => t.text.toLowerCase() === (parentRef || '').toLowerCase()))
        : null;
      setTasks(prev => [
        { id: projectId, text: title || current?.text || '', bucket: 'project', done: false, created: Date.now(), childIds: [actionId], priority: aiPriority || [], location: aiLocation || [], dueDate: aiDue || null, effort: normalizeEffort(aiEffort, efforts) || null, actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: aiNotes || null, category: aiCategory || parentNode?.category || null, reviewed: true, ...(aiSomeday ? { isSomeday: true } : {}), ...(aiWaitingFor ? { isWaitingFor: true } : {}), ...(parentNode ? { parentId: parentNode.id } : {}), ...(current?.contactId ? { contactId: current.contactId } : {}) },
        { id: actionId, text: nextAction || title, bucket: 'project', isNextAction: true, done: false, created: Date.now(), parentId: projectId, priority: aiPriority || [], location: aiLocation || [], dueDate: null, effort: null, actualEffort: null, deferUntil: aiDefer || null, recurrence: null, notes: aiNotes || null, category: null, reviewed: true },
        ...prev.map(t => t.id === parentNode?.id ? { ...t, childIds: [...(t.childIds || []), projectId] } : t),
      ]);
      if (hasInboxContext) onTaskReplaced?.(current.id, projectId);
      // type === 'project' already has its own project structure — omit from group suggestion
    } else if (type === 'someday') {
      const newId = genId();
      const taskText = title || current.text;
      sessionCreatedTasksRef.current.push({ id: newId, text: taskText });
      setTasks(prev => {
        const newTask = { id: newId, text: taskText, bucket: 'project', isSomeday: true, done: false, created: Date.now(), priority: aiPriority || [], location: aiLocation || [], dueDate: aiDue || null, effort: normalizeEffort(aiEffort, efforts) || null, actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: aiNotes || null, category: aiCategory || null, reviewed: true, ...(uncategorizedProjectId ? { parentId: uncategorizedProjectId } : {}), ...(current?.contactId ? { contactId: current.contactId } : {}) };
        if (uncategorizedProjectId) {
          return [newTask, ...prev.map(t => t.id === uncategorizedProjectId ? { ...t, childIds: [...(t.childIds || []), newId] } : t)];
        }
        return [newTask, ...prev];
      });
      if (hasInboxContext) onTaskReplaced?.(current.id, newId);
    } else if (type === 'waiting') {
      const newId = genId();
      const taskText = title || current.text;
      sessionCreatedTasksRef.current.push({ id: newId, text: taskText });
      setTasks(prev => {
        const newTask = { id: newId, text: taskText, bucket: 'project', isWaitingFor: true, done: false, created: Date.now(), priority: aiPriority || [], location: aiLocation || [], dueDate: aiDue || null, effort: normalizeEffort(aiEffort, efforts) || null, actualEffort: null, deferUntil: aiDefer || null, recurrence: null, notes: aiNotes || null, category: aiCategory || null, reviewed: true, ...(uncategorizedProjectId ? { parentId: uncategorizedProjectId } : {}), ...(current?.contactId ? { contactId: current.contactId } : {}) };
        if (uncategorizedProjectId) {
          return [newTask, ...prev.map(t => t.id === uncategorizedProjectId ? { ...t, childIds: [...(t.childIds || []), newId] } : t)];
        }
        return [newTask, ...prev];
      });
      if (hasInboxContext) onTaskReplaced?.(current.id, newId);
    } else if (type === 'add') {
      // Add as child of existing project (ID or title lookup)
      // Do NOT push to sessionCreatedTasksRef — add-type tasks already have a parent
      // and don't need the post-session group suggestion.
      const _prl = (parentRef || '').toLowerCase();
      const parent = tasks.find(t => t.id === parentRef)
                  || tasks.find(t => t.text.toLowerCase() === _prl)
                  || tasks.find(t => t.bucket === 'project' && !t.done && (t.text.toLowerCase().includes(_prl) || _prl.includes(t.text.toLowerCase())));
      const childId = genId();
      const taskText = title || current.text;
      if (parent) {
        setTasks(prev => [
          ...prev.map(t => t.id === parent.id ? { ...t, childIds: [...(t.childIds || []), childId] } : t),
          { id: childId, text: taskText, bucket: 'project', isNextAction: true, done: false, created: Date.now(),
            parentId: parent.id, priority: aiPriority || [], location: aiLocation || [], dueDate: aiDue || null, effort: normalizeEffort(aiEffort, efforts) || null,
            actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: aiNotes || null,
            category: aiCategory || parent.category || null, reviewed: true, ...(current?.contactId ? { contactId: current.contactId } : {}) },
        ]);
      } else {
        // Parent not found — fall back to UnCategorized project
        const fallbackTask = { id: childId, text: taskText, bucket: 'project', isNextAction: true, done: false,
          created: Date.now(), priority: aiPriority || [], location: aiLocation || [], dueDate: aiDue || null, effort: normalizeEffort(aiEffort, efforts) || null,
          actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: aiNotes || null, category: aiCategory || null, reviewed: true,
          ...(uncategorizedProjectId ? { parentId: uncategorizedProjectId } : {}), ...(current?.contactId ? { contactId: current.contactId } : {}) };
        setTasks(prev => {
          if (uncategorizedProjectId) {
            return [fallbackTask, ...prev.map(t => t.id === uncategorizedProjectId ? { ...t, childIds: [...(t.childIds || []), childId] } : t)];
          }
          return [fallbackTask, ...prev];
        });
      }
      if (hasInboxContext) onTaskReplaced?.(current.id, childId);
    } else if (type === 'update') {
      // Direct field update — used by review mode to mark tasks done, change bucket flags, etc.
      const { taskId, changes } = pendingAction;
      const today = new Date().toISOString().split('T')[0];
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t;
        const resolved = { ...changes };
        if (resolved.done === true) {
          resolved.bucket = 'done';
          resolved.completedDate = today;
        }
        // Activating from Someday: ensure isNextAction is set so the task
        // appears in the Next Actions view (flag-based, not bucket-based).
        if (resolved.isSomeday === false && !t.isNextAction) {
          resolved.isNextAction = true;
        }
        return { ...t, ...resolved };
      }));
    }
    // type === 'delete': just archive, no new task

    setPendingAction(null);

    // Only auto-advance inbox when this action came from formal inbox processing
    if (!hasInboxContext) return;

    // Auto-continue to next inbox item (skip in single-task mode)
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
      setMessages(prev => [...prev, { role: 'assistant', text: '✅ **Done!** Your task has been processed and filed.' }]);
    } else {
      // Inbox cleared — offer project grouping if 2+ action tasks were created this session
      const created = sessionCreatedTasksRef.current;
      if (created.length >= 2 && onSessionTasksCreated) {
        onSessionTasksCreated(created.map(t => t.id), created.map(t => t.text));
      }
      setMessages(prev => [...prev, { role: 'assistant', text: '🎉 **All items processed.** Your inbox is clear — well done.' }]);
    }
  }, [pendingAction, tasks, processingTaskId, skippedInSessionIds, singleTaskMode,
      setTasks, setPendingAction, setMessages, processNextInboxItem, onSessionTasksCreated, onTaskReplaced]);

  const handleSkipPendingAction = useCallback(() => {
    const current = tasks.find(t => t.id === processingTaskId.current);
    // Only treat as inbox context when processingTaskId points to a task actively
    // in the inbox bucket. If it is stale (from a prior session) or this dismiss
    // came from a non-inbox pending action (e.g. contact enrichment), skip auto-advance.
    const hasInboxContext = !!current && current.bucket === 'inbox';
    if (hasInboxContext) {
      skippedInSessionIds.current.add(processingTaskId.current);
    }
    const nextItem = hasInboxContext
      ? tasks.filter(t => t.bucket === 'inbox' && t.id !== processingTaskId.current && !skippedInSessionIds.current.has(t.id))[0]
      : null;
    setPendingAction(null);
    if (hasInboxContext && current) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⏭ Skipping **"${current.text}"** — it stays in your inbox for later.` }]);
    }
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (hasInboxContext && singleTaskMode.current) {
      singleTaskMode.current = false;
    } else if (hasInboxContext) {
      setMessages(prev => [...prev, { role: 'assistant', text: '🎉 **All caught up!** Any skipped items remain in your inbox.' }]);
    }
  }, [tasks, processingTaskId, skippedInSessionIds, singleTaskMode,
      setPendingAction, setMessages, processNextInboxItem]);

  const handleDeleteInboxItem = useCallback(() => {
    const current = tasks.find(t => t.id === processingTaskId.current)
      ?? tasks.filter(t => t.bucket === 'inbox')[0];
    if (!current) return;
    setTasks(prev => prev.map(t => t.id === current.id ? { ...t, bucket: 'inboxHistory' } : t));
    const nextItem = tasks.filter(t => t.bucket === 'inbox' && t.id !== current.id && !skippedInSessionIds.current.has(t.id))[0];
    setPendingAction(null);
    setMessages(prev => [...prev, { role: 'assistant', text: `🗑 Deleted **"${current.text}"**.` }]);
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
    } else {
      setMessages(prev => [...prev, { role: 'assistant', text: '🎉 **All caught up!** Inbox fully processed.' }]);
    }
  }, [tasks, processingTaskId, skippedInSessionIds, singleTaskMode,
      setTasks, setPendingAction, setMessages, processNextInboxItem]);

  const startProcessInbox = useCallback(async () => {
    singleTaskMode.current = false;
    skippedInSessionIds.current = new Set();
    sessionCreatedTasksRef.current = [];
    setCurrentBucket('inbox');
    const inbox = tasks.filter(t => t.bucket === 'inbox');
    if (inbox.length === 0) {
      switchCoachMode('process', 'Your inbox is empty — nothing to process! Add some tasks first or do a Brain Dump.');
      return;
    }
    switchCoachMode('process', `You have **${inbox.length} item${inbox.length > 1 ? 's' : ''}** in your inbox. Processing them one by one…`);
    setTimeout(() => processNextInboxItem(inbox[0]), 100);
  }, [tasks, singleTaskMode, skippedInSessionIds, setCurrentBucket,
      switchCoachMode, processNextInboxItem]);

  const askAIAboutTask = useCallback(async (task) => {
    setCurrentBucket('inbox');
    singleTaskMode.current = true;
    switchCoachMode('process', `Let's clarify: **"${task.text}"**`);
    setTimeout(() => processNextInboxItem(task), 100);
  }, [singleTaskMode, setCurrentBucket, switchCoachMode, processNextInboxItem]);

  return {
    processNextInboxItem,
    handleConfirmMove,
    handleSkipPendingAction,
    handleDeleteInboxItem,
    startProcessInbox,
    askAIAboutTask,
  };
}

export { useInboxProcessing };
