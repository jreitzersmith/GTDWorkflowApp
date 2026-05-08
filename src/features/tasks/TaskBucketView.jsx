import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS, BUCKETS } from "../../constants.jsx";
import { Btn } from "../../shared/SidebarComponents.jsx";
import { TaskRow } from "./TaskRow.jsx";
import { CompletedTree, ProjectTree, GroupDivider, EmptyState } from "./TaskListHelpers.jsx";
import { InboxBulkBar } from "./InboxBars.jsx";
import { waterfallFilter, groupByField, effortToMinutes, minutesToEffortLabel, effortAccuracyColor, isDeferred } from "./taskUtils.jsx";

const ADD_ROW_STYLE = { display: "flex", gap: 6, padding: "8px 16px", borderBottom: `1px solid ${COLORS.border}` };
const PANEL_HEADER_STYLE = { padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 10 };
const TASK_LIST_STYLE = { flex: 1, overflowY: "auto", padding: "4px 0" };
const INPUT_STYLE = { flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" };
// Toolbar and groupBy buttons: transparent idle, surface3 on hover;
// active variant shows surface3 idle / darker on hover with inbox accent.
function ToolbarBtn({ children, onClick, active, color, disabled, title, style }) {
  const [hover, setHover] = useState(false);
  const resolvedColor = color || (active ? COLORS.inbox : COLORS.text2);
  const borderColor   = color ? `${color}55` : (active ? COLORS.inbox : COLORS.border);
  const bg = active
    ? (hover && !disabled ? '#363830' : COLORS.surface3)
    : (hover && !disabled ? COLORS.surface3 : 'transparent');
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '5px 10px', borderRadius: 7,
        border: `1px solid ${borderColor}`,
        background: bg,
        color: resolvedColor,
        fontFamily: 'inherit', fontSize: 11,
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
ToolbarBtn.propTypes = {
  children:  PropTypes.node.isRequired,
  onClick:   PropTypes.func.isRequired,
  active:    PropTypes.bool,
  color:     PropTypes.string,
  disabled:  PropTypes.bool,
  title:     PropTypes.string,
  style:     PropTypes.object,
};

const GROUP_OPTS = [
  { key: "none",     label: "None" },
  { key: "project",  label: "Project" },
  { key: "location", label: "Location" },
  { key: "dueDate",  label: "Due Date" },
  { key: "priority", label: "Priority" },
  { key: "effort",   label: "Effort" },
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
  loading,
  onStartProjectReview,
  onBulkAssign,
}) {
  const rootProjects = tasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);

  return (
    <>
      {/* Panel header — bucket title + toolbar */}
      <div style={PANEL_HEADER_STYLE}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>{BUCKETS[currentBucket].label}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{BUCKETS[currentBucket].desc}</div>
        </div>

        {currentBucket === "project" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <ToolbarBtn
              onClick={() => {
                const next = new Set();
                rootProjects.forEach(p => next.add(p.id));
                setCollapsedNodes(next);
              }}
              title="Show project names only"
            >
              ≡ Projects Only
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => {
                const next = new Set();
                rootProjects.forEach(p => (p.childIds || []).forEach(cid => next.add(cid)));
                setCollapsedNodes(next);
              }}
              title="Collapse all projects to top-level tasks"
            >
              ⊖ Collapse All
            </ToolbarBtn>
            <ToolbarBtn
              onClick={() => setCollapsedNodes(new Set())}
              title="Expand all projects fully"
            >
              ⊕ Expand All
            </ToolbarBtn>
            <ToolbarBtn
              onClick={onStartProjectReview}
              disabled={loading}
              color={COLORS.project}
              style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              🔍 Review Projects
            </ToolbarBtn>
          </div>
        )}

        {currentBucket === "next" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: COLORS.muted, marginRight: 2 }}>Group:</span>
            {GROUP_OPTS.map(opt => (
              <ToolbarBtn
                key={opt.key}
                onClick={() => setNextGroupBy(opt.key)}
                active={nextGroupBy === opt.key}
                style={{ padding: '3px 9px', borderRadius: 6 }}
              >
                {opt.label}
              </ToolbarBtn>
            ))}
          </div>
        )}
      </div>

      {/* Add row */}
      {currentBucket !== "deferred" && (
        currentBucket === "project" ? (() => {
          const selectedProject = rootProjects.find(t => t.id === projectParentId);
          const placeholder = projectParentId === "__new__"
            ? "New project name… (Enter to add)"
            : `Subtask for "${selectedProject?.text ?? ""}"…`;
          return (
            <div style={ADD_ROW_STYLE}>
              <input
                value={addText}
                onChange={e => setAddText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addProjectTask()}
                placeholder={placeholder}
                style={INPUT_STYLE}
              />
              <select
                value={projectParentId}
                onChange={e => setProjectParentId(e.target.value)}
                style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 10px", fontFamily: "inherit", fontSize: 12, color: projectParentId === "__new__" ? COLORS.text2 : COLORS.project, outline: "none", cursor: "pointer", maxWidth: 180, colorScheme: "dark" }}
              >
                <option value="__new__">+ New project</option>
                {rootProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.text.length > 30 ? p.text.slice(0, 28) + "…" : p.text}</option>
                ))}
              </select>
              <Btn onClick={addProjectTask} style={{ fontSize: 12, borderColor: projectParentId === "__new__" ? COLORS.border : COLORS.project, color: projectParentId === "__new__" ? COLORS.text2 : COLORS.project }}>
                {projectParentId === "__new__" ? "+ Add Project" : "+ Add Task"}
              </Btn>
            </div>
          );
        })() : (
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
      <div style={TASK_LIST_STYLE}>
        {bucketTasks.length === 0 ? (
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
          return groupByField(visible, nextGroupBy, tasks).map(({ key, label, items }) => {
            const groupMin = items.reduce((sum, t) => sum + effortToMinutes(t.effort), 0);
            const groupEffortLabel = minutesToEffortLabel(groupMin) || "0m";
            return (
              <div key={key}>
                <GroupDivider label={label} count={items.length} effortTotal={groupEffortLabel} isUngrouped={key === "__ungrouped__"} />
                {items.map(task => <TaskRow key={task.id} task={task} />)}
              </div>
            );
          });
        })() : currentBucket === "deferred" ? (
          <div>
            <div style={{ padding: "6px 18px 4px", fontSize: 11, color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}`, marginBottom: 2 }}>
              Sorted by wake date — earliest first. Tasks move to Inbox automatically when their date arrives.
            </div>
            {bucketTasks.map(task => <TaskRow key={task.id} task={task} />)}
          </div>
        ) : (
          <>
            {currentBucket === "done" && <EffortAccuracyBar bucketTasks={bucketTasks} />}
            {currentBucket === "done" ? (
              <CompletedTree parentId={null} depth={0} />
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
  loading:           PropTypes.bool.isRequired,
  onStartProjectReview: PropTypes.func.isRequired,
  onBulkAssign:      PropTypes.func.isRequired,
};

export { TaskBucketView };
