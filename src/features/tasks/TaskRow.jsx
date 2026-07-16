import { useContext, useState, useRef, useEffect } from "react";
import { useTaskRowState } from "./useTaskRowState.js";
import { useViewport } from "../../hooks/useViewport.js";
import PropTypes from "prop-types";
import { COLORS, BUCKETS } from "../../constants.jsx";
import { TaskActionsContext, TaskRowContext, taskShape } from "../../contexts.js";
import {
  countDescendants, effortAccuracyColor, effortToMinutes, isDeferred,
  minutesToEffortLabel, subtractFromDate, sumDescendantEffort,
} from "./taskUtils.jsx";
import { ActionBtn } from "../coach/AICoach.jsx";
import { StyledCheckbox } from "../../shared/StyledCheckbox.jsx";

const PRIORITIES = ["Imperative", "As Possible", "Financial", "External"];

function TaskRow({ task, isSubtask, indentOverride, depth = 0, onSelect, isSelected }) {
  const { isTouch, breakpoint, isPhone } = useViewport();
  const isMobileLayout = breakpoint !== 'desktop';
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);
  useEffect(() => {
    if (!actionsMenuOpen) return;
    const handleOutside = e => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setActionsMenuOpen(false);
      }
    };
    // touchstart alongside mousedown — mousedown alone doesn't reliably fire for
    // real touch taps on phone/tablet (unlike DevTools touch emulation).
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [actionsMenuOpen]);
  const { onComplete, onDelete, onMove, onAskAI, onUpdateTask, onAssignToProject, onSkipRecurrence, onNavigate, onOpenDetail, onToggleCollapse } = useContext(TaskActionsContext);
  const { currentBucket, allTasks, moveMenu, setMoveMenu, pendingAction, collapsedNodes, selectedTaskId, focusedTaskId, setFocusedTaskId, locations, efforts, tagDisplay, categories } = useContext(TaskRowContext);
  const {
    hover, setHover,
    expanded, setExpanded,
    showAssign, setShowAssign,
    assignTarget, setAssignTarget,
    newProjName, setNewProjName,
    editTitle, setEditTitle,
  } = useTaskRowState(task);
  const highlight = pendingAction && task.bucket === "inbox";
  const parentProject = task.parentId ? (allTasks || []).find(t => t.id === task.parentId) : null;
  const indent = indentOverride !== undefined ? indentOverride : (isSubtask ? 28 : 0);

  const taskPriority = task.priority || [];
  const taskLocation = task.location || [];
  const taskDueDate  = task.dueDate  || "";
  const taskEffort   = task.effort   || null;
  const deferred     = isDeferred(task);

  // Collapse toggle — only relevant in the project view for tasks that have children.
  const childIds = task.childIds || [];
  const hasChildren = currentBucket === "project" && childIds.length > 0;
  // Collapsed when the task's own ID is in collapsedNodes — same rule at every depth,
  // including root categories/projects, so the row's own chevron always just hides/shows
  // its direct+nested children. The old root-only "collapse to next level" two-step mode
  // is still reachable via the Sort menu's "Show Categories Only" / "Show SubCategories"
  // bulk actions in TaskBucketView, via onToggleCollapseLevel.
  const isCollapsed = hasChildren && !!(collapsedNodes?.has(task.id));
  const handleCollapseToggle = (e) => {
    e.stopPropagation();
    if (!hasChildren) return;
    onToggleCollapse?.(task.id);
  };

  const isContainer = task.nodeType === 'category' || task.nodeType === 'subcategory';

  // Mobile: the status dot is removed to save row width — completing a task is done via
  // press-and-hold on the title/tags area instead. Cancelled if the finger moves (scroll)
  // or lifts early, so it never fires accidentally during a normal tap or scroll.
  const [isPressingComplete, setIsPressingComplete] = useState(false);
  const pressTimerRef = useRef(null);
  const pressStartRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const LONG_PRESS_MS = 550;
  const PRESS_MOVE_CANCEL_PX = 10;

  const clearPressTimer = () => {
    setIsPressingComplete(false);
    pressStartRef.current = null;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };
  useEffect(() => () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); }, []);

  const handlePressStart = (e) => {
    if (!isMobileLayout || isContainer) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    pressStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsPressingComplete(true);
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      setIsPressingComplete(false);
      longPressFiredRef.current = true;
      if (navigator.vibrate) navigator.vibrate(15);
      onComplete(task.id);
    }, LONG_PRESS_MS);
  };
  const handlePressMove = (e) => {
    if (!pressStartRef.current) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - pressStartRef.current.x);
    const dy = Math.abs(touch.clientY - pressStartRef.current.y);
    if (dx > PRESS_MOVE_CANCEL_PX || dy > PRESS_MOVE_CANCEL_PX) clearPressTimer();
  };

  // FR#122: Bucket aging — show age badge in waiting/someday/deferred views
  const AGING_BUCKETS = ['waiting', 'someday', 'deferred'];
  const taskAgeDays = AGING_BUCKETS.includes(currentBucket)
    ? Math.floor((Date.now() - task.created) / 86400000)
    : null;
  const ageColor = taskAgeDays === null ? null
    : taskAgeDays >= 90 ? '#c87070'
    : taskAgeDays >= 30 ? '#d4a844'
    : COLORS.muted;
  // FR#126: Chronic-deferred flag — tasks deferred 3+ times
  const chronicallyDeferred = (task.deferCount || 0) >= 3;

  // Computed effort total for project-bucket rows (recursive sum across all descendants).
  const projectEffortTotal = (() => {
    if (task.bucket !== "project" || currentBucket !== "project") return null;
    if (!(task.childIds || []).length) return null;
    const totalMin = (task.childIds || []).reduce(
      (sum, cid) => sum + sumDescendantEffort(cid, allTasks || []), 0
    );
    return minutesToEffortLabel(totalMin);
  })();

  // Descendant task counts — shown as "incomplete / total" badge on rows with children.
  const descendantCounts = hasChildren
    ? (task.childIds || []).reduce(
        (acc, cid) => {
          const c = countDescendants(cid, allTasks || []);
          return { total: acc.total + c.total, incomplete: acc.incomplete + c.incomplete };
        },
        { total: 0, incomplete: 0 }
      )
    : null;

  const togglePriority = (p) => {
    const next = taskPriority.includes(p) ? taskPriority.filter(x => x !== p) : [...taskPriority, p];
    onUpdateTask(task.id, { priority: next });
  };

  const toggleLocation = (loc) => {
    const next = taskLocation.includes(loc) ? taskLocation.filter(x => x !== loc) : [...taskLocation, loc];
    onUpdateTask(task.id, { location: next });
  };

  const toggleEffort = (e) => {
    onUpdateTask(task.id, { effort: taskEffort === e ? null : e });
  };

  const saveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.text) {
      onUpdateTask(task.id, { text: trimmed });
    } else {
      setEditTitle(task.text); // revert empties / whitespace-only
    }
  };

  const rootProjects = (allTasks || []).filter(t => t.bucket === "project" && !t.parentId && !t.done);

  const handleAssign = () => {
    if (assignTarget === "__new__") {
      if (!newProjName.trim()) return;
      onAssignToProject && onAssignToProject(task.id, null, newProjName.trim());
    } else {
      onAssignToProject && onAssignToProject(task.id, assignTarget, null);
    }
    setShowAssign(false);
    setNewProjName("");
    setAssignTarget("__new__");
  };

  const hasMetadata = taskPriority.length > 0 || taskLocation.length > 0 || taskDueDate || !!taskEffort || !!task.deferUntil || !!task.category;

  const isFocused = focusedTaskId === task.id;

  return (
    <div
      data-task-id={task.id}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setFocusedTaskId?.(task.id)}
      style={{ borderLeft: `3px solid ${isFocused ? COLORS.next : highlight ? COLORS.inbox : isSubtask ? COLORS.project + "55" : "transparent"}`, opacity: task.done ? 0.4 : (deferred && currentBucket === "project") ? 0.55 : 1, transition: "all 0.12s", outline: isFocused ? `1px solid ${COLORS.next}22` : "none" }}
    >
      {/* Main task row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: `8px 18px 8px ${18 + indent}px`, background: isFocused ? COLORS.next + "11" : highlight ? COLORS.inboxBg : (selectedTaskId === task.id ? COLORS.surface3 : hover ? COLORS.surface2 : "transparent") }}>
        {/* Bulk-selection checkbox — shown in Inbox when a selection handler is provided */}
        {onSelect && (
          <StyledCheckbox
            checked={!!isSelected}
            onChange={e => { e.stopPropagation(); onSelect(task.id, e.target.checked); }}
            onClick={e => e.stopPropagation()}
            accentColor={COLORS.project}
            style={{ marginTop: 3 }}
          />
        )}
        {/* Drag handle always comes first — consistent column position regardless of subtask depth.
            Hidden on touch: native HTML5 drag-and-drop has no touch support (see FR#203/GH#239). */}
        {currentBucket === "project" && !isTouch && (
          <span style={{ color: COLORS.muted, fontSize: 12, marginTop: 1, flexShrink: 0, cursor: "grab", userSelect: "none", opacity: hover ? 0.6 : 0, transition: "opacity 0.1s", lineHeight: 1 }}>⠿</span>
        )}
        {isSubtask && <span style={{ color: COLORS.project, fontSize: 10, marginTop: 3, flexShrink: 0 }}>↳</span>}
        {/* Collapse / expand toggle — shown only for tasks with children in the project view */}
        {hasChildren && (
          <button
            onClick={handleCollapseToggle}
            title={isCollapsed ? "Expand" : "Collapse"}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.project, fontSize: isTouch ? 15 : 11, flexShrink: 0, marginTop: isTouch ? -3 : 2, lineHeight: 1, opacity: (hover || isTouch) ? 1 : 0.45, transition: "opacity 0.1s", width: isTouch ? 24 : 14, height: isTouch ? 24 : "auto", textAlign: "center" }}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        )}
        {/* Spacer to keep alignment for rows without children */}
        {!hasChildren && currentBucket === "project" && (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        {/* Status dot — desktop only. On mobile it's removed to save row width;
            completing a task is done via press-and-hold on the title/tags area instead. */}
        {!isMobileLayout && (
          isContainer ? (
            <span style={{ width: 15, height: 15, flexShrink: 0, marginTop: 2 }} />
          ) : (
            <div
              onClick={() => onComplete(task.id)}
              style={{ width: 15, height: 15, borderRadius: "50%", border: `1.5px solid ${task.done ? COLORS.next : COLORS.border2}`, background: task.done ? COLORS.next : "transparent", flexShrink: 0, marginTop: 2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#111", transition: "all 0.15s" }}
            >
              {task.done ? "✓" : ""}
            </div>
          )
        )}

        <div
          onTouchStart={handlePressStart}
          onTouchMove={handlePressMove}
          onTouchEnd={clearPressTimer}
          onTouchCancel={clearPressTimer}
          onClickCapture={e => {
            // Swallow the browser's synthetic "ghost click" that fires after a long-press
            // release — otherwise completing the task would also open the detail panel.
            if (longPressFiredRef.current) {
              longPressFiredRef.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          title={isMobileLayout && !isContainer ? "Press and hold to mark complete" : undefined}
          style={{
            flex: 1, minWidth: 0, display: "grid",
            gridTemplateColumns: (tagDisplay === "inline" && !expanded && hasMetadata) ? "minmax(0,1fr) minmax(0,42%)" : "minmax(0,1fr)",
            columnGap: 9, alignItems: "start",
            background: isPressingComplete ? COLORS.next + "22" : "transparent",
            borderRadius: 6,
            transition: isPressingComplete ? `background ${LONG_PRESS_MS}ms ease` : "background 0.15s ease",
          }}
        >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: task.isWaitingFor ? "#c04040" : task.isSomeday ? "#b8960c" : COLORS.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span
              onClick={(e) => { e.stopPropagation(); onOpenDetail?.(selectedTaskId === task.id ? null : task.id); }}
              title="Open detail panel"
              style={{ cursor: "pointer" }}
            >{task.text}</span>
            {task.notes && (
              <span title="Has notes" style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>📝</span>
            )}
            {task.recurrence && (
              <span title="Recurring task" style={{ fontSize: 10, opacity: 0.6, flexShrink: 0 }}>↻</span>
            )}
            {descendantCounts && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.surface3, color: COLORS.text2, border: `1px solid ${COLORS.border}`, flexShrink: 0, whiteSpace: "nowrap" }}>
                ↓ {descendantCounts.incomplete} / {descendantCounts.total}
              </span>
            )}
            {projectEffortTotal && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44`, flexShrink: 0 }}>⏱ {projectEffortTotal}</span>
            )}
            {deferred && currentBucket === "project" && (
              <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.deferredBg, color: COLORS.deferred, border: `1px solid ${COLORS.deferred}44`, flexShrink: 0 }}>⏰ {task.deferUntil}</span>
            )}
            {taskAgeDays !== null && (
              <span title={`In this bucket for ~${taskAgeDays} days`} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.surface3, color: ageColor, border: `1px solid ${ageColor}44`, flexShrink: 0 }}>
                {taskAgeDays}d
              </span>
            )}
            {chronicallyDeferred && (
              <span title={`Deferred ${task.deferCount} times`} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: "#c8444422", color: "#c84444", border: "1px solid #c8444444", flexShrink: 0 }}>
                🔁 {task.deferCount}×
              </span>
            )}
          </div>
          {/* Metadata summary chips — below-text mode */}
          {tagDisplay !== "inline" && !expanded && hasMetadata && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
              {taskLocation.map(loc => (
                <span key={loc} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.project, border: `1px solid ${COLORS.project}44` }}>{loc}</span>
              ))}
              {taskDueDate && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.waiting, border: `1px solid ${COLORS.waiting}44` }}>📅 {taskDueDate}</span>
              )}
              {taskPriority.map(p => (
                <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.inbox, border: `1px solid ${COLORS.inbox}44` }}>{p}</span>
              ))}
              {taskEffort && task.actualEffort ? (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort)), border: `1px solid ${effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort))}44` }}>⏱ {taskEffort} → {task.actualEffort}</span>
              ) : taskEffort ? (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44` }}>⏱ {taskEffort}</span>
              ) : null}
              {task.deferUntil && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.deferredBg, color: COLORS.deferred, border: `1px solid ${COLORS.deferred}44` }}>⏰ {task.deferUntil}</span>
              )}
              {task.category && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "#d4a84422", color: "#d4a844", border: "1px solid #d4a84444" }}>◆ {task.category}</span>
              )}
            </div>
          )}
          {/* Parent project link for Next Actions */}
          {parentProject && currentBucket === "next" && (hover || isTouch) && (
            <div
              onClick={() => onNavigate("project")}
              style={{ marginTop: 3, fontSize: 11, color: COLORS.project, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, opacity: 0.85 }}
              title="Go to project"
            >
              <span>↑</span>
              <span style={{ textDecoration: "underline" }}>{parentProject.text}</span>
            </div>
          )}
        </div>

        {/* Metadata chips — inline mode: own grid column, wraps independently, never overlaps title */}
        {tagDisplay === "inline" && !expanded && hasMetadata && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", justifySelf: "end", alignSelf: "start" }}>
            {taskLocation.map(loc => (
              <span key={loc} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.project, border: `1px solid ${COLORS.project}44`, whiteSpace: "nowrap" }}>{loc}</span>
            ))}
            {taskDueDate && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.waiting, border: `1px solid ${COLORS.waiting}44`, whiteSpace: "nowrap" }}>📅 {taskDueDate}</span>
            )}
            {taskPriority.map(p => (
              <span key={p} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.surface3, color: COLORS.inbox, border: `1px solid ${COLORS.inbox}44`, whiteSpace: "nowrap" }}>{p}</span>
            ))}
            {taskEffort && task.actualEffort ? (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort)), border: `1px solid ${effortAccuracyColor(effortToMinutes(taskEffort), effortToMinutes(task.actualEffort))}44`, whiteSpace: "nowrap" }}>⏱ {taskEffort} → {task.actualEffort}</span>
            ) : taskEffort ? (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44`, whiteSpace: "nowrap" }}>⏱ {taskEffort}</span>
            ) : null}
            {task.deferUntil && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: COLORS.deferredBg, color: COLORS.deferred, border: `1px solid ${COLORS.deferred}44`, whiteSpace: "nowrap" }}>⏰ {task.deferUntil}</span>
            )}
            {task.category && (
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: "#d4a84422", color: "#d4a844", border: "1px solid #d4a84444", whiteSpace: "nowrap" }}>◆ {task.category}</span>
            )}
          </div>
        )}
        </div>

        {isMobileLayout ? (
          <div ref={actionsMenuRef} style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setActionsMenuOpen(o => !o)}
              title="Actions"
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: actionsMenuOpen ? COLORS.surface3 : "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text2, fontSize: 16, cursor: "pointer", lineHeight: 1 }}
            >⋮</button>
            {actionsMenuOpen && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
                <button
                  onClick={() => { setExpanded(x => !x); setActionsMenuOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", background: "none", border: "none", color: COLORS.text, fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderRadius: 5 }}
                >{expanded ? "▾" : "›"} Task details</button>
                {currentBucket === "inbox" && (
                  <button
                    onClick={() => { onAskAI(task); setActionsMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", background: "none", border: "none", color: COLORS.inbox, fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderRadius: 5 }}
                  >✦ Ask AI</button>
                )}
                {currentBucket === "next" && !task.parentId && onAssignToProject && (
                  <button
                    onClick={() => { setShowAssign(x => !x); setActionsMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", background: "none", border: "none", color: showAssign ? COLORS.project : COLORS.text, fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderRadius: 5 }}
                  >📁 Assign to project</button>
                )}
                {task.recurrence && onSkipRecurrence && (
                  <button
                    onClick={() => { onSkipRecurrence(task.id); setActionsMenuOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", background: "none", border: "none", color: COLORS.deferred, fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderRadius: 5 }}
                  >↻ Skip recurrence</button>
                )}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setMoveMenu(moveMenu === task.id ? null : task.id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", background: "none", border: "none", color: COLORS.text, fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderRadius: 5 }}
                  >↪ Move to…</button>
                  {moveMenu === task.id && (
                    <div style={{ position: "absolute", left: isPhone ? 0 : "auto", right: isPhone ? "auto" : "100%", top: isPhone ? "100%" : 0, marginTop: isPhone ? 4 : 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 4, zIndex: 101, minWidth: 150, maxWidth: isPhone ? "calc(100vw - 64px)" : "none", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                      {Object.entries(BUCKETS).filter(([k]) => k !== currentBucket && k !== "done" && k !== "inboxHistory").map(([k, cfg]) => (
                        <div
                          key={k}
                          onClick={() => { onMove(task.id, k); setMoveMenu(null); setActionsMenuOpen(false); }}
                          style={{ padding: "9px 10px", borderRadius: 5, fontSize: 13, cursor: "pointer", color: COLORS.text2, display: "flex", alignItems: "center", gap: 7 }}
                        >
                          <span style={{ color: cfg.color }}>●</span> {cfg.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { onDelete(task.id); setActionsMenuOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "9px 10px", background: "none", border: "none", color: "#d45a5a", fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderRadius: 5 }}
                >✕ Delete</button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
            {/* Chevron — always visible if has metadata, else on hover */}
            {(hover || expanded || hasMetadata) && (
              <button
                onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
                title="Task details"
                style={{ padding: "2px 5px", borderRadius: 5, border: `1px solid ${expanded ? COLORS.border2 : COLORS.border}`, background: expanded ? COLORS.surface3 : "transparent", color: expanded ? COLORS.text : COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", lineHeight: 1, transition: "all 0.1s" }}
              >
                {expanded ? "▾" : "›"}
              </button>
            )}
            {hover && (
              <>
                {currentBucket === "inbox" && (
                  <ActionBtn onClick={() => onAskAI(task)} color={COLORS.inbox}>✦ AI</ActionBtn>
                )}
                {currentBucket === "next" && !task.parentId && onAssignToProject && (
                  <ActionBtn onClick={() => setShowAssign(x => !x)} color={showAssign ? COLORS.project : undefined}>📁</ActionBtn>
                )}
                {task.recurrence && onSkipRecurrence && (
                  <ActionBtn onClick={() => onSkipRecurrence(task.id)} color={COLORS.deferred} title="Skip — advance schedule without completing">↻ Skip</ActionBtn>
                )}
                <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                  <ActionBtn onClick={() => setMoveMenu(moveMenu === task.id ? null : task.id)}>Move ▾</ActionBtn>
                  {moveMenu === task.id && (
                    <div style={{ position: "absolute", right: 0, top: "100%", background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                      {Object.entries(BUCKETS).filter(([k]) => k !== currentBucket && k !== "done" && k !== "inboxHistory").map(([k, cfg]) => (
                        <div
                          key={k}
                          onClick={() => onMove(task.id, k)}
                          style={{ padding: "7px 10px", borderRadius: 5, fontSize: 12, cursor: "pointer", color: COLORS.text2, display: "flex", alignItems: "center", gap: 7 }}
                          onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          <span style={{ color: cfg.color }}>●</span> {cfg.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <ActionBtn onClick={() => onDelete(task.id)} color="#d45a5a">✕</ActionBtn>
              </>
            )}
          </div>
        )}
      </div>

      {/* Expanded metadata panel */}
      {expanded && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ margin: `0 18px 8px ${18 + indent + 24}px`, padding: "10px 12px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}
        >
          {/* Title */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Title</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") setEditTitle(task.text);
                }}
                style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${editTitle !== task.text ? COLORS.project : COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none", transition: "border-color 0.1s" }}
              />
              {editTitle !== task.text && (
                <>
                  <button
                    onClick={saveTitle}
                    disabled={!editTitle.trim()}
                    style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: editTitle.trim() ? "pointer" : "not-allowed", opacity: editTitle.trim() ? 1 : 0.4 }}
                  >Save</button>
                  <button
                    onClick={() => setEditTitle(task.text)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                  >✕</button>
                </>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Location</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(locations || []).map(loc => {
                const active = taskLocation.includes(loc);
                return (
                  <button
                    key={loc}
                    onClick={() => toggleLocation(loc)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : "transparent", color: active ? COLORS.project : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {loc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Due Date &amp; Time</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={taskDueDate}
                onChange={e => onUpdateTask(task.id, { dueDate: e.target.value || null })}
                style={{ background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
              />
              <input
                type="time"
                value={task.dueTime || ""}
                onChange={e => onUpdateTask(task.id, { dueTime: e.target.value || null })}
                style={{ background: COLORS.surface3, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
              />
              {(taskDueDate || task.dueTime) && (
                <button
                  onClick={() => onUpdateTask(task.id, { dueDate: null, dueTime: null })}
                  style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                >✕</button>
              )}
            </div>
          </div>

          {/* Defer Until */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Defer Until</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="date"
                value={task.deferUntil || ""}
                onChange={e => onUpdateTask(task.id, { deferUntil: e.target.value || null })}
                style={{ background: COLORS.surface3, border: `1px solid ${task.deferUntil ? COLORS.deferred : COLORS.border}`, borderRadius: 6, padding: "4px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
              />
              {task.deferUntil && (
                <button
                  onClick={() => onUpdateTask(task.id, { deferUntil: null })}
                  style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                >✕ Clear</button>
              )}
            </div>
            {/* Quick-pick offsets — only shown when a due date is also set */}
            {taskDueDate && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: COLORS.muted }}>Before due date:</span>
                {[
                  { label: "1 wk",  months: 0, weeks: 1 },
                  { label: "2 wks", months: 0, weeks: 2 },
                  { label: "1 mo",  months: 1, weeks: 0 },
                  { label: "2 mo",  months: 2, weeks: 0 },
                  { label: "3 mo",  months: 3, weeks: 0 },
                ].map(({ label, months, weeks }) => {
                  const d = subtractFromDate(taskDueDate, { months, weeks });
                  const active = task.deferUntil === d;
                  return (
                    <button
                      key={label}
                      onClick={() => onUpdateTask(task.id, { deferUntil: active ? null : d })}
                      style={{ padding: "2px 8px", borderRadius: 8, border: `1px solid ${active ? COLORS.deferred : COLORS.border}`, background: active ? COLORS.deferred + "22" : "transparent", color: active ? COLORS.deferred : COLORS.text2, fontFamily: "inherit", fontSize: 10, cursor: "pointer", transition: "all 0.1s" }}
                    >{label}</button>
                  );
                })}
              </div>
            )}
            {deferred && (
              <div style={{ marginTop: 5, fontSize: 11, color: COLORS.deferred, opacity: 0.85 }}>
                ⏰ Hidden from active views until {task.deferUntil}
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Priority</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {PRIORITIES.map(p => {
                const active = taskPriority.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePriority(p)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.inbox : COLORS.border}`, background: active ? COLORS.inbox + "22" : "transparent", color: active ? COLORS.inbox : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Effort */}
          <div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 5 }}>Effort</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {(efforts || []).map(e => {
                const active = taskEffort === e;
                return (
                  <button
                    key={e}
                    onClick={() => toggleEffort(e)}
                    style={{ padding: "3px 9px", borderRadius: 10, border: `1px solid ${active ? COLORS.effort : COLORS.border}`, background: active ? COLORS.effort + "22" : "transparent", color: active ? COLORS.effort : COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer", transition: "all 0.1s" }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Assign to project panel */}
      {showAssign && currentBucket === "next" && !task.parentId && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ margin: `0 18px 8px ${18 + indent + 24}px`, padding: "10px 12px", background: COLORS.surface2, border: `1px solid ${COLORS.project}44`, borderRadius: 8 }}
        >
          <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Assign to Project</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={assignTarget}
              onChange={e => setAssignTarget(e.target.value)}
              style={{ flex: 1, minWidth: 140, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: "5px 8px", color: assignTarget === "__new__" ? COLORS.text2 : COLORS.project, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
            >
              <option value="__new__">+ New project…</option>
              {rootProjects.map(p => (
                <option key={p.id} value={p.id}>{p.text.length > 40 ? p.text.slice(0, 38) + "…" : p.text}</option>
              ))}
            </select>
            {assignTarget === "__new__" && (
              <input
                autoFocus
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAssign(); if (e.key === "Escape") setShowAssign(false); }}
                placeholder="Project name…"
                style={{ flex: 1, minWidth: 120, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
              />
            )}
            <button
              onClick={handleAssign}
              disabled={assignTarget === "__new__" && !newProjName.trim()}
              style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: (assignTarget !== "__new__" || newProjName.trim()) ? "pointer" : "not-allowed", opacity: (assignTarget !== "__new__" || newProjName.trim()) ? 1 : 0.4 }}
            >Assign</button>
            <button
              onClick={() => setShowAssign(false)}
              style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

TaskRow.propTypes = {
  task:           taskShape.isRequired,
  isSubtask:      PropTypes.bool,
  indentOverride: PropTypes.number,
  depth:          PropTypes.number,
  onSelect:       PropTypes.func,
  isSelected:     PropTypes.bool,
};

export { PRIORITIES, TaskRow };
