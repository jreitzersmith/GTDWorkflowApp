import { useState } from "react";

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
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [inboxSelectedIds, setInboxSelectedIds] = useState(new Set());
  const [pendingGroupSuggestion, setPendingGroupSuggestion] = useState(null);

  return {
    currentBucket, setCurrentBucket,
    addText, setAddText,
    showSettings, setShowSettings,
    showUsage, setShowUsage,
    nextGroupBy, setNextGroupBy,
    projectParentId, setProjectParentId,
    collapsedNodes, setCollapsedNodes,
    selectedTaskId, setSelectedTaskId,
    actualEffortPrompt, setActualEffortPrompt,
    pendingRollup, setPendingRollup,
    pendingDeferCheck, setPendingDeferCheck,
    dragId, setDragId,
    dropTarget, setDropTarget,
    inboxSelectedIds, setInboxSelectedIds,
    pendingGroupSuggestion, setPendingGroupSuggestion,
  };
}


export { useTaskUIState };
