import PropTypes from "prop-types";
import { useState, useEffect, useRef, useCallback } from "react";
import { COLORS, BUCKETS } from "../constants.jsx";

// Buckets included in global search (exclude archive-like and done)
const SEARCH_BUCKETS = ["inbox", "next", "project", "waiting", "someday", "deferred"];

function SearchModal({ tasks, onSelect, onClose }) {
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
    return (t.text || "").toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q);
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 80 }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 560, maxWidth: "calc(100vw - 32px)", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
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

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: "auto" }}>
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
              const bucket = BUCKETS[task.bucket];
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
};

export { SearchModal };
