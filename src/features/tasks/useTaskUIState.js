import { useState, useCallback } from "react";

function useTaskUIState() {
  const [currentBucket, setCurrentBucket] = useState('inbox');
  const [addText, setAddText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [nextGroupBy, setNextGroupBy] = useState('none');
  const [projectParentId, setProjectParentId] = useState('__new__');
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [actualEffortPrompt, setActualEffortPrompt] = useState(null);
  const [pendingRollup, setPendingRollup] = useState(null);
  const [pendingDeferCheck, setPendingDeferCheck] = useState(null);
  const [inboxSelectedIds, setInboxSelectedIds] = useState(new Set());
  const [pendingGroupSuggestion, setPendingGroupSuggestion] = useState(null);
  const [showCompletedInProjects, setShowCompletedInProjects] = useState(false);
  const [pendingDeleteConfirm, setPendingDeleteConfirm] = useState(null); // { taskId, taskText }

  const toggleCollapse = useCallback((id) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // If all children are already collapsed, expand them; otherwise collapse all.
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

  return {
    currentBucket, setCurrentBucket,
    addText, setAddText,
    showSettings, setShowSettings,
    showUsage, setShowUsage,
    nextGroupBy, setNextGroupBy,
    projectParentId, setProjectParentId,
    collapsedNodes, setCollapsedNodes,
    toggleCollapse, toggleCollapseLevel,
    selectedTaskId, setSelectedTaskId,
    actualEffortPrompt, setActualEffortPrompt,
    pendingRollup, setPendingRollup,
    pendingDeferCheck, setPendingDeferCheck,
    inboxSelectedIds, setInboxSelectedIds,
    pendingGroupSuggestion, setPendingGroupSuggestion,
    showCompletedInProjects, setShowCompletedInProjects,
    pendingDeleteConfirm, setPendingDeleteConfirm,
  };
}


export { useTaskUIState };
