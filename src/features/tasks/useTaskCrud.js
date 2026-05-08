import { useCallback } from 'react';
import { genId } from '../calendar/calendarApi.js';
import { buildNextOccurrence } from './taskUtils.jsx';

/**
 * Owns all task CRUD operations: creation, simple mutations, the multi-step
 * completion flow (rollup / defer-check / effort prompts), recurring task
 * lifecycle, and project hierarchy reassignment.
 *
 * @param {{
 *   tasks: Array,
 *   addText: string, setAddText: Function,
 *   currentBucket: string, setCurrentBucket: Function,
 *   projectParentId: string,
 *   pendingRollup: object|null, setPendingRollup: Function,
 *   pendingDeferCheck: object|null, setPendingDeferCheck: Function,
 *   actualEffortPrompt: object|null, setActualEffortPrompt: Function,
 *   setTasks: Function, setMoveMenu: Function, setPendingAction: Function,
 *   setInboxSelectedIds: Function, setSelectedTaskId: Function,
 *   setRecurringAcknowledgedMap: Function,
 *   askAIAboutTask: Function,
 * }} params
 */
function useTaskCrud({
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
}) {
  // ── Creation ────────────────────────────────────────────────────────────

  const addTask = useCallback((bucket) => {
    const text = addText.trim();
    if (!text) return;
    setTasks(prev => [{ id: genId(), text, bucket: bucket || currentBucket, done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null }, ...prev]);
    setAddText('');
  }, [addText, currentBucket, setTasks, setAddText]);

  const addAndProcess = useCallback(() => {
    const text = addText.trim();
    if (!text) return;
    const task = { id: genId(), text, bucket: 'inbox', done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null };
    setTasks(prev => [task, ...prev]);
    setAddText('');
    setCurrentBucket('inbox');
    askAIAboutTask(task);
  }, [addText, setTasks, setAddText, setCurrentBucket, askAIAboutTask]);

  const addProjectTask = useCallback(() => {
    const text = addText.trim();
    if (!text) return;
    if (projectParentId === '__new__') {
      setTasks(prev => [
        { id: genId(), text, bucket: 'project', done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [] },
        ...prev,
      ]);
    } else {
      const childId = genId();
      setTasks(prev => [
        ...prev.map(t =>
          t.id === projectParentId
            ? { ...t, childIds: [...(t.childIds || []), childId] }
            : t
        ),
        { id: childId, text, bucket: 'next', done: false, created: Date.now(), parentId: projectParentId, priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null },
      ]);
    }
    setAddText('');
  }, [addText, projectParentId, setTasks, setAddText]);

  // ── Simple mutations ─────────────────────────────────────────────────────

  const moveTask = useCallback((id, bucket) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, bucket, done: bucket === 'done' } : t));
    setMoveMenu(null);
    setPendingAction(null);
  }, [setTasks, setMoveMenu, setPendingAction]);

  const deleteTask = useCallback((id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, [setTasks]);

  // ── Completion flow ──────────────────────────────────────────────────────

  // Final step: mark done and spawn the next recurrence if applicable.
  // Called after all intermediate prompts (rollup, defer-check, effort) resolve.
  const finishComplete = useCallback((taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.effort && !task.actualEffort) {
      setActualEffortPrompt({ taskId, taskText: task.text, estimatedEffort: task.effort });
    } else {
      const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
      setTasks(prev => {
        const mapped = prev.map(t => t.id === taskId ? { ...t, done: true, bucket: 'done', completedDate: new Date().toISOString().split('T')[0] } : t);
        return nextOcc ? [nextOcc, ...mapped] : mapped;
      });
    }
  }, [tasks, setActualEffortPrompt, setTasks]);

  const completeTask = useCallback((id, options = {}) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.done) {
      // 1. Deferred/Someday child check — warn if any children are in defer or someday
      if (!options.skipDeferCheck) {
        const deferredKids = tasks.filter(t => t.parentId === id && (t.bucket === 'deferred' || t.bucket === 'someday') && !t.done);
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
        const mapped = prev.map(t => t.id === id ? { ...t, done: true, bucket: 'done', completedDate: new Date().toISOString().split('T')[0] } : t);
        return nextOcc ? [nextOcc, ...mapped] : mapped;
      });
    } else {
      setTasks(prev => prev.map(t => t.id === id
        ? { ...t, done: false, bucket: 'inbox', actualEffort: null, completedDate: null }
        : t
      ));
    }
  }, [tasks, setPendingDeferCheck, setPendingRollup, setActualEffortPrompt, setTasks]);

  const handleRollupConfirm = useCallback((heading) => {
    if (!pendingRollup) return;
    const { taskId, notes, parentId } = pendingRollup;
    const stamp = `${heading}\n${notes}`;
    setTasks(prev => prev.map(t => {
      if (t.id !== parentId) return t;
      const existing = t.notes ? t.notes.trim() : '';
      return { ...t, notes: existing ? `${existing}\n\n---\n${stamp}` : stamp };
    }));
    setPendingRollup(null);
    finishComplete(taskId);
  }, [pendingRollup, setTasks, setPendingRollup, finishComplete]);

  const handleRollupSkip = useCallback(() => {
    if (!pendingRollup) return;
    const { taskId } = pendingRollup;
    setPendingRollup(null);
    finishComplete(taskId);
  }, [pendingRollup, setPendingRollup, finishComplete]);

  const handleDeferCheckSkip = useCallback(() => {
    if (!pendingDeferCheck) return;
    const { taskId } = pendingDeferCheck;
    setPendingDeferCheck(null);
    completeTask(taskId, { skipDeferCheck: true });
  }, [pendingDeferCheck, setPendingDeferCheck, completeTask]);

  const handleDeferCheckReview = useCallback(() => {
    setPendingDeferCheck(null);
  }, [setPendingDeferCheck]);

  const handleActualEffortSave = useCallback((actualEffort) => {
    if (!actualEffortPrompt) return;
    const task = tasks.find(t => t.id === actualEffortPrompt.taskId);
    const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
    setTasks(prev => {
      const mapped = prev.map(t =>
        t.id === actualEffortPrompt.taskId
          ? { ...t, done: true, bucket: 'done', actualEffort, completedDate: new Date().toISOString().split('T')[0] }
          : t
      );
      return nextOcc ? [nextOcc, ...mapped] : mapped;
    });
    setActualEffortPrompt(null);
  }, [actualEffortPrompt, tasks, setTasks, setActualEffortPrompt]);

  const handleActualEffortSkip = useCallback(() => {
    if (!actualEffortPrompt) return;
    const task = tasks.find(t => t.id === actualEffortPrompt.taskId);
    const nextOcc = task?.recurrence ? buildNextOccurrence(task) : null;
    setTasks(prev => {
      const mapped = prev.map(t =>
        t.id === actualEffortPrompt.taskId
          ? { ...t, done: true, bucket: 'done', completedDate: new Date().toISOString().split('T')[0] }
          : t
      );
      return nextOcc ? [nextOcc, ...mapped] : mapped;
    });
    setActualEffortPrompt(null);
  }, [actualEffortPrompt, tasks, setTasks, setActualEffortPrompt]);

  // ── Recurring task lifecycle ─────────────────────────────────────────────

  const handleRecurringStillFine = useCallback((masterId) => {
    setRecurringAcknowledgedMap(prev => {
      const next = new Map(prev);
      const entry = next.get(masterId);
      if (entry) next.set(masterId, { ...entry, acknowledgedAt: Date.now() });
      return next;
    });
  }, [setRecurringAcknowledgedMap]);

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
  }, [setTasks, setSelectedTaskId, setCurrentBucket, setRecurringAcknowledgedMap]);

  // ── Project hierarchy mutations ──────────────────────────────────────────

  // Move a task to a different project, or make it standalone (newProjectId === null).
  // Handles: removing from old parent's childIds, adding to new parent's childIds,
  // and guards against circular references (can't assign a task to one of its own descendants).
  const reassignProject = useCallback((taskId, newProjectId, newProjectName) => {
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
          id: newProjId, text: newProjectName.trim(), bucket: 'project',
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
      if (oldProjectId === newProjectId) return prev;

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
        if (t.id === taskId) return { ...t, parentId: newProjectId || null };
        if (oldProjectId && t.id === oldProjectId) {
          return { ...t, childIds: (t.childIds || []).filter(id => id !== taskId) };
        }
        if (newProjectId && t.id === newProjectId) {
          const existing = t.childIds || [];
          return existing.includes(taskId) ? t : { ...t, childIds: [...existing, taskId] };
        }
        return t;
      });
    });
  }, [setTasks]);

  // Assign a Next Action (no parentId) to an existing or new project.
  const assignToProject = useCallback((taskId, projectId, newProjectName) => {
    if (newProjectName) {
      const newProjId = genId();
      setTasks(prev => [
        ...prev.map(t => t.id === taskId ? { ...t, parentId: newProjId } : t),
        { id: newProjId, text: newProjectName.trim(), bucket: 'project', done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [taskId] },
      ]);
    } else if (projectId) {
      setTasks(prev => prev.map(t => {
        if (t.id === taskId)    return { ...t, parentId: projectId };
        if (t.id === projectId) return { ...t, childIds: [...(t.childIds || []), taskId] };
        return t;
      }));
    }
  }, [setTasks]);

  // Assign multiple selected inbox tasks to an existing or new project at once.
  const bulkAssignToProject = useCallback((selectedIds, projectId, newProjectName) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (newProjectName) {
      const newProjId = genId();
      setTasks(prev => {
        const updated = prev.map(t => ids.includes(t.id) ? { ...t, parentId: newProjId } : t);
        const newProject = {
          id: newProjId, text: newProjectName.trim(), bucket: 'project',
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
  }, [setTasks, setInboxSelectedIds]);

  return {
    addTask, addAndProcess, addProjectTask,
    moveTask, deleteTask,
    completeTask, finishComplete,
    handleRollupConfirm, handleRollupSkip,
    handleDeferCheckSkip, handleDeferCheckReview,
    handleActualEffortSave, handleActualEffortSkip,
    handleRecurringStillFine, handleRecurringNeedsWork,
    reassignProject, assignToProject, bulkAssignToProject,
  };
}

export { useTaskCrud };
