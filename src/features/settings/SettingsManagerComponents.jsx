import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS, BUCKETS, NODE_TYPES, DEFAULT_COLOR_SETTINGS } from "../../constants.jsx";
import { taskShape } from "../../contexts.js";
import {
  effortAccuracyColor, effortToMinutes, minutesToEffortLabel, MIN_CALIBRATION_SAMPLES,
} from "../tasks/taskUtils.jsx";
import { toContactTagCase } from "../contacts/contactsUtils.js";
import { PRIORITIES } from "../tasks/TaskRow.jsx";

// ── TagDisplaySetting ─────────────────────────────────────────────────────────
// Toggle between "below" (tags on new line) and "inline" (tags next to title).
function TagDisplaySetting({ value, onChange }) {
  const opts = [
    { key: "below",  label: "Below text",  desc: "Tags appear on a new line beneath the task name" },
    { key: "inline", label: "Inline",       desc: "Tags sit between the task name and the chevron" },
  ];
  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14, lineHeight: 1.5 }}>
        Controls where metadata tags (location, due date, priority, effort) appear on collapsed task rows.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {opts.map(opt => {
          const active = value === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => onChange(opt.key)}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : COLORS.surface2, color: active ? COLORS.project : COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", transition: "all 0.1s" }}
            >
              <div style={{ fontWeight: 600, marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: active ? COLORS.project + "cc" : COLORS.muted }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

TagDisplaySetting.propTypes = {
  value:    PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

// ── LocationManager ───────────────────────────────────────────────────────────
// Full CRUD for location tags with cascade rename/remove across all tasks.
function LocationManager({ locations, tasks, onAdd, onRename, onRemove }) {
  const [newLocText, setNewLocText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);
  const [replaceWith, setReplaceWith] = useState("");

  const usedByCount = (name) => tasks.filter(t => (t.location || []).includes(name)).length;

  const handleAdd = () => {
    const trimmed = newLocText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewLocText("");
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(locations[idx]);
    setRemovingName(null);
  };

  const confirmEdit = () => {
    if (editingIdx !== null) {
      onRename(locations[editingIdx], editText);
      setEditingIdx(null);
      setEditText("");
    }
  };

  const startRemove = (name) => {
    setRemovingName(name);
    setReplaceWith("");
    setEditingIdx(null);
  };

  const confirmRemove = () => {
    onRemove(removingName, replaceWith || null);
    setRemovingName(null);
    setReplaceWith("");
  };

  const inUse = removingName ? usedByCount(removingName) : 0;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Locations tag where a task can be done. Changes cascade to all existing tasks.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {locations.map((loc, idx) => {
          const count = usedByCount(loc);
          const isEditing = editingIdx === idx;
          const isRemoving = removingName === loc;

          return (
            <div key={loc} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? COLORS.danger + "55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.project, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{loc}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} task{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(idx)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => startRemove(loc)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.danger}44`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: COLORS.danger }}>{inUse} task{inUse !== 1 ? "s" : ""}</strong> use this location. Replace with:
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          value={replaceWith}
                          onChange={e => setReplaceWith(e.target.value)}
                          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
                        >
                          <option value="">— remove tag only —</option>
                          {locations.filter(l => l !== loc).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{loc}</strong>? No tasks use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newLocText}
          onChange={e => setNewLocText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New location…"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newLocText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: newLocText.trim() ? "pointer" : "not-allowed", opacity: newLocText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

LocationManager.propTypes = {
  locations: PropTypes.arrayOf(PropTypes.string).isRequired,
  tasks:     PropTypes.arrayOf(taskShape).isRequired,
  onAdd:     PropTypes.func.isRequired,
  onRename:  PropTypes.func.isRequired,
  onRemove:  PropTypes.func.isRequired,
};

// ── CategoryManager ───────────────────────────────────────────────────────────
// Full CRUD for user-defined project categories with cascade rename/remove.
const CATEGORY_COLOR = "#d4a844";
function CategoryManager({ categories, tasks, onAdd, onRename, onRemove }) {
  const [newCatText, setNewCatText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);
  const [replaceWith, setReplaceWith] = useState("");

  const usedByCount = (name) => tasks.filter(t => t.category === name).length;

  const handleAdd = () => {
    const trimmed = newCatText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewCatText("");
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(categories[idx]);
    setRemovingName(null);
  };

  const confirmEdit = () => {
    if (editingIdx !== null) {
      onRename(categories[editingIdx], editText);
      setEditingIdx(null);
      setEditText("");
    }
  };

  const startRemove = (name) => {
    setRemovingName(name);
    setReplaceWith("");
    setEditingIdx(null);
  };

  const confirmRemove = () => {
    onRemove(removingName, replaceWith || null);
    setRemovingName(null);
    setReplaceWith("");
  };

  const inUse = removingName ? usedByCount(removingName) : 0;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Categories group tasks and projects across buckets. Changes cascade to all existing tasks.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {categories.map((cat, idx) => {
          const count = usedByCount(cat);
          const isEditing = editingIdx === idx;
          const isRemoving = removingName === cat;

          return (
            <div key={cat} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? COLORS.danger + "55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLOR, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{cat}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} task{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(idx)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => startRemove(cat)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.danger}44`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: COLORS.danger }}>{inUse} task{inUse !== 1 ? "s" : ""}</strong> use this category. Replace with:
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          value={replaceWith}
                          onChange={e => setReplaceWith(e.target.value)}
                          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
                        >
                          <option value="">— remove category only —</option>
                          {categories.filter(c => c !== cat).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{cat}</strong>? No tasks use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {categories.length === 0 && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", padding: "6px 2px" }}>
            No categories yet. Add one below to start grouping your tasks.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newCatText}
          onChange={e => setNewCatText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New category… (e.g. Work, Health, Finance)"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newCatText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${CATEGORY_COLOR}`, background: "transparent", color: CATEGORY_COLOR, fontFamily: "inherit", fontSize: 12, cursor: newCatText.trim() ? "pointer" : "not-allowed", opacity: newCatText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

CategoryManager.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
  tasks:      PropTypes.arrayOf(taskShape).isRequired,
  onAdd:      PropTypes.func.isRequired,
  onRename:   PropTypes.func.isRequired,
  onRemove:   PropTypes.func.isRequired,
};

// ── EffortManager ─────────────────────────────────────────────────────────────
// CRUD for effort level labels with cascade rename/remove across all tasks.
function EffortManager({ efforts, tasks, onAdd, onRename, onRemove }) {
  const [newText, setNewText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");

  const usedByCount = (name) => tasks.filter(t => t.effort === name || t.actualEffort === name).length;

  const handleAdd = () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewText("");
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(efforts[idx]);
  };

  const confirmEdit = () => {
    if (editingIdx !== null) {
      onRename(efforts[editingIdx], editText);
      setEditingIdx(null);
      setEditText("");
    }
  };

  const handleRemove = (name) => {
    if (window.confirm(`Remove "${name}"? It will be cleared from any tasks that use it.`)) {
      onRemove(name);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Effort estimates for tasks. Changes cascade to all existing tasks. Values are parsed for project totals (e.g. "2 hours", "1 day").
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {(efforts || []).map((eff, idx) => {
          const count = usedByCount(eff);
          const isEditing = editingIdx === idx;

          return (
            <div key={eff} style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.effort, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingIdx(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{eff}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} task{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingIdx(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(idx)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => handleRemove(eff)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.danger}44`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New effort level… (e.g. 4 hours)"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.effort}`, background: "transparent", color: COLORS.effort, fontFamily: "inherit", fontSize: 12, cursor: newText.trim() ? "pointer" : "not-allowed", opacity: newText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

EffortManager.propTypes = {
  efforts:  PropTypes.arrayOf(PropTypes.string).isRequired,
  tasks:    PropTypes.arrayOf(taskShape).isRequired,
  onAdd:    PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

// ── EffortCalibrationManager ──────────────────────────────────────────────────
// Displays auto-computed effort accuracy stats from completed tasks and allows
// manual overrides that the AI uses when there aren't enough data points.
function EffortCalibrationManager({ efforts, tasks, calibrationOverrides, onSetOverride, onClearOverride }) {
  const stats = {};
  efforts.forEach(label => { stats[label] = { totalActual: 0, count: 0 }; });
  tasks.filter(t => t.done && t.effort && t.actualEffort).forEach(t => {
    if (stats[t.effort]) {
      stats[t.effort].totalActual += effortToMinutes(t.actualEffort);
      stats[t.effort].count       += 1;
    }
  });

  const totalCompleted = tasks.filter(t => t.done && t.effort && t.actualEffort).length;

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.6 }}>
        When you record actual effort on completed tasks, this table updates automatically.
        The AI uses these averages to give better effort suggestions during inbox processing and project review.
        Set a manual override to seed a label before you have {MIN_CALIBRATION_SAMPLES} data points.
      </div>

      {totalCompleted === 0 && Object.values(calibrationOverrides || {}).every(v => !v) ? (
        <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", marginBottom: 16 }}>
          No calibration data yet. Complete tasks with both estimated and actual effort to build your history.
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px", gap: 8, padding: "4px 10px", fontSize: 10, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Label</span>
          <span>Auto avg</span>
          <span>Manual override</span>
          <span>AI uses</span>
        </div>

        {efforts.map(label => {
          const s = stats[label] || { totalActual: 0, count: 0 };
          const override = calibrationOverrides?.[label] || "";
          const hasEnough = s.count >= MIN_CALIBRATION_SAMPLES;
          const avgMin    = hasEnough ? Math.round(s.totalActual / s.count) : null;
          const avgLabel  = avgMin ? minutesToEffortLabel(avgMin) : null;
          const estMin    = effortToMinutes(label);
          const pct       = avgMin && estMin ? Math.round(((avgMin - estMin) / estMin) * 100) : null;
          const color     = avgMin ? effortAccuracyColor(estMin, avgMin) : COLORS.muted;

          let aiUses, aiColor;
          if (override) {
            aiUses = override; aiColor = COLORS.project;
          } else if (hasEnough && avgLabel) {
            aiUses = avgLabel; aiColor = color;
          } else {
            aiUses = "global avg"; aiColor = COLORS.muted;
          }

          return (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 80px", gap: 8, alignItems: "center", padding: "8px 10px", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.effort, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: COLORS.text }}>{label}</span>
              </div>

              <div style={{ fontSize: 12 }}>
                {hasEnough && avgLabel ? (
                  <span style={{ color }}>
                    {avgLabel}{pct !== null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}
                    <span style={{ color: COLORS.muted, fontSize: 10, marginLeft: 4 }}>n={s.count}</span>
                  </span>
                ) : s.count > 0 ? (
                  <span style={{ color: COLORS.muted }}>{s.count}/{MIN_CALIBRATION_SAMPLES} samples</span>
                ) : (
                  <span style={{ color: COLORS.muted }}>—</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <select
                  value={override}
                  onChange={e => e.target.value ? onSetOverride(label, e.target.value) : onClearOverride(label)}
                  style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${override ? COLORS.project : COLORS.border}`, borderRadius: 5, padding: "3px 6px", color: override ? COLORS.project : COLORS.muted, fontFamily: "inherit", fontSize: 12, outline: "none", colorScheme: "dark" }}
                >
                  <option value="">— none —</option>
                  {efforts.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                {override && (
                  <button
                    onClick={() => onClearOverride(label)}
                    title="Clear override"
                    style={{ padding: "2px 6px", borderRadius: 4, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
                  >✕</button>
                )}
              </div>

              <div style={{ fontSize: 11, color: aiColor, fontWeight: 500 }}>{aiUses}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
        Auto avg requires {MIN_CALIBRATION_SAMPLES}+ completed tasks per label. Manual overrides take priority.
      </div>
    </div>
  );
}

EffortCalibrationManager.propTypes = {
  efforts:              PropTypes.arrayOf(PropTypes.string).isRequired,
  tasks:                PropTypes.arrayOf(taskShape).isRequired,
  calibrationOverrides: PropTypes.objectOf(PropTypes.number).isRequired,
  onSetOverride:        PropTypes.func.isRequired,
  onClearOverride:      PropTypes.func.isRequired,
};

// ── ReviewConfigManager ──────────────────────────────────────────────────────
// Multiselect chips controlling which nodeTypes appear in the Project Review queue.
const REVIEW_NODE_OPTIONS = [
  { key: 'category',    label: 'General Categories' },
  { key: 'subcategory', label: 'SubCategories' },
  { key: 'project',     label: 'Projects' },
  { key: 'subproject',  label: 'SubProjects' },
  { key: 'task',        label: 'Tasks' },
];

function ReviewConfigManager({ reviewNodeTypes, onSetReviewNodeTypes }) {
  const toggle = (key) => {
    const next = reviewNodeTypes.includes(key)
      ? reviewNodeTypes.filter(k => k !== key)
      : [...reviewNodeTypes, key];
    onSetReviewNodeTypes(next);
  };
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 1.5 }}>
        Choose which item types appear in the Project Review queue.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {REVIEW_NODE_OPTIONS.map(({ key, label }) => {
          const active = reviewNodeTypes.includes(key);
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              style={{
                padding: '4px 12px',
                borderRadius: 14,
                border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                background: active ? COLORS.accent : 'transparent',
                color: active ? '#fff' : COLORS.text2,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

ReviewConfigManager.propTypes = {
  reviewNodeTypes:    PropTypes.arrayOf(PropTypes.string).isRequired,
  onSetReviewNodeTypes: PropTypes.func.isRequired,
};

// ── ContactTagManager ─────────────────────────────────────────────────────────
// Full CRUD for contact relationship tags with cascade rename/remove.
const CONTACT_COLOR = "#4db6ac";
function ContactTagManager({ tags, contacts, onAdd, onRename, onRemove }) {
  const [newTagText, setNewTagText] = useState("");
  const [editingTag, setEditingTag] = useState(null);
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);
  const [replaceWith, setReplaceWith] = useState("");

  const usedByCount = (name) => (contacts || []).filter(c => (c.relationshipTags || []).includes(name)).length;

  const handleAdd = () => {
    const trimmed = toContactTagCase(newTagText);
    if (!trimmed) return;
    onAdd(trimmed);
    setNewTagText("");
  };

  const startEdit = (tag) => {
    setEditingTag(tag);
    setEditText(tag);
    setRemovingName(null);
  };

  const confirmEdit = () => {
    if (editingTag !== null) {
      onRename(editingTag, editText);
      setEditingTag(null);
      setEditText("");
    }
  };

  const startRemove = (name) => {
    setRemovingName(name);
    setReplaceWith("");
    setEditingTag(null);
  };

  const confirmRemove = () => {
    onRemove(removingName, replaceWith || null);
    setRemovingName(null);
    setReplaceWith("");
  };

  const inUse = removingName ? usedByCount(removingName) : 0;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Relationship tags shared across all contacts. Rename cascades to all contacts. Rename to an existing tag to merge.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {[...(tags || [])].sort((a, b) => a.localeCompare(b)).map((tag) => {
          const count = usedByCount(tag);
          const isEditing = editingTag === tag;
          const isRemoving = removingName === tag;

          return (
            <div key={tag} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? COLORS.danger + "55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: CONTACT_COLOR, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingTag(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{tag}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} contact{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingTag(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(tag)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => startRemove(tag)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.danger}44`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: COLORS.danger }}>{inUse} contact{inUse !== 1 ? "s" : ""}</strong> use this tag. Replace with:
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          value={replaceWith}
                          onChange={e => setReplaceWith(e.target.value)}
                          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
                        >
                          <option value="">— remove tag only —</option>
                          {(tags || []).filter(t => t !== tag).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{tag}</strong>? No contacts use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(!tags || tags.length === 0) && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", padding: "6px 2px" }}>
            No custom tags yet.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newTagText}
          onChange={e => setNewTagText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New tag…"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newTagText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${CONTACT_COLOR}`, background: "transparent", color: CONTACT_COLOR, fontFamily: "inherit", fontSize: 12, cursor: newTagText.trim() ? "pointer" : "not-allowed", opacity: newTagText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

ContactTagManager.propTypes = {
  tags:     PropTypes.arrayOf(PropTypes.string).isRequired,
  contacts: PropTypes.array.isRequired,
  onAdd:    PropTypes.func.isRequired,
  onRename: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

// ── ContactCategoryManager ────────────────────────────────────────────────────
// Full CRUD for contact likes/dislikes categories with cascade rename/remap.
function ContactCategoryManager({ categories, contacts, onAdd, onRename, onRemove }) {
  const [newCatText, setNewCatText] = useState("");
  const [editingCat, setEditingCat] = useState(null);
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);
  const [replaceWith, setReplaceWith] = useState("");

  const usedByCount = (name) => (contacts || []).filter(c =>
    (c.likesPreferences || []).some(l => l.category === name) ||
    (c.dislikes || []).some(d => d.category === name)
  ).length;

  const handleAdd = () => {
    const trimmed = toContactTagCase(newCatText);
    if (!trimmed) return;
    onAdd(trimmed);
    setNewCatText("");
  };

  const startEdit = (cat) => {
    setEditingCat(cat);
    setEditText(cat);
    setRemovingName(null);
  };

  const confirmEdit = () => {
    if (editingCat !== null) {
      onRename(editingCat, editText);
      setEditingCat(null);
      setEditText("");
    }
  };

  const startRemove = (name) => {
    setRemovingName(name);
    setReplaceWith("");
    setEditingCat(null);
  };

  const confirmRemove = () => {
    onRemove(removingName, replaceWith || null);
    setRemovingName(null);
    setReplaceWith("");
  };

  const inUse = removingName ? usedByCount(removingName) : 0;

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}>
        Likes &amp; Preferences categories. Rename cascades to all contacts. Removing with a replacement remaps entries; remove-only keeps entries unchanged.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {[...(categories || [])].sort((a, b) => a.localeCompare(b)).map((cat) => {
          const count = usedByCount(cat);
          const isEditing = editingCat === cat;
          const isRemoving = removingName === cat;

          return (
            <div key={cat} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? COLORS.danger + "55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: CONTACT_COLOR, flexShrink: 0 }} />
                {isEditing ? (
                  <input
                    autoFocus
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingCat(null); }}
                    style={{ flex: 1, background: COLORS.surface3, border: `1px solid ${COLORS.border2}`, borderRadius: 5, padding: "3px 7px", color: COLORS.text, fontFamily: "inherit", fontSize: 13, outline: "none" }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, color: COLORS.text }}>{cat}</span>
                )}
                <span style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{count} contact{count !== 1 ? "s" : ""}</span>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={confirmEdit} style={{ padding: "3px 9px", borderRadius: 5, border: `1px solid ${COLORS.next}55`, background: "transparent", color: COLORS.next, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEditingCat(null)} style={{ padding: "3px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => startEdit(cat)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✎ Rename</button>
                    <button onClick={() => startRemove(cat)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${COLORS.danger}44`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: COLORS.danger }}>{inUse} contact{inUse !== 1 ? "s" : ""}</strong> use this category. Replace with:
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          value={replaceWith}
                          onChange={e => setReplaceWith(e.target.value)}
                          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none" }}
                        >
                          <option value="">— remove only (keep entries) —</option>
                          {(categories || []).filter(c => c !== cat).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{cat}</strong>? No contacts use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.danger}`, background: "transparent", color: COLORS.danger, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {(!categories || categories.length === 0) && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: "italic", padding: "6px 2px" }}>
            No custom categories yet.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={newCatText}
          onChange={e => setNewCatText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="New category… (e.g. Food, Hobbies, Books)"
          style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none" }}
        />
        <button
          onClick={handleAdd}
          disabled={!newCatText.trim()}
          style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${CONTACT_COLOR}`, background: "transparent", color: CONTACT_COLOR, fontFamily: "inherit", fontSize: 12, cursor: newCatText.trim() ? "pointer" : "not-allowed", opacity: newCatText.trim() ? 1 : 0.4 }}
        >+ Add</button>
      </div>
    </div>
  );
}

ContactCategoryManager.propTypes = {
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
  contacts:   PropTypes.array.isRequired,
  onAdd:      PropTypes.func.isRequired,
  onRename:   PropTypes.func.isRequired,
  onRemove:   PropTypes.func.isRequired,
};

// ── ContactEmailLinkingModeSetting (FR#163) ───────────────────────────────────
function ContactEmailLinkingModeSetting({ value, onChange }) {
  const opts = [
    { key: 'both',      label: 'Both (recommended)', desc: 'Link when processing emails with AI and when inbox loads' },
    { key: 'onProcess', label: 'On email processing', desc: 'Only link when you process an email with the AI coach' },
    { key: 'onLoad',    label: 'On inbox load',        desc: 'Only link when the inbox panel loads emails' },
    { key: 'off',       label: 'Off',                  desc: 'Never auto-link emails to contacts' },
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
        Controls when emails are automatically linked to matching contacts based on sender address.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opts.map(opt => {
          const active = value === opt.key;
          return (
            <div
              key={opt.key}
              onClick={() => onChange(opt.key)}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 7, border: `1px solid ${active ? '#4db6ac' : COLORS.border}`, background: active ? '#4db6ac22' : COLORS.surface2, cursor: 'pointer' }}
            >
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${active ? '#4db6ac' : COLORS.border}`, background: active ? '#4db6ac' : 'transparent', flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#4db6ac' : COLORS.text }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>{opt.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

ContactEmailLinkingModeSetting.propTypes = {
  value:    PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};



// ── ColorSettingsManager ───────────────────────────────────────────────────────
// "Colors & Appearance" settings panel. Every field falls back to
// DEFAULT_COLOR_SETTINGS until the user picks their own; a null/undefined value
// in `colors` means "use the default" and the reset (↺) button restores that by
// writing null back. Grouped to mirror the categories from the Colors settings
// discussion: container rows, status text, badges, priority tags (uniform or
// individual), GTD bucket colors, sidebar tool icons, and node types.

const GTD_BUCKET_ORDER = ['inbox', 'project', 'next', 'waiting', 'someday', 'deferred', 'done', 'inboxHistory'];

function ColorGroup({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
    </div>
  );
}
ColorGroup.propTypes = {
  title:    PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function ColorField({ label, value, defaultValue, onChange }) {
  const resolved = value || defaultValue;
  const isCustom = !!value && value !== defaultValue;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
      <input
        type="color"
        value={resolved}
        onChange={e => onChange(e.target.value)}
        style={{ width: 26, height: 26, padding: 0, border: `1px solid ${COLORS.border}`, borderRadius: 5, background: 'none', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{ fontSize: 12, color: COLORS.text2, flex: 1 }}>{label}</span>
      <input
        type="text"
        value={resolved}
        onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v); }}
        spellCheck={false}
        style={{ width: 72, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, padding: '3px 6px', color: COLORS.text, fontFamily: 'monospace', fontSize: 11, outline: 'none', flexShrink: 0, boxSizing: 'border-box' }}
      />
      <button
        onClick={() => onChange(null)}
        disabled={!isCustom}
        title="Reset to default"
        style={{ width: 22, height: 22, flexShrink: 0, background: 'none', border: 'none', color: isCustom ? COLORS.text2 : COLORS.muted, cursor: isCustom ? 'pointer' : 'default', opacity: isCustom ? 1 : 0.35, fontSize: 13, padding: 0 }}
      >↺</button>
    </div>
  );
}
ColorField.propTypes = {
  label:        PropTypes.string.isRequired,
  value:        PropTypes.string,
  defaultValue: PropTypes.string.isRequired,
  onChange:     PropTypes.func.isRequired,
};

function ColorSettingsManager({ colors, onChange }) {
  const set = (key, val) => onChange({ ...colors, [key]: val || null });
  const setNested = (group, key, val) => onChange({ ...colors, [group]: { ...(colors[group] || {}), [key]: val || null } });
  const priorityMode = colors.priorityColorMode || DEFAULT_COLOR_SETTINGS.priorityColorMode;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 480 }}>
      <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>
        Every color below falls back to the app default until you pick your own — changes apply immediately, and ↺ resets a field to default.
      </div>

      <ColorGroup title="Container rows (Category / SubCategory)">
        <ColorField label="Category row background" value={colors.categoryRowBg} defaultValue={DEFAULT_COLOR_SETTINGS.categoryRowBg} onChange={v => set('categoryRowBg', v)} />
        <ColorField label="SubCategory row background" value={colors.subcategoryRowBg} defaultValue={DEFAULT_COLOR_SETTINGS.subcategoryRowBg} onChange={v => set('subcategoryRowBg', v)} />
      </ColorGroup>

      <ColorGroup title="Task status text">
        <ColorField label="Waiting For text" value={colors.waitingText} defaultValue={DEFAULT_COLOR_SETTINGS.waitingText} onChange={v => set('waitingText', v)} />
        <ColorField label="Someday / Maybe text" value={colors.somedayText} defaultValue={DEFAULT_COLOR_SETTINGS.somedayText} onChange={v => set('somedayText', v)} />
      </ColorGroup>

      <ColorGroup title="Metadata badges">
        <ColorField label="Location tags" value={colors.tagsLocationColor} defaultValue={DEFAULT_COLOR_SETTINGS.tagsLocationColor} onChange={v => set('tagsLocationColor', v)} />
        <ColorField label="Time / Effort" value={colors.timeColor} defaultValue={DEFAULT_COLOR_SETTINGS.timeColor} onChange={v => set('timeColor', v)} />
        <ColorField label="Category" value={colors.categoryBadgeColor} defaultValue={DEFAULT_COLOR_SETTINGS.categoryBadgeColor} onChange={v => set('categoryBadgeColor', v)} />
        <ColorField label="Due date" value={colors.dueDateColor} defaultValue={DEFAULT_COLOR_SETTINGS.dueDateColor} onChange={v => set('dueDateColor', v)} />
        <ColorField label="Defer date" value={colors.deferDateColor} defaultValue={DEFAULT_COLOR_SETTINGS.deferDateColor} onChange={v => set('deferDateColor', v)} />
      </ColorGroup>

      <ColorGroup title="Priority tags">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {['uniform', 'individual'].map(mode => {
            const active = priorityMode === mode;
            return (
              <button
                key={mode}
                onClick={() => set('priorityColorMode', mode)}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + '22' : 'transparent', color: active ? COLORS.project : COLORS.text2, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
              >{mode === 'uniform' ? 'Uniform (all same color)' : 'Individual per priority'}</button>
            );
          })}
        </div>
        {priorityMode === 'individual' ? (
          PRIORITIES.map(p => (
            <ColorField key={p} label={p} value={colors.priorityColors?.[p]} defaultValue={DEFAULT_COLOR_SETTINGS.priorityColors[p]} onChange={v => setNested('priorityColors', p, v)} />
          ))
        ) : (
          <ColorField label="All priorities" value={colors.priorityUniformColor} defaultValue={DEFAULT_COLOR_SETTINGS.priorityUniformColor} onChange={v => set('priorityUniformColor', v)} />
        )}
      </ColorGroup>

      <ColorGroup title="GTD bucket / stage colors">
        {GTD_BUCKET_ORDER.map(key => (
          <ColorField key={key} label={BUCKETS[key].label} value={colors.bucketColors?.[key]} defaultValue={DEFAULT_COLOR_SETTINGS.bucketColors[key]} onChange={v => setNested('bucketColors', key, v)} />
        ))}
      </ColorGroup>

      <ColorGroup title="Sidebar tool icons">
        <ColorField label="Today's Focus" value={colors.sidebarIconColors?.focus} defaultValue={DEFAULT_COLOR_SETTINGS.sidebarIconColors.focus} onChange={v => setNested('sidebarIconColors', 'focus', v)} />
        <ColorField label="Contacts" value={colors.sidebarIconColors?.contacts} defaultValue={DEFAULT_COLOR_SETTINGS.sidebarIconColors.contacts} onChange={v => setNested('sidebarIconColors', 'contacts', v)} />
        <ColorField label="Health" value={colors.sidebarIconColors?.health} defaultValue={DEFAULT_COLOR_SETTINGS.sidebarIconColors.health} onChange={v => setNested('sidebarIconColors', 'health', v)} />
      </ColorGroup>

      <ColorGroup title="Node types">
        {NODE_TYPES.map(({ value, label }) => (
          <ColorField key={value} label={label} value={colors.nodeTypeColors?.[value]} defaultValue={DEFAULT_COLOR_SETTINGS.nodeTypeColors[value]} onChange={v => setNested('nodeTypeColors', value, v)} />
        ))}
      </ColorGroup>
    </div>
  );
}
ColorSettingsManager.propTypes = {
  colors:   PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
};

export { TagDisplaySetting, ContactEmailLinkingModeSetting, LocationManager, CategoryManager, EffortManager, EffortCalibrationManager, ReviewConfigManager, ContactTagManager, ContactCategoryManager, ColorSettingsManager };
