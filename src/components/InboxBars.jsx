import { useState } from "react";
import { COLORS } from "../constants.jsx";

const BUCKET_OPTS = [
  { key: 'inbox',   label: 'Inbox' },
  { key: 'next',    label: 'Next Actions' },
  { key: 'project', label: 'Projects' },
  { key: 'waiting', label: 'Waiting For' },
  { key: 'someday', label: 'Someday/Maybe' },
];

// ── InboxBulkBar ─────────────────────────────────────────────────────────────
// Sticky toolbar that appears at the top of the Inbox when tasks are selected.
function InboxBulkBar({ selectedCount, allTasks, onAssign, onClear }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("pick"); // "pick" | "newName"
  const [newName, setNewName] = useState("");
  const [chosen, setChosen] = useState("");
  const rootProjects = allTasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);

  const handleConfirm = () => {
    if (mode === "newName") {
      if (!newName.trim()) return;
      onAssign(null, newName.trim());
    } else {
      if (!chosen) return;
      if (chosen === "__new__") { setMode("newName"); return; }
      onAssign(chosen, null);
    }
    setOpen(false);
    setMode("pick");
    setNewName("");
    setChosen("");
  };

  return (
    <div style={{ background: COLORS.projectBg, borderBottom: `1px solid ${COLORS.project}44`, padding: "7px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 10 }}>
      <span style={{ fontSize: 12, color: COLORS.project, fontWeight: 600 }}>
        {selectedCount} task{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => { setOpen(o => !o); setMode("pick"); setChosen(""); setNewName(""); }}
          style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
        >
          📁 Assign to Project ▾
        </button>
        {open && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: COLORS.surface, border: `1px solid ${COLORS.border2}`, borderRadius: 8, padding: 10, zIndex: 100, minWidth: 240, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", gap: 8 }}>
            {mode === "pick" ? (
              <>
                <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Choose project</div>
                <select
                  value={chosen}
                  onChange={e => setChosen(e.target.value)}
                  autoFocus
                  style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, padding: "5px 8px", fontFamily: "inherit", fontSize: 12, outline: "none" }}
                >
                  <option value="">— Select —</option>
                  {rootProjects.map(p => <option key={p.id} value={p.id}>{p.text}</option>)}
                  <option value="__new__">＋ New project…</option>
                </select>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleConfirm} disabled={!chosen} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: chosen ? COLORS.project + "22" : "transparent", color: chosen ? COLORS.project : COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: chosen ? "pointer" : "default", fontWeight: 600 }}>
                    {chosen === "__new__" ? "Next →" : "Assign"}
                  </button>
                  <button onClick={() => setOpen(false)} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>New project name</div>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleConfirm(); if (e.key === "Escape") setOpen(false); }}
                  placeholder="Project name…"
                  style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, padding: "5px 8px", fontFamily: "inherit", fontSize: 12, outline: "none" }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={handleConfirm} disabled={!newName.trim()} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: newName.trim() ? COLORS.project + "22" : "transparent", color: newName.trim() ? COLORS.project : COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: newName.trim() ? "pointer" : "default", fontWeight: 600 }}>Create & Assign</button>
                  <button onClick={() => setMode("pick")} style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>← Back</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onClear}
        style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
      >✕ Clear</button>
    </div>
  );
}

// ── ProjectGroupSuggestionBar ─────────────────────────────────────────────────
// Appears in the chat panel after calendar tasks are accepted, offering to group
// the new tasks into an existing or new project.
function ProjectGroupSuggestionBar({ suggestion, taskCount, allTasks, onAccept, onDismiss }) {
  const [overrideName, setOverrideName] = useState(suggestion.name || "");
  const [showAlt, setShowAlt] = useState(false);
  const [altChoice, setAltChoice] = useState("");
  const rootProjects = allTasks.filter(t => t.bucket === "project" && !t.parentId && !t.done);

  const handleAccept = () => {
    if (suggestion.type === "existing") onAccept(suggestion.projectId, null);
    else onAccept(null, overrideName.trim() || suggestion.name);
  };

  const handleAltConfirm = () => {
    if (!altChoice) return;
    if (altChoice === "__new__") return; // handled by the name input below
    onAccept(altChoice, null);
  };

  return (
    <div style={{ background: COLORS.projectBg, border: `1px solid ${COLORS.project}44`, borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        📁 AI project suggestion
      </div>
      {suggestion.type === "existing" ? (
        <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
          These {taskCount} tasks look like they belong in{" "}
          <strong style={{ color: COLORS.project }}>"{suggestion.name}"</strong>.
          Assign them there?
        </div>
      ) : (
        <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.5 }}>
          These {taskCount} tasks look like they belong together. Create a new project?
        </div>
      )}

      {suggestion.type === "new" && (
        <input
          value={overrideName}
          onChange={e => setOverrideName(e.target.value)}
          placeholder="Project name…"
          style={{ background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, padding: "5px 8px", fontFamily: "inherit", fontSize: 12, outline: "none" }}
        />
      )}

      {showAlt && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select
            value={altChoice}
            onChange={e => setAltChoice(e.target.value)}
            style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 5, color: COLORS.text, padding: "4px 6px", fontFamily: "inherit", fontSize: 12, outline: "none" }}
          >
            <option value="">— Pick project —</option>
            {rootProjects.map(p => <option key={p.id} value={p.id}>{p.text}</option>)}
          </select>
          <button onClick={handleAltConfirm} disabled={!altChoice} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: altChoice ? COLORS.project : COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: altChoice ? "pointer" : "default" }}>Assign</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={handleAccept}
          disabled={suggestion.type === "new" && !overrideName.trim()}
          style={{ padding: "4px 14px", borderRadius: 6, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
        >
          {suggestion.type === "existing" ? "Yes, assign ✓" : "Create & assign ✓"}
        </button>
        {!showAlt && (
          <button
            onClick={() => setShowAlt(true)}
            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
          >
            Different project…
          </button>
        )}
        <button
          onClick={onDismiss}
          style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}


export { BUCKET_OPTS, InboxBulkBar, ProjectGroupSuggestionBar };
