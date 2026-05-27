import PropTypes from "prop-types";
import { useState, useRef, useEffect, useContext } from "react";
import { COLORS, BUCKETS } from "../../constants.jsx";
import { TaskRowContext } from "../../contexts.js";
import { Btn, ToolbarBtn } from "../../shared/SidebarComponents.jsx";
import { TaskListExportPopover } from "../coach/ExportPopover.jsx";
import { TaskRow } from "./TaskRow.jsx";
import { ArchivedTree, ProjectTree, GroupDivider, EmptyState } from "./TaskListHelpers.jsx";
import { InboxBulkBar } from "./InboxBars.jsx";
import { ProjectTreePicker } from "./ProjectTreePicker.jsx";
import { waterfallFilter, groupByField, groupByTwoLevelProject, effortToMinutes, minutesToEffortLabel, effortAccuracyColor, isDeferred, computeVisibleIds } from "./taskUtils.jsx";

const ADD_ROW_STYLE = { display: "flex", gap: 6, padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}` };
const PANEL_HEADER_STYLE = { padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10 };
const TASK_LIST_STYLE = { flex: 1, overflowY: "auto", padding: "4px 0" };
const INPUT_STYLE = { flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" };

const GROUP_OPTS = [
  { key: "none",     label: "None" },
  { key: "project",  label: "Project" },
  { key: "location", label: "Location" },
  { key: "dueDate",  label: "Due Date" },
  { key: "priority", label: "Priority" },
  { key: "effort",   label: "Effort" },
  { key: "category", label: "Category" },
];

function EffortAccuracyBar({ bucketTasks }) {
  const withBoth = bucketTasks.filter(t => t.effort && t.actualEffort);
  if (!withBoth.length) return null;
  const byLabel = {};
  withBoth.forEach(t => {
    if (!byLabel[t.effort]) byLabel[t.effort] = { totalActual: 0, count: 0 };
    byLabel[t.effort].totalActual += effortToMinutes(t.actualEffort);
    byLabel[t.effort].count += 1;
  });
  return (
    <div style={{ padding: "6px 18px 6px", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <span style={{ color: COLORS.text2, fontWeight: 600 }}>⏱ Accuracy:</span>
      {Object.entries(byLabel).map(([label, { totalActual, count }]) => {
        const avgActual = totalActual / count;
        const estMin = effortToMinutes(label);
        const color = effortAccuracyColor(estMin, avgActual);
        const pct = estMin ? Math.round(((avgActual - estMin) / estMin) * 100) : null;
        const pctStr = pct === null ? "" : pct > 0 ? ` +${pct}%` : ` ${pct}%`;
        return (
          <span key={label} style={{ padding: "1px 7px", borderRadius: 10, background: COLORS.effortBg, color, border: `1px solid ${color}44`, whiteSpace: "nowrap" }}>
            {label} → avg {minutesToEffortLabel(Math.round(avgActual))}{pctStr} <span style={{ opacity: 0.6 }}>({count})</span>
          </span>
        );
      })}
    </div>
  );
}

EffortAccuracyBar.propTypes = {
  bucketTasks: PropTypes.array.isRequired,
};

function TaskBucketView({
  currentBucket,
  tasks,
  googleToken,
  docsEnabled,
  driveConversationExportFolderId,
  bucketTasks,
  addText,
  setAddText,
  addTask,
  addAndProcess,
  addProjectTask,
  projectParentId,
  setProjectParentId,
  nextGroupBy,
  setNextGroupBy,
  setCollapsedNodes,
  setDropTarget,
  inboxSelectedIds,
  setInboxSelectedIds,
  dragId,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  deferredDupeWarning,
  onViewDeferred,
  onBulkAssign,
  categories,
  projectCategoryFilter,
  setProjectCategoryFilter,
  uncategorizedProjectId,
  showCompletedInProjects,
  setShowCompletedInProjects,
  showWaitingInProjects,
  setShowWaitingInProjects,
  showSomeDayInProjects,
  setShowSomeDayInProjects,
  locations,
  focusedTaskId,
  setFocusedTaskId,
  exportTemplates,
}) {
  const { efforts, collapsedNodes } = useContext(TaskRowContext);
  const [filterText, setFilterText] = useState("");
  const [projPickerOpen, setProjPickerOpen] = useState(false);
  const [quickSortOpen, setQuickSortOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const projPickerRef = useRef(null);
  const quickSortRef = useRef(null);
  const displayRef = useRef(null);
  const taskListRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [ageSortDir, setAgeSortDir] = useState(null); // null=tree, 'asc'=oldest-first, 'desc'=newest-first

  // Reset filter when switching buckets
  useEffect(() => { setFilterText(""); setSelectedCategory(null); setSelectedLocation(null); setAgeSortDir(null); setFocusedTaskId?.(null); }, [currentBucket]);

  // Close project picker on outside click
  useEffect(() => {
    if (!projPickerOpen) return;
    const handler = e => {
      if (projPickerRef.current && !projPickerRef.current.contains(e.target)) setProjPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [projPickerOpen]);

  useEffect(() => {
    if (!quickSortOpen) return;
    const handler = e => { if (quickSortRef.current && !quickSortRef.current.contains(e.target)) setQuickSortOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [quickSortOpen]);

  useEffect(() => {
    if (!displayOpen) return;
    const handler = e => { if (displayRef.current && !displayRef.current.contains(e.target)) setDisplayOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [displayOpen]);

  // Keyboard navigation: arrow keys move focus through visible task rows,
  // Enter opens the detail panel, j/k are vim-style aliases, Left/Right collapse/expand in Projects.
  useEffect(() => {
    const container = taskListRef.current;
    if (!container) return;

    const handler = (e) => {
      // Skip when typing in any input/textarea/select
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // Skip modifier combos that belong to other shortcuts (Cmd+K etc.)
      if (e.metaKey || e.ctrlKey) return;

      const rows = Array.from(container.querySelectorAll('[data-task-id]'));
      if (!rows.length) return;

      const currentIdx = rows.findIndex(el => el.dataset.taskId === focusedTaskId);

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIdx = currentIdx < rows.length - 1 ? currentIdx + 1 : 0;
        setFocusedTaskId(rows[nextIdx].dataset.taskId);
        rows[nextIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : rows.length - 1;
        setFocusedTaskId(rows[prevIdx].dataset.taskId);
        rows[prevIdx].scrollIntoView({ block: 'nearest' });
      } else if ((e.key === 'Enter' || e.key === ' ') && focusedTaskId) {
        e.preventDefault();
        // Delegate to the task actions context open-detail handler
        container.querySelector(`[data-task-id="${focusedTaskId}"] span[title="Open detail panel"]`)?.click();
      } else if (e.key === 'ArrowRight' && focusedTaskId && currentBucket === 'project') {
        e.preventDefault();
        // Expand: remove from collapsedNodes if present
        setCollapsedNodes(prev => { const next = new Set(prev); next.delete(focusedTaskId); return next; });
      } else if (e.key === 'ArrowLeft' && focusedTaskId && currentBucket === 'project') {
        e.preventDefault();
        // Collapse: add to collapsedNodes (only meaningful if task has children)
        const focused = tasks.find(t => t.id === focusedTaskId);
        if (focused && (focused.childIds || []).length > 0) {
          setCollapsedNodes(prev => { const next = new Set(prev); next.add(focusedTaskId); return next; });
        }
      } else if (e.key === 'Escape') {
        setFocusedTaskId(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedTaskId, setFocusedTaskId, currentBucket, collapsedNodes, setCollapsedNodes, tasks]);

  const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);
  const allProjectTasks = tasks.filter(t => t.bucket === "project" && !t.done);
  const selectedProjectNode = allProjectTasks.find(t => t.id === projectParentId);

  // Flat filtered list used when filterText is active (bypasses all grouping/tree logic)
  const filterTextActive = filterText.trim().length > 0;
  const filterActive = filterTextActive || selectedCategory != null || selectedLocation != null;
  const filteredTasks = filterActive
    ? bucketTasks.filter(t => {
        const q = filterText.toLowerCase().trim();
        const textMatch = !q || (t.text || "").toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q);
        const catMatch  = selectedCategory == null || (selectedCategory === '__unassigned__' ? !t.category : t.category === selectedCategory);
        const locMatch  = selectedLocation == null || (selectedLocation === '__unassigned__' ? !(t.location?.length) : (t.location || []).includes(selectedLocation));
        return textMatch && catMatch && locMatch;
      })
    : null;

  return (
    <>
      {/* Panel header — bucket title + toolbar */}
      <div style={PANEL_HEADER_STYLE}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>{BUCKETS[currentBucket].label}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{BUCKETS[currentBucket].desc}</div>
        </div>

        {/* In-bucket search filter */}
        {(bucketTasks.length > 0 || ["next", "project", "waiting", "someday", "deferred", "done"].includes(currentBucket)) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <input
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter…"
              style={{ width: filterTextActive ? 160 : 90, background: COLORS.surface2, border: `1px solid ${filterTextActive ? COLORS.inbox + "88" : COLORS.border}`, borderRadius: 6, padding: "4px 9px", fontFamily: "inherit", fontSize: 12, color: COLORS.text, outline: "none", transition: "width 0.15s, border-color 0.15s" }}
            />
            {filterActive && (
              <span style={{ fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>
                {filteredTasks.length} / {bucketTasks.length}
              </span>
            )}
          </div>
        )}

        {["next", "project", "waiting", "someday", "deferred", "done"].includes(currentBucket) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {categories?.length > 0 && (
              <select
                value={selectedCategory || ''}
                onChange={e => setSelectedCategory(e.target.value || null)}
                style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, color: selectedCategory ? '#d4a844' : COLORS.text2, colorScheme: 'dark', cursor: 'pointer', outline: 'none' }}
              >
                <option value=''>All categories</option>
                <option value='__unassigned__'>— No category assigned</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {locations?.length > 0 && (
              <select
                value={selectedLocation || ''}
                onChange={e => setSelectedLocation(e.target.value || null)}
                style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, color: selectedLocation ? '#4a9fd4' : COLORS.text2, colorScheme: 'dark', cursor: 'pointer', outline: 'none' }}
              >
                <option value=''>All locations</option>
                <option value='__unassigned__'>— No location assigned</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
          </div>
        )}

        {currentBucket === "project" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Quick Sort popover */}
            <div ref={quickSortRef} style={{ position: "relative" }}>
              <ToolbarBtn
                onClick={() => { setQuickSortOpen(o => !o); setDisplayOpen(false); }}
                active={quickSortOpen}
                title="Quick sort options"
              >
                Sort ▾
              </ToolbarBtn>
              {quickSortOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 60, minWidth: 190, boxShadow: "0 4px 16px rgba(0,0,0,0.35)" }}>
                  {[
                    { icon: "🗂", label: "Show Categories Only", action: () => { const s = new Set(); rootProjects.forEach(p => s.add(p.id)); setCollapsedNodes(s); setQuickSortOpen(false); } },
                    { icon: "📂", label: "Show SubCategories",   action: () => { const s = new Set(); const addDesc = id => { const t = tasks.find(x => x.id === id); (t?.childIds||[]).forEach(cid => { s.add(cid); addDesc(cid); }); }; rootProjects.forEach(p => addDesc(p.id)); setCollapsedNodes(s); setQuickSortOpen(false); } },
                    { icon: "⊕", label: "Expand All",           action: () => { setCollapsedNodes(new Set()); setQuickSortOpen(false); } },
                  ].map(({ icon, label, action }) => (
                    <button key={label} onClick={action}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", color: COLORS.text, fontFamily: "inherit", fontSize: 12, cursor: "pointer", borderRadius: 4, whiteSpace: "nowrap" }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surface3}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Display popover */}
            {(() => {
              const visibleCount = [showCompletedInProjects, showWaitingInProjects, showSomeDayInProjects].filter(Boolean).length;
              return (
                <div ref={displayRef} style={{ position: "relative" }}>
                  <ToolbarBtn
                    onClick={() => { setDisplayOpen(o => !o); setQuickSortOpen(false); }}
                    active={displayOpen}
                    title="Show / hide item types"
                  >
                    Display [{visibleCount}/3] ▾
                  </ToolbarBtn>
                  {displayOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 60, minWidth: 185, boxShadow: "0 4px 16px rgba(0,0,0,0.35)" }}>
                      {[
                        { label: "📦 Archived",     state: showCompletedInProjects, toggle: () => setShowCompletedInProjects(v => !v) },
                        { label: "🛑  Waiting For",   state: showWaitingInProjects,   toggle: () => setShowWaitingInProjects(v => !v) },
                        { label: "⏳  Someday/Maybe", state: showSomeDayInProjects,   toggle: () => setShowSomeDayInProjects(v => !v) },
                      ].map(({ label, state, toggle }) => (
                        <button key={label} onClick={toggle}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "7px 10px", background: "none", border: "none", color: COLORS.text, fontFamily: "inherit", fontSize: 12, cursor: "pointer", borderRadius: 4, whiteSpace: "nowrap" }}
                          onMouseEnter={e => e.currentTarget.style.background = COLORS.surface3}
                          onMouseLeave={e => e.currentTarget.style.background = "none"}
                        >
                          <span style={{ width: 14, height: 14, border: `1px solid ${state ? COLORS.next+"88" : COLORS.border2}`, borderRadius: 3, background: state ? COLORS.next+"22" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.1s" }}>
                            {state && <span style={{ color: COLORS.next, fontSize: 10, lineHeight: 1 }}>✓</span>}
                          </span>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <TaskListExportPopover
              tasks={tasks.filter(t => t.bucket === 'project')}
              googleToken={googleToken}
              docsEnabled={docsEnabled}
              driveConversationExportFolderId={driveConversationExportFolderId}
              defaultSections={{ project: true, next: true, waiting: false, someday: false, deferred: false }}
              exportTemplates={exportTemplates}
            />
          </div>
        )}

        {currentBucket === "next" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>Group:</span>
            <select
              value={nextGroupBy}
              onChange={e => setNextGroupBy(e.target.value)}
              style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '3px 8px', fontSize: 11, color: nextGroupBy !== 'none' ? '#d4a844' : COLORS.text2, colorScheme: 'dark', cursor: 'pointer', outline: 'none' }}
            >
              {GROUP_OPTS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
            </select>
            <TaskListExportPopover
              tasks={tasks.filter(t => t.bucket === 'project')}
              googleToken={googleToken}
              docsEnabled={docsEnabled}
              driveConversationExportFolderId={driveConversationExportFolderId}
              defaultSections={{ project: false, next: true, waiting: false, someday: false, deferred: false }}
              exportTemplates={exportTemplates}
            />
          </div>
        )}
        {(currentBucket === "waiting" || currentBucket === "someday" || currentBucket === "deferred") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <ToolbarBtn
              onClick={() => setAgeSortDir(d => d === null ? 'asc' : d === 'asc' ? 'desc' : null)}
              active={ageSortDir !== null}
              title="Sort by age (oldest first / newest first / tree)"
            >
              {ageSortDir === 'desc' ? 'Age ↓' : 'Age ↑'}
            </ToolbarBtn>
            <TaskListExportPopover
              key={currentBucket}
              tasks={tasks.filter(t => t.bucket === 'project')}
              googleToken={googleToken}
              docsEnabled={docsEnabled}
              driveConversationExportFolderId={driveConversationExportFolderId}
              exportTemplates={exportTemplates}
              defaultSections={{
                project:  false,
                next:     false,
                waiting:  currentBucket === 'waiting',
                someday:  currentBucket === 'someday',
                deferred: currentBucket === 'deferred',
              }}
            />
          </div>
        )}
      </div>

      {/* Add row */}
      {!(["deferred", "waiting", "someday"].includes(currentBucket)) && (
        currentBucket === "project" ? (
          <div style={ADD_ROW_STYLE}>
            <input
              value={addText}
              onChange={e => setAddText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (projectParentId === "__new__") addProjectTask("project");
                  else addProjectTask("next");
                }
              }}
              placeholder={projectParentId === "__new__"
                ? "New project name… (Enter to add)"
                : `Under "${selectedProjectNode?.text ?? ""}"…`}
              style={INPUT_STYLE}
            />
            <div ref={projPickerRef} style={{ position: "relative" }}>
              <button
                onClick={() => setProjPickerOpen(o => !o)}
                style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 10px", fontFamily: "inherit", fontSize: 12, color: projectParentId === "__new__" ? COLORS.text2 : COLORS.project, outline: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, maxWidth: 200 }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                  {projectParentId === "__new__" ? "＋ New project" : (selectedProjectNode?.text || "Select…")}
                </span>
                <span style={{ fontSize: 10, color: COLORS.muted, flexShrink: 0 }}>▾</span>
              </button>
              {projPickerOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 50, minWidth: 220, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
                  <ProjectTreePicker
                    eligibleProjects={allProjectTasks}
                    selectedId={projectParentId === "__new__" ? null : projectParentId}
                    onSelect={id => { setProjectParentId(id || "__new__"); setProjPickerOpen(false); }}
                    onNewProject={() => { setProjectParentId("__new__"); setProjPickerOpen(false); }}
                    showUncategorized={false}
                  />
                </div>
              )}
            </div>
            {projectParentId === "__new__" ? (
              <Btn onClick={() => addProjectTask("project")} style={{ fontSize: 12, borderColor: COLORS.border, color: COLORS.text2 }}>
                + Add Project
              </Btn>
            ) : (
              <>
                <Btn onClick={() => addProjectTask("project")} style={{ fontSize: 12, borderColor: COLORS.project, color: COLORS.project }}>
                  + Sub-project
                </Btn>
                <Btn onClick={() => addProjectTask("next")} style={{ fontSize: 12, borderColor: COLORS.project, color: COLORS.project }}>
                  + Add Task
                </Btn>
              </>
            )}
          </div>
        ) : (
          <>
            <div style={ADD_ROW_STYLE}>
              <input
                value={addText}
                onChange={e => setAddText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTask()}
                placeholder="Add a task… (Enter to add)"
                style={INPUT_STYLE}
              />
              <Btn onClick={() => addTask()} style={{ fontSize: 12 }}>+ Add</Btn>
              <Btn onClick={addAndProcess} style={{ fontSize: 12, borderColor: COLORS.inbox, color: COLORS.inbox }}>+ Add & Ask AI</Btn>
            </div>
            {deferredDupeWarning && (
              <div style={{ padding: "3px 16px 6px", fontSize: 11, color: COLORS.deferred, display: "flex", alignItems: "center", gap: 6 }}>
                <span>⏰</span>
                <span>Similar deferred task: <strong>"{deferredDupeWarning.text}"</strong> (wakes {deferredDupeWarning.deferUntil})</span>
                <button onClick={onViewDeferred} style={{ background: "none", border: "none", color: COLORS.deferred, cursor: "pointer", fontFamily: "inherit", fontSize: 11, padding: "0 2px", textDecoration: "underline" }}>View it</button>
              </div>
            )}
          </>
        )
      )}

      {/* Task list */}
      <div style={TASK_LIST_STYLE} ref={taskListRef}>
        {filterActive ? (
          filteredTasks.length === 0 ? (
            <div style={{ padding: "28px 24px", textAlign: "center", color: COLORS.muted, fontSize: 12 }}>
              <div style={{ fontSize: 22, opacity: 0.3, marginBottom: 8 }}>○</div>
              No tasks match <em>"{filterText}"</em>
            </div>
          ) : (
            filteredTasks.map(task => <TaskRow key={task.id} task={task} />)
          )
        ) : bucketTasks.length === 0 ? (
          <EmptyState bucket={currentBucket} />
        ) : currentBucket === "project" ? (
          <div onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null); }}>
            <ProjectTree
              parentId={null}
              depth={0}
              dragId={dragId}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
            />
          </div>
        ) : currentBucket === "next" ? (() => {
          const visible = waterfallFilter(bucketTasks, tasks).filter(t => !isDeferred(t));
          if (!visible.length) {
            return (
              <div style={{ padding: "28px 24px", textAlign: "center", color: COLORS.muted, fontSize: 12 }}>
                <div style={{ fontSize: 22, opacity: 0.3, marginBottom: 8 }}>○</div>
                <strong style={{ fontSize: 13, display: "block", marginBottom: 4 }}>All actions are waiting</strong>
                Complete parent tasks to unlock the next step.
              </div>
            );
          }
          if (nextGroupBy === "none") {
            return visible.map(task => <TaskRow key={task.id} task={task} />);
          }
          if (nextGroupBy === "project") {
            return groupByTwoLevelProject(visible, tasks).map(({ l1Key, l1Label, subgroups }) => {
              const l1Total = subgroups.reduce((s, sg) => s + sg.items.length, 0);
              const l1IsUncategorized = l1Key === "__uncategorized__";
              return (
                <div key={l1Key}>
                  <GroupDivider label={l1Label} count={l1Total} isUngrouped={l1IsUncategorized} />
                  {subgroups.map(({ l2Key, l2Label, l2, items }) => {
                    const groupMin = items.reduce((sum, t) => sum + effortToMinutes(t.effort), 0);
                    const groupEffortLabel = minutesToEffortLabel(groupMin) || "0m";
                    // Skip the L2 sub-header when it would just echo the L1 label
                    // (direct children of L1 with no L2 ancestor, or the UnCategorized group)
                    const skipSubHeader = l1IsUncategorized || l2 === null;
                    return (
                      <div key={l2Key || l2Label}>
                        {!skipSubHeader && (
                          <GroupDivider label={l2Label} count={items.length} effortTotal={groupEffortLabel} isUngrouped />
                        )}
                        {items.map(task => <TaskRow key={task.id} task={task} />)}
                      </div>
                    );
                  })}
                </div>
              );
            });
          }
          return groupByField(visible, nextGroupBy, tasks, { effortLabels: efforts }).map(({ key, label, items }) => {
            const groupMin = items.reduce((sum, t) => sum + effortToMinutes(t.effort), 0);
            const groupEffortLabel = minutesToEffortLabel(groupMin) || "0m";
            return (
              <div key={key}>
                <GroupDivider label={label} count={items.length} effortTotal={groupEffortLabel} isUngrouped={key === "__ungrouped__"} />
                {items.map(task => <TaskRow key={task.id} task={task} />)}
              </div>
            );
          });
        })() : (currentBucket === "waiting" || currentBucket === "someday" || currentBucket === "deferred") ? (() => {
          const flaggedIds = bucketTasks.map(t => t.id);
          const visibleSet = computeVisibleIds(flaggedIds, tasks);
          const oldestTask = bucketTasks.length > 0
            ? bucketTasks.reduce((oldest, t) => t.created < oldest.created ? t : oldest, bucketTasks[0])
            : null;
          const oldestDays = oldestTask ? Math.floor((Date.now() - oldestTask.created) / 86400000) : null;
          const oldestColor = oldestDays === null ? COLORS.muted
            : oldestDays >= 90 ? '#c87070'
            : oldestDays >= 30 ? '#d4a844'
            : COLORS.muted;
          const sortedFlat = ageSortDir !== null
            ? [...bucketTasks].sort((a, b) => ageSortDir === 'asc' ? a.created - b.created : b.created - a.created)
            : null;
          return (
            <div>
              {oldestTask && (
                <div style={{ padding: "5px 18px 5px", fontSize: 11, color: COLORS.text2, borderBottom: `1px solid ${COLORS.border}`, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: COLORS.muted, flexShrink: 0 }}>Oldest:</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{oldestTask.text}</span>
                  <span style={{ color: oldestColor, flexShrink: 0, fontWeight: 500 }}>{oldestDays}d</span>
                </div>
              )}
              {currentBucket === "deferred" && (
                <div style={{ padding: "6px 18px 4px", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 2 }}>
                  Tasks with a defer date — shown in project hierarchy. Move to Inbox automatically when their date arrives.
                </div>
              )}
              {sortedFlat !== null ? (
                sortedFlat.map(task => <TaskRow key={task.id} task={task} />)
              ) : (
                <ProjectTree
                  parentId={null}
                  depth={0}
                  dragId={null}
                  dropTarget={null}
                  visibilitySet={visibleSet}
                />
              )}
            </div>
          );
        })() : (
          <>
            {currentBucket === "done" && <EffortAccuracyBar bucketTasks={bucketTasks} />}
            {currentBucket === "done" ? (
              <ArchivedTree parentId={null} depth={0} />
            ) : currentBucket === "inbox" ? (
              <>
                {inboxSelectedIds.size > 0 && (
                  <InboxBulkBar
                    selectedCount={inboxSelectedIds.size}
                    allTasks={tasks}
                    onAssign={(projectId, newProjectName) => onBulkAssign(inboxSelectedIds, projectId, newProjectName)}
                    onClear={() => setInboxSelectedIds(new Set())}
                  />
                )}
                {bucketTasks.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onSelect={(id, checked) => setInboxSelectedIds(prev => {
                      const next = new Set(prev);
                      if (checked) next.add(id); else next.delete(id);
                      return next;
                    })}
                    isSelected={inboxSelectedIds.has(task.id)}
                  />
                ))}
              </>
            ) : (
              bucketTasks.map(task => <TaskRow key={task.id} task={task} />)
            )}
          </>
        )}
      </div>
    </>
  );
}

TaskBucketView.propTypes = {
  currentBucket:     PropTypes.string.isRequired,
  tasks:             PropTypes.array.isRequired,
  bucketTasks:       PropTypes.array.isRequired,
  addText:           PropTypes.string.isRequired,
  setAddText:        PropTypes.func.isRequired,
  addTask:           PropTypes.func.isRequired,
  addAndProcess:     PropTypes.func.isRequired,
  addProjectTask:    PropTypes.func.isRequired,
  projectParentId:   PropTypes.string.isRequired,
  setProjectParentId: PropTypes.func.isRequired,
  nextGroupBy:       PropTypes.string.isRequired,
  setNextGroupBy:    PropTypes.func.isRequired,
  setCollapsedNodes: PropTypes.func.isRequired,
  setDropTarget:     PropTypes.func.isRequired,
  inboxSelectedIds:  PropTypes.instanceOf(Set).isRequired,
  setInboxSelectedIds: PropTypes.func.isRequired,
  dragId:            PropTypes.string,
  dropTarget:        PropTypes.string,
  onDragStart:       PropTypes.func.isRequired,
  onDragOver:        PropTypes.func.isRequired,
  onDragEnd:         PropTypes.func.isRequired,
  onDrop:            PropTypes.func.isRequired,
  deferredDupeWarning: PropTypes.object,
  onViewDeferred:    PropTypes.func.isRequired,
  onBulkAssign:      PropTypes.func.isRequired,
  locations:             PropTypes.array,
  uncategorizedProjectId: PropTypes.string,
  showCompletedInProjects:   PropTypes.bool,
  showWaitingInProjects:   PropTypes.bool,
  showSomeDayInProjects:   PropTypes.bool,
  focusedTaskId:           PropTypes.string,
  setFocusedTaskId:        PropTypes.func,
  exportTemplates:         PropTypes.object,
  setShowWaitingInProjects: PropTypes.func,
  setShowSomeDayInProjects: PropTypes.func,
  setShowCompletedInProjects: PropTypes.func,
};

export { TaskBucketView };
