import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";

// Converts a flat array of eligible project tasks into a nested tree.
// Uses childIds first (authoritative order, matches project view) then falls back
// to parentId for projects whose parent's childIds was not updated (legacy data).
// Projects not claimed as a child by either mechanism are treated as roots.
function buildProjectTree(flatProjects) {
  const byId = {};
  flatProjects.forEach(p => { byId[p.id] = { ...p, children: [] }; });

  const nestedIds = new Set();

  // Pass 1: wire children in childIds order (authoritative for new data).
  flatProjects.forEach(p => {
    (p.childIds || []).forEach(cid => {
      if (byId[cid]) {
        byId[p.id].children.push(byId[cid]);
        nestedIds.add(cid);
      }
    });
  });

  // Pass 2: add projects whose parentId points to an eligible parent but were
  // not already covered by childIds (handles legacy / inconsistent data).
  flatProjects.forEach(p => {
    if (p.parentId && byId[p.parentId] && !nestedIds.has(p.id)) {
      byId[p.parentId].children.push(byId[p.id]);
      nestedIds.add(p.id);
    }
  });

  const roots = flatProjects.filter(p => !nestedIds.has(p.id)).map(p => byId[p.id]);
  if (sorted) {
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => (a.text || '').localeCompare(b.text || ''));
      nodes.forEach(n => sortNodes(n.children));
    };
    sortNodes(roots);
  }
  return roots;
}

// Renders one row of the project tree. Recurses for expanded children.
// Hover on a row with children triggers a timed expand via onHoverExpand.
function ProjectTreeRow({ node, depth, selectedId, expanded, onSelect, onToggle }) {
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;
  const isExpanded = !!expanded[node.id];

  return (
    <>
      <div
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
};

// Collapsible project tree picker. Shows all eligible projects as a nested
// tree mirroring the project view; sub-projects are collapsed by default and
// expand on hover or chevron click.
// Calls onSelect(id | null) on row click, onNewProject() for the
// new-project option (omitted when prop is absent).
// showUncategorized renders a "— UnCategorized" row at the top for TaskDetailPanel.
function ProjectTreePicker({ eligibleProjects, selectedId, onSelect, onNewProject, showUncategorized, sorted }) {
  const [expanded, setExpanded] = useState({});

  const tree = buildProjectTree(eligibleProjects, sorted);

  const handleToggle = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {showUncategorized && (
        <div
          onClick={() => onSelect(null)}
          style={{
            padding: "5px 8px 5px 22px", cursor: "pointer", fontSize: 12,
            color: !selectedId ? COLORS.text : COLORS.muted,
            background: !selectedId ? COLORS.surface3 : "transparent",
            borderRadius: 4,
          }}
        >
          — UnCategorized
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
  eligibleProjects:  PropTypes.array.isRequired,
  selectedId:        PropTypes.string,
  onSelect:          PropTypes.func.isRequired,
  onNewProject:      PropTypes.func,
  showUncategorized: PropTypes.bool,
  sorted:            PropTypes.bool,
};

export { buildProjectTree, ProjectTreePicker };
