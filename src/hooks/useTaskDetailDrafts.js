import { useState, useEffect } from 'react';

/**
 * Owns the editable draft state for TaskDetailPanel: title and notes text,
 * their sync effects, the Escape-key close listener, and the save handlers.
 *
 * @param {{
 *   task: { id: string, text: string, notes: string|null },
 *   onUpdate: Function,
 *   onClose: Function,
 * }} params
 */
function useTaskDetailDrafts({ task, onUpdate, onClose }) {
  const [titleDraft, setTitleDraft] = useState(task.text);
  const [notesDraft, setNotesDraft] = useState(task.notes || '');

  // Sync drafts when the panel switches to a different task.
  useEffect(() => { setTitleDraft(task.text); }, [task.id, task.text]);
  useEffect(() => { setNotesDraft(task.notes || ''); }, [task.id, task.notes]);

  // Close the panel when the user presses Escape.
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const saveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== task.text) onUpdate(task.id, { text: trimmed });
    else setTitleDraft(task.text);
  };

  const saveNotes = () => {
    const val = notesDraft.trim() || null;
    if (val !== (task.notes || null)) onUpdate(task.id, { notes: val });
  };

  return {
    titleDraft, setTitleDraft, saveTitle,
    notesDraft, setNotesDraft, saveNotes,
  };
}

export { useTaskDetailDrafts };
