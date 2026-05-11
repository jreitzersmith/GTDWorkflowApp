import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";

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

  // DEBUG — remove after diagnosing chevron issue
  console.log("[ProjectTreePicker] eligibleProjects:", flatProjects.map(p => ({
    id: p.id.slice(-6),
    text: p.text,
    parentId: p.parentId ? p.parentId.slice(-6) : null,
    childIds: (p.childIds || []).map(c => c.slice(-6)),
  })));
  console.log("[ProjectTreePicker] roots:", roots.map(r => r.text), "  nested:", nestedIds.size);

  return roots;
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
