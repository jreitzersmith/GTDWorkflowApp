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
}) {
  // ── Creation ────────────────────────────────────────────────────────────

  const addTask = useCallback((bucket) => {
    const text = addText.trim();
    if (!text) return;
    const effectiveBucket = bucket || currentBucket;
    const isNextAction = effectiveBucket === 'next';
    const finalBucket = isNextAction ? 'project' : effectiveBucket;
    const newId = genId();
    if (isNextAction && uncategorizedProjectId) {
      setTasks(prev => [
        ...prev.map(t => t.id === uncategorizedProjectId ? { ...t, childIds: [...(t.childIds || []), newId] } : t),
        { id: newId, text, bucket: 'project', isNextAction: true, done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, parentId: uncategorizedProjectId },
      ]);
    } else {
      setTasks(prev => [{ id: newId, text, bucket: finalBucket, ...(isNextAction ? { isNextAction: true } : {}), done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null }, ...prev]);
    }
    setAddText('');
  }, [addText, currentBucket, uncategorizedProjectId, setTasks, setAddText]);

  const addAndProcess = useCallback(() => {
    const text = addText.trim();
    if (!text) return;
    const task = { id: genId(), text, bucket: 'inbox', done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null };
    setTasks(prev => [task, ...prev]);
    setAddText('');
    setCurrentBucket('inbox');
    askAIAboutTask(task);
  }, [addText, setTasks, setAddText, setCurrentBucket, askAIAboutTask]);

  // childBucket: 'project' creates a sub-project; 'next' (default) creates a task.
  const addProjectTask = useCallback((childBucket = 'next') => {
    const text = addText.trim();
    if (!text) return;
    if (projectParentId === '__new__') {
      setTasks(prev => [
        { id: genId(), text, bucket: 'project', done: false, created: Date.now(), priority: [], location: [], dueDate: null, effort: null, actualEffort: null, deferUntil: null, notes: null, childIds: [] },
        ...prev,
      ]);
    } else {
      const childId = genId();
      setTasks(prev => {
        const parent = prev.find(t => t.id === projectParentId);
        const isNextActionChild = childBucket === 'next';
      const finalChildBucket = isNextActionChild ? 'project' : childBucket;
      const newChild = {
          id: childId, text, bucket: finalChildBucket, done: false, created: Date.now(),
          parentId: projectParentId, priority: [], location: [], dueDate: null,
          effort: null, actualEffort: null, deferUntil: null, notes: null,
          category: parent?.category ?? null,
          ...(childBucket === 'project' ? { childIds: [] } : {}),
          ...(isNextActionChild ? { isNextAction: true } : {}),
        };
        return [
          ...prev.map(t =>
            t.id === projectParentId
              ? { ...t, childIds: [...(t.childIds || []), childId] }
              : t
          ),
          newChild,
        ];
      });
    }
    setAddText('');
  }, [addText, projectParentId, setTasks, setAddText]);

  // ── Simple mutations ─────────────────────────────────────────────────────

  const moveTask = useCallback((id, bucket) => {
    const isNextMove = bucket === 'next';
    const effectiveBucket = isNextMove ? 'project' : bucket;
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const base = { ...t, bucket: effectiveBucket, done: effectiveBucket === 'done' };
      if (isNextMove) return { ...base, isNextAction: true };
      // Leaving 'next' (i.e. clearing isNextAction) when moving to another bucket
      if (t.isNextAction && !isNextMove) return { ...base, isNextAction: false };
      return base;
    }));
    setMoveMenu(null);
    setPendingAction(null);
  }, [setTasks, setMoveMenu, setPendingAction]);

  const deleteTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const hasChildren = (task.childIds || []).length > 0 || tasks.some(t => t.parentId === id);
    if (task.bucket === 'project' && hasChildren) {
      setPendingDeleteConfirm({ taskId: id, taskText: task.text });
      return;
    }
    // No children or leaf task — delete immediately
    setTasks(prev => {
      let updated = prev.filter(t => t.id !== id);
      if (task.parentId) {
        updated = updated.map(t => t.id === task.parentId
          ? { ...t, childIds: (t.childIds || []).filter(cid => cid !== id) }
          : t);
      }
      return updated;
    });
  }, [tasks, setPendingDeleteConfirm, setTasks]);

  // Called from the delete confirmation modal.
  // cascade=true  → delete task + all descendants recursively
  // cascade=false → delete task only; re-parent direct children to UnCategorized
  const confirmDelete = useCallback((id, cascade) => {
    setPendingDeleteConfirm(null);
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    if (cascade) {
      const toDelete = new Set([id]);
      const queue = [id];
      while (queue.length) {
        const cur = queue.shift();
        const node = tasks.find(t => t.id === cur);
        (node?.childIds || []).forEach(cid => { toDelete.add(cid); queue.push(cid); });
      }
      setTasks(prev => {
        let updated = prev.filter(t => !toDelete.has(t.id));
        if (task.parentId) {
          updated = updated.map(t => t.id === task.parentId
            ? { ...t, childIds: (t.childIds || []).filter(cid => cid !== id) }
            : t);
        }
        return updated;
      });
    } else {
      // Re-parent direct children to UnCategorized, keep their own subtrees intact
      const directChildIds = tasks.filter(t => t.parentId === id).map(t => t.id);
      setTasks(prev => {
        let updated = prev.filter(t => t.id !== id);
        if (task.parentId) {
          updated = updated.map(t => t.id === task.parentId
            ? { ...t, childIds: (t.childIds || []).filter(cid => cid !== id) }
            : t);
        }
        if (uncategorizedProjectId && directChildIds.length > 0) {
          const childSet = new Set(directChildIds);
          updated = updated.map(t => {
            if (childSet.has(t.id)) return { ...t, parentId: uncategorizedProjectId };
            if (t.id === uncategorizedProjectId) return { ...t, childIds: [...(t.childIds || []), ...directChildIds] };
            return t;
          });
        }
        return updated;
      });
    }
  }, [tasks, uncategorizedProjectId, setPendingDeleteConfirm, setTasks]);

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

  // Move a task to a different project, or make it uncategorized (newProjectId === null).
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
    moveTask, deleteTask, confirmDelete,
    completeTask, finishComplete,
    handleRollupConfirm, handleRollupSkip,
    handleDeferCheckSkip, handleDeferCheckReview,
    handleActualEffortSave, handleActualEffortSkip,
    handleRecurringStillFine, handleRecurringNeedsWork,
    reassignProject, assignToProject, bulkAssignToProject,
  };
}

export { useTaskCrud };
