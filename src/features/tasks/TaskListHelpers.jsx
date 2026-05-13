import { useContext } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { TaskRowContext, taskShape } from "../../contexts.js";
import { getOrderedChildren } from "./taskUtils.jsx";
import { TaskRow } from "./TaskRow.jsx";

// Drag-and-drop insertion indicator rendered between project tree rows.
function DropLine({ depth }) {
  return (
    <div style={{ height: 2, background: COLORS.project, margin: `1px 18px 1px ${18 + depth * 22}px`, borderRadius: 2, pointerEvents: "none" }} />
  );
}

// Read-only hierarchical view of completed tasks.
// parentId === null  -> virtual roots: done tasks whose parent is not also done.
// parentId !== null  -> done children of parentId, in childIds order.
function CompletedTree({ parentId, depth }) {
  const { allTasks, collapsedNodes } = useContext(TaskRowContext);
  if (depth > 6) return null;

  let children;
  if (parentId === null) {
    const doneIds = new Set(allTasks.filter(t => t.done).map(t => t.id));
    children = allTasks.filter(t => t.done && (!t.parentId || !doneIds.has(t.parentId)));
  } else {
    children = getOrderedChildren(parentId, allTasks).filter(t => t.done);
  }

  if (!children.length) return null;

  return (
    <>
      {children.map(task => (
        <div key={task.id}>
          <TaskRow task={task} isSubtask={depth > 0} indentOverride={depth * 22} depth={depth} />
          {!collapsedNodes?.has(task.id) && (
            <CompletedTree parentId={task.id} depth={depth + 1} />
          )}
        </div>
      ))}
    </>
  );
}
CompletedTree.propTypes = {
  parentId: PropTypes.string,
  depth:    PropTypes.number.isRequired,
};

// Drag-and-drop reorderable tree of project children.
function ProjectTree({ parentId, depth, dragId, dropTarget, onDragStart, onDragOver, onDragEnd, onDrop, visibilitySet }) {
  const { allTasks, collapsedNodes, projectCategoryFilter, uncategorizedProjectId, currentBucket, showCompletedInProjects, showWaitingInProjects, showSomeDayInProjects } = useContext(TaskRowContext);
  if (depth > 6) return null;
  let children = getOrderedChildren(parentId, allTasks);
  if (!showCompletedInProjects) children = children.filter(t => !t.done);
  if (visibilitySet) children = children.filter(t => visibilitySet.has(t.id));
  if (!showWaitingInProjects && currentBucket === 'project') children = children.filter(t => !t.isWaitingFor);
  if (!showSomeDayInProjects  && currentBucket === 'project') children = children.filter(t => !t.isSomeday);
  if (depth === 0 && projectCategoryFilter) {
    children = children.filter(t => t.category === projectCategoryFilter);
  }
  if (depth <= 1) {
    // Alpha sort, but pin the UnCategorized project to the end at depth 0
    children = [...children].sort((a, b) => {
      if (depth === 0 && uncategorizedProjectId) {
        if (a.id === uncategorizedProjectId) return 1;
        if (b.id === uncategorizedProjectId) return -1;
      }
      return a.text.localeCompare(b.text);
    });
  }
  if (!children.length) return null;

  return (
    <>
      {children.map(task => {
        const dt = dropTarget;
        const isTarget   = dt?.id === task.id;
        const isDragging = dragId === task.id;

        return (
          <div key={task.id}>
            {isTarget && dt.position === "before" && <DropLine depth={depth} />}

            <div
              draggable={!!onDragStart}
              onDragStart={onDragStart ? (e => { e.stopPropagation(); onDragStart(task.id); }) : undefined}
              onDragOver={onDragOver ? (e => { e.preventDefault(); e.stopPropagation(); onDragOver(e, task.id); }) : undefined}
              onDragEnd={onDragEnd ? (e => { e.stopPropagation(); onDragEnd(); }) : undefined}
              onDrop={onDrop ? (e => { e.preventDefault(); e.stopPropagation(); onDrop(task.id); }) : undefined}
              style={{
                opacity: isDragging ? 0.35 : 1,
                outline: isTarget && dt.position === "inside" ? `2px solid ${COLORS.project}66` : "none",
                outlineOffset: -1,
                borderRadius: 4,
                transition: "opacity 0.1s",
              }}
            >
              <TaskRow task={task} isSubtask={depth > 0} indentOverride={depth * 22} depth={depth} />
            </div>

            {!collapsedNodes?.has(task.id) && (
              <ProjectTree
                parentId={task.id}
                depth={depth + 1}
                dragId={dragId}
                dropTarget={dropTarget}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                visibilitySet={visibilitySet}
              />
            )}

            {isTarget && dt.position === "after" && <DropLine depth={depth} />}
          </div>
        );
      })}
    </>
  );
}
ProjectTree.propTypes = {
  parentId:    PropTypes.string,
  depth:       PropTypes.number.isRequired,
  dragId:      PropTypes.string,
  dropTarget:  PropTypes.object,
  onDragStart: PropTypes.func,
  onDragOver:  PropTypes.func,
  onDragEnd:   PropTypes.func,
  onDrop:      PropTypes.func,
  visibilitySet: PropTypes.instanceOf(Set),
};

// Section header separating task groups (by location, project, due date, etc.).
function GroupDivider({ label, count, effortTotal, isUngrouped }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px 5px", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: isUngrouped ? "none" : "uppercase" }}>
        {isUngrouped ? `— ${label}` : label}
      </span>
      <span style={{ fontSize: 10, color: COLORS.muted, background: COLORS.surface3, padding: "1px 6px", borderRadius: 8 }}>{count}</span>
      {effortTotal && (
        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: COLORS.effortBg, color: COLORS.effort, border: `1px solid ${COLORS.effort}44` }}>⏱ {effortTotal}</span>
      )}
    </div>
  );
}
GroupDivider.propTypes = {
  label:       PropTypes.string.isRequired,
  count:       PropTypes.number.isRequired,
  effortTotal: PropTypes.string,
  isUngrouped: PropTypes.bool,
};

// Placeholder shown when a bucket has no tasks.
function EmptyState({ bucket }) {
  const msgs = {
    inbox:     ["Your inbox is clear", "Add tasks above, or use Brain Dump to surface open loops."],
    next:      ["No next actions", "Process your inbox and move concrete actions here."],
    project:   ["No projects", "Multi-step goals go here."],
    waiting:   ["Nothing waiting", "Track delegated items here."],
    someday:   ["No someday items", "Capture future ideas without committing to them."],
    deferred:  ["No deferred tasks", "Open any task chevron to set a Defer Until date to hide it until you need it."],
    done:      ["Nothing completed yet", "Complete tasks and they will appear here."],
  };
  const [title, sub] = msgs[bucket] || ["Empty", ""];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, padding: 40, textAlign: "center", gap: 6, color: COLORS.muted, minHeight: 120 }}>
      <div style={{ fontSize: 28, opacity: 0.3 }}>○</div>
      <strong style={{ fontSize: 13 }}>{title}</strong>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  );
}
EmptyState.propTypes = {
  bucket: PropTypes.string.isRequired,
};

export { CompletedTree, ProjectTree, GroupDivider, EmptyState };
