import { useState, useCallback } from 'react';
import { moveTaskInTree } from './taskUtils.jsx';

/**
 * Owns drag-and-drop state and all four project-tree drag handlers.
 * Returns the current identifiers alongside the handlers so callers
 * can pass them straight through to TaskBucketView.
 *
 * @param {{ setTasks: Function }} params
 */
function useDragDrop({ setTasks }) {
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const handleProjectDragStart = useCallback((id) => {
    setDragId(id);
    setDropTarget(null);
  }, []);

  const handleProjectDragOver = useCallback((e, taskId) => {
    if (taskId === dragId) return;                          // don't target self
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const position = ratio < 0.33 ? 'before' : ratio > 0.67 ? 'after' : 'inside';
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
  }, [dragId, setTasks]);

  return {
    dragId,
    dropTarget,
    setDropTarget,
    handleProjectDragStart,
    handleProjectDragOver,
    handleProjectDragEnd,
    handleProjectDrop,
  };
}

export { useDragDrop };
