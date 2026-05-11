import { useCallback } from 'react';
import { genId } from '../calendar/calendarApi.js';

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
  tasks, pendingAction,
  singleTaskMode, processingTaskId, skippedInSessionIds,
  setTasks, setCurrentBucket,
  setMessages, setChatHistory,
  setPendingAction,
  callAI, switchCoachMode,
}) {
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
    const { type, title, nextAction, parentRef, dueDate: aiDue, deferUntil: aiDefer, recurrence: aiRecurrence } = pendingAction;

    const current = tasks.find(t => t.id === processingTaskId.current)
      ?? tasks.filter(t => t.bucket === 'inbox')[0];
    const nextItem = tasks.filter(t => t.bucket === 'inbox' && t.id !== current?.id && !skippedInSessionIds.current.has(t.id))[0];

    if (!current) return;

    // Archive the original inbox item
    setTasks(prev => prev.map(t =>
      t.id === current.id ? { ...t, bucket: 'inboxHistory' } : t
    ));

    // Create new tasks based on action type, applying any AI-suggested dates
    if (type === 'next') {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: 'next', done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: null, processed: true }, ...prev]);
    } else if (type === 'project') {
      const projectId = genId();
      const actionId = genId();
      setTasks(prev => [
        { id: projectId, text: title || current.text, bucket: 'project', done: false, created: Date.now(), childIds: [actionId], priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: null, category: null, processed: true },
        { id: actionId, text: nextAction || title, bucket: 'next', done: false, created: Date.now(), parentId: projectId, priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: aiDefer || null, recurrence: null, notes: null, category: null, processed: true },
        ...prev,
      ]);
    } else if (type === 'someday') {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: 'someday', done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: null, processed: true }, ...prev]);
    } else if (type === 'waiting') {
      setTasks(prev => [{ id: genId(), text: title || current.text, bucket: 'waiting', done: false, created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null, actualEffort: null, deferUntil: aiDefer || null, recurrence: null, notes: null, processed: true }, ...prev]);
    } else if (type === 'add') {
      // Add as child of existing project (ID or title lookup)
      const parent = tasks.find(t => t.id === parentRef)
                  || tasks.find(t => t.text.toLowerCase() === (parentRef || '').toLowerCase());
      const childId = genId();
      if (parent) {
        setTasks(prev => [
          ...prev.map(t => t.id === parent.id ? { ...t, childIds: [...(t.childIds || []), childId] } : t),
          { id: childId, text: title || current.text, bucket: 'next', done: false, created: Date.now(),
            parentId: parent.id, priority: [], location: [], dueDate: aiDue || null, effort: null,
            actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: null,
            category: parent.category ?? null, processed: true },
        ]);
      } else {
        // Parent not found — fall back to standalone next action
        setTasks(prev => [{ id: childId, text: title || current.text, bucket: 'next', done: false,
          created: Date.now(), priority: [], location: [], dueDate: aiDue || null, effort: null,
          actualEffort: null, deferUntil: aiDefer || null, recurrence: aiRecurrence || null, notes: null, processed: true }, ...prev]);
      }
    }
    // type === 'delete': just archive, no new task

    setPendingAction(null);

    // Auto-continue to next inbox item (skip in single-task mode)
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
      setMessages(prev => [...prev, { role: 'assistant', text: '✅ **Done!** Your task has been processed and filed.' }]);
    } else {
      setMessages(prev => [...prev, { role: 'assistant', text: '🎉 **Inbox is clear!** Every item has been processed. Well done.' }]);
    }
  }, [pendingAction, tasks, processingTaskId, skippedInSessionIds, singleTaskMode,
      setTasks, setPendingAction, setMessages, processNextInboxItem]);

  const handleSkipPendingAction = useCallback(() => {
    const current = tasks.find(t => t.id === processingTaskId.current);
    skippedInSessionIds.current.add(processingTaskId.current);
    const nextItem = tasks.filter(t => t.bucket === 'inbox' && t.id !== processingTaskId.current && !skippedInSessionIds.current.has(t.id))[0];
    setPendingAction(null);
    if (current) {
      setMessages(prev => [...prev, { role: 'assistant', text: `⏭ Skipping **"${current.text}"** — it stays in your inbox for later.` }]);
    }
    if (nextItem && !singleTaskMode.current) {
      setTimeout(() => processNextInboxItem(nextItem), 300);
    } else if (singleTaskMode.current) {
      singleTaskMode.current = false;
    } else {
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
