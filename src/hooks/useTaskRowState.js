import { useState, useEffect } from 'react';

/**
 * Owns all local UI state for a TaskRow: hover highlight, expanded metadata
 * panel, project-assignment form, and the inline title editor draft.
 *
 * @param {{ text: string }} task - The task being rendered (only `text` is used).
 */
function useTaskRowState(task) {
  const [hover, setHover] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignTarget, setAssignTarget] = useState('__new__');
  const [newProjName, setNewProjName] = useState('');
  const [editTitle, setEditTitle] = useState(task.text);

  // Keep the title draft in sync when the task text is changed externally
  // (e.g. by the AI coach or another device via Supabase realtime).
  useEffect(() => { setEditTitle(task.text); }, [task.text]);

  return {
    hover, setHover,
    expanded, setExpanded,
    showAssign, setShowAssign,
    assignTarget, setAssignTarget,
    newProjName, setNewProjName,
    editTitle, setEditTitle,
  };
}

export { useTaskRowState };
