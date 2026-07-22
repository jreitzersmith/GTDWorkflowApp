import PropTypes from "prop-types";
import { useState, useEffect, useRef, useCallback } from "react";
import { COLORS, BUCKETS, getEffectiveBuckets } from "../constants.jsx";

// Buckets included in global search (exclude archive-like and done)
const SEARCH_BUCKETS = ["inbox", "next", "project", "waiting", "someday", "deferred"];


// Semi-graphical keyboard key badge
function Key({ children }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 5px', borderRadius: 4,
      border: `1px solid ${COLORS.border2}`,
      background: COLORS.surface2,
      fontSize: 9, fontFamily: 'inherit',
      color: COLORS.text2, lineHeight: 1.4,
      minWidth: 18, whiteSpace: 'nowrap',
    }}>
      {children}
    </kbd>
  );
}

const SHORTCUT_SECTIONS = [
  {
    heading: 'VIEWS',
    rows: [
      { keys: ['I'], label: 'Inbox' },
      { keys: ['W'], label: 'Waiting For' },
      { keys: ['N'], label: 'Next Actions' },
      { keys: ['P'], label: 'Projects' },
      { keys: ['S'], label: 'Someday / Maybe' },
      { keys: ['D'], label: 'Deferred' },
      { keys: ['A'], label: 'Archived' },
      { keys: ['L'], label: 'Calendar' },
      { keys: ['F'], label: "Today's Focus" },
      { keys: ['E'], label: 'Email' },
    ],
  },
  {
    heading: 'MODES',
    rows: [
      { keys: ['Q'], label: 'Start / End Day' },
      { keys: ['V'], label: 'Daily Review' },
      { keys: ['Z'], label: 'Process Inbox' },
      { keys: ['X'], label: 'Project Review' },
      { keys: ['B'], label: 'Brain Dump' },
      { keys: ['R'], label: 'Weekly Review' },
      { keys: ['Y'], label: 'Cycle AI model' },
    ],
  },
  {
    heading: 'NAVIGATION',
    rows: [
      { keys: ['↓', 'j'], label: 'Focus next task', alt: true },
      { keys: ['Enter', 'Space'], label: 'Open task detail', alt: true },
      { keys: ['↑', 'k'], label: 'Focus previous task', alt: true },
      { keys: ['→'], label: 'Expand project  (Projects view)' },
      { keys: ['Esc'], label: 'Clear focus' },
      { keys: ['←'], label: 'Collapse project  (Projects view)' },
    ],
  },
  {
    heading: 'SETTINGS & USAGE',
    rows: [
      { keys: ['O'], label: 'Open / close Settings' },
      { keys: ['K'], label: 'Search  (also ⌘K)' },
      { keys: ['U'], label: 'Open / close Usage' },
    ],
  },
];

function ShortcutMap({ shortcutModifier }) {
  const [nativeMod, setNativeMod] = useState('');
  useEffect(() => {
    const el = document.createElement('div');
    el.accessKey = 'x';
    const label = el.accessKeyLabel;
    if (label) setNativeMod(' (native: ' + label.replace('x', '').trim() + '+key)');
  }, []);

  const modKeys =
    shortcutModifier === 'ctrl+shift' ? ['Ctrl', '⇧'] :
    shortcutModifier === 'alt+shift'  ? ['Alt',  '⇧'] :
                                        ['Ctrl', 'Alt']; // ctrl+alt default

  return (
    <div style={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {SHORTCUT_SECTIONS.map(section => (
        <div key={section.heading}>
          <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.text2, letterSpacing: '0.08em', marginBottom: 6 }}>
            {section.heading}{section.heading === 'VIEWS' || section.heading === 'MODES' ? <span style={{ fontWeight: 400, opacity: 0.7 }}>{nativeMod}</span> : null}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
            {section.rows.map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: COLORS.text2 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  {(section.heading !== 'NAVIGATION' ? [...modKeys, ...row.keys] : row.keys).map((k, i, arr) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {i > 0 && <span style={{ color: COLORS.muted, fontSize: 9 }}>{row.alt ? '/' : '+'}</span>}
                      <Key>{k}</Key>
                    </span>
                  ))}
                </span>
                <span style={{ color: COLORS.text2, marginLeft: 4 }}>{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchModal({ tasks, onSelect, onClose, shortcutModifier = 'ctrl+alt', colorSettings }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim().length === 0 ? [] : tasks.filter(t => {
    if (!SEARCH_BUCKETS.includes(t.bucket)) return false;
    if (t.done) return false;
    const q = query.toLowerCase();
    return (t.text || "").toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q) || t.id.startsWith(q);
  }).slice(0, 50);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handleSelect = useCallback((task) => {
    onSelect(task);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" && results.length > 0) { handleSelect(results[activeIdx]); return; }
  };

  // Highlight matching text
  const highlight = (text, q) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: COLORS.inbox + "44", color: COLORS.inbox, borderRadius: 2, padding: 0 }}>
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "min(60px, 6vh)" }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 720, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - min(60px, 6vh) - 16px)", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16, opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search all tasks…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "inherit", fontSize: 14, color: COLORS.text }}
          />
          <kbd style={{ fontSize: 10, color: COLORS.muted, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "2px 5px" }}>Esc</kbd>
        </div>

        {/* Scrollable body — shortcut map and results share one scroll region so neither gets cut off on short viewports */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {/* Shortcut map — shown when no query is typed */}
          {query.trim().length === 0 && (
            <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
              <ShortcutMap shortcutModifier={shortcutModifier} />
            </div>
          )}

          {/* Results */}
          <div ref={listRef}>
          {query.trim().length === 0 ? (
            <div style={{ padding: "20px 20px", fontSize: 12, color: COLORS.muted, textAlign: "center" }}>
              Type to search across all tasks
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "20px 20px", fontSize: 12, color: COLORS.muted, textAlign: "center" }}>
              No tasks match <em>"{query}"</em>
            </div>
          ) : (
            results.map((task, idx) => {
              const bucket = getEffectiveBuckets(colorSettings?.bucketColors)[task.bucket];
              const isActive = idx === activeIdx;
              return (
                <div
                  key={task.id}
                  data-idx={idx}
                  onClick={() => handleSelect(task)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    padding: "9px 16px",
                    cursor: "pointer",
                    background: isActive ? COLORS.surface2 : "transparent",
                    borderLeft: `3px solid ${isActive ? (bucket?.color || COLORS.text2) : "transparent"}`,
                    transition: "background 0.08s",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: bucket?.color || COLORS.muted, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {highlight(task.text || "", query.trim())}
                    </div>
                    {task.notes && (
                      <div style={{ fontSize: 11, color: COLORS.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                        {highlight(task.notes.slice(0, 120), query.trim())}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: COLORS.muted, flexShrink: 0, background: COLORS.surface2, padding: "1px 6px", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
                    {bucket?.label?.replace(/^[^\s]+\s/, "") || task.bucket}
                  </span>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div style={{ padding: "6px 14px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 14, fontSize: 10, color: COLORS.muted }}>
            <span><kbd style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 3, padding: "1px 4px" }}>↑↓</kbd> navigate</span>
            <span><kbd style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 3, padding: "1px 4px" }}>↵</kbd> open</span>
            <span><kbd style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 3, padding: "1px 4px" }}>Esc</kbd> close</span>
          </div>
        )}
      </div>
    </div>
  );
}

SearchModal.propTypes = {
  tasks:    PropTypes.array.isRequired,
  onSelect: PropTypes.func.isRequired,
  onClose:  PropTypes.func.isRequired,
  colorSettings: PropTypes.object,
};

export { SearchModal };
