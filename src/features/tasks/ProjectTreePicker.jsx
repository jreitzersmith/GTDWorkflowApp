import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";

// Converts a flat array of eligible project tasks into a nested tree using childIds.
// Uses childIds (the same source of truth as the project view) rather than parentId,
// so the picker always mirrors the structure visible in the project view.
// Projects not referenced in any eligible sibling's childIds are treated as roots;
// this also surfaces orphaned projects whose parentId points to a deleted/done parent.
function buildProjectTree(flatProjects) {
  const byId = {};
  flatProjects.forEach(p => { byId[p.id] = { ...p, children: [] }; });

  // Wire up children in childIds order (preserves display order from project view).
  flatProjects.forEach(p => {
    (p.childIds || []).forEach(cid => {
      if (byId[cid]) byId[p.id].children.push(byId[cid]);
    });
  });

  // Roots = eligible projects not appearing as a child of any other eligible project.
  const nestedIds = new Set();
  flatProjects.forEach(p => {
    (p.childIds || []).forEach(cid => { if (byId[cid]) nestedIds.add(cid); });
  });
  return flatProjects.filter(p => !nestedIds.has(p.id)).map(p => byId[p.id]);
}

// Renders one row of the project tree. Recurses for expanded children.
// Hover on a row with children triggers a timed expand via onHoverExpand.
function ProjectTreeRow({ node, depth, selectedId, expanded, onSelect, onToggle, onHoverExpand }) {
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const isExpanded = !!expanded[node.id];

  return (
    <>
      <div
        onMouseEnter={() => hasChildren && onHoverExpand(node.id)}
        onClick={() => onSelect(node.id)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: `5px 8px 5px ${8 + depth * 14}px`,
          cursor: "pointer",
          background: isSelected ? COLORS.projectBg : "transparent",
          color: isSelected ? COLORS.project : COLORS.text,
          fontSize: 12,
          borderRadius: 4,
        }}
      >
        <span
          onClick={e => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          style={{
            width: 14, fontSize: 9,
            color: hasChildren ? COLORS.text2 : "transparent",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            cursor: hasChildren ? "pointer" : "default",
            flexShrink: 0,
          }}
        >▶</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {node.text}
        </span>
      </div>
      {isExpanded && node.children.map(child => (
        <ProjectTreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={onToggle}
          onHoverExpand={onHoverExpand}
        />
      ))}
    </>
  );
}

ProjectTreeRow.propTypes = {
  node:          PropTypes.object.isRequired,
  depth:         PropTypes.number.isRequired,
  selectedId:    PropTypes.string,
  expanded:      PropTypes.object.isRequired,
  onSelect:      PropTypes.func.isRequired,
  onToggle:      PropTypes.func.isRequired,
  onHoverExpand: PropTypes.func.isRequired,
};

// Collapsible project tree picker. Shows all eligible projects as a nested
// tree mirroring the project view (built from childIds); sub-projects are
// collapsed by default and expand on hover or chevron click.
// Calls onSelect(id | null) on row click, onNewProject() for the
// new-project option (omitted when prop is absent).
// showStandalone renders a "— Standalone" row at the top for TaskDetailPanel.
function ProjectTreePicker({ eligibleProjects, selectedId, onSelect, onNewProject, showStandalone }) {
  const [expanded, setExpanded] = useState({});
  const hoverTimers = useRef({});

  useEffect(() => {
    const timers = hoverTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const tree = buildProjectTree(eligibleProjects);

  const handleToggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleHoverExpand = (id) => {
    clearTimeout(hoverTimers.current[id]);
    hoverTimers.current[id] = setTimeout(() => {
      setExpanded(prev => ({ ...prev, [id]: true }));
    }, 200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {showStandalone && (
        <div
          onClick={() => onSelect(null)}
          style={{
            padding: "5px 8px 5px 22px", cursor: "pointer", fontSize: 12,
            color: !selectedId ? COLORS.text : COLORS.muted,
            background: !selectedId ? COLORS.surface3 : "transparent",
            borderRadius: 4,
          }}
        >
          — Standalone
        </div>
      )}
      {tree.map(node => (
        <ProjectTreeRow
          key={node.id}
          node={node}
          depth={0}
          selectedId={selectedId}
          expanded={expanded}
          onSelect={onSelect}
          onToggle={handleToggle}
          onHoverExpand={handleHoverExpand}
        />
      ))}
      {onNewProject && (
        <div
          onClick={onNewProject}
          style={{
            padding: "5px 8px 5px 22px", cursor: "pointer", fontSize: 12,
            color: COLORS.muted, borderTop: `1px solid ${COLORS.border}`,
            marginTop: 2,
          }}
        >
          ＋ New project…
        </div>
      )}
    </div>
  );
}

ProjectTreePicker.propTypes = {
  eligibleProjects: PropTypes.array.isRequired,
  selectedId:       PropTypes.string,
  onSelect:         PropTypes.func.isRequired,
  onNewProject:     PropTypes.func,
  showStandalone:   PropTypes.bool,
};

export { buildProjectTree, ProjectTreePicker };
