import { useState, useRef, useEffect } from "react";
import { useTaskDetailDrafts } from "./useTaskDetailDrafts.js";
import PropTypes from "prop-types";
import { COLORS, BUCKETS, NODE_TYPES } from "../../constants.jsx";
import { taskShape } from "../../contexts.js";
import { collectDescendantIds, effortAccuracyColor, effortToMinutes } from "./taskUtils.jsx";
import { StyledCheckbox } from "../../shared/StyledCheckbox.jsx";
import { ProjectTreePicker } from "./ProjectTreePicker.jsx";
import { driveListFiles } from "../../api/driveApi.js";
import { slidesCreatePresentation, slidesAddTextSlide } from "../../api/slidesApi.js";

// Shared style tokens used across the sub-components below.
const fieldLabel = { fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 };
const fieldInput = { width: "100%", background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "5px 8px", color: COLORS.text, fontFamily: "inherit", fontSize: 12, outline: "none", boxSizing: "border-box" };

// Trigger button + floating tree dropdown for assigning a task to a parent
// project. Sub-projects are collapsed by default and expand on hover.
// Falls back to an inline text input when "New project…" is chosen.
function ProjectSelector({ taskId, parentId, eligibleProjects, onReassignProject }) {
  const [newProjMode, setNewProjMode] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pickerOpen]);

  const selectedProject = eligibleProjects.find(p => p.id === parentId);
  const triggerLabel = selectedProject ? selectedProject.text : "— UnCategorized";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12 }}>
      <span style={{ color: COLORS.text2, width: 64, flexShrink: 0, marginTop: 5 }}>Project</span>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {!newProjMode ? (
          <div ref={pickerRef} style={{ position: "relative" }}>
            <button
              onClick={() => setPickerOpen(o => !o)}
              style={{
                ...fieldInput, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                color: parentId ? COLORS.project : COLORS.muted,
              }}
            >
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {triggerLabel}
              </span>
              <span style={{ color: COLORS.muted, fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>
            {pickerOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0,
                background: COLORS.surface2, border: `1px solid ${COLORS.border2}`,
                borderRadius: 6, padding: 4, zIndex: 50,
                maxHeight: 240, overflowY: "auto",
                boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              }}>
                <ProjectTreePicker
                  eligibleProjects={eligibleProjects}
                  selectedId={parentId}
                  onSelect={(id) => {
                    onReassignProject(taskId, id);
                    setPickerOpen(false);
                  }}
                  onNewProject={() => {
                    setPickerOpen(false);
                    setNewProjMode(true);
                    setNewProjName("");
                  }}
                  showUncategorized
                  sorted
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5 }}>
            <input
              autoFocus
              value={newProjName}
              onChange={e => setNewProjName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const name = newProjName.trim();
                  if (name) { onReassignProject(taskId, null, name); }
                  setNewProjMode(false);
                  setNewProjName("");
                }
                if (e.key === "Escape") { setNewProjMode(false); setNewProjName(""); }
              }}
              placeholder="Project name…"
              style={{ ...fieldInput, flex: 1, fontSize: 12 }}
            />
            <button
              onClick={() => {
                const name = newProjName.trim();
                if (name) { onReassignProject(taskId, null, name); }
                setNewProjMode(false);
                setNewProjName("");
              }}
              style={{ padding: "4px 8px", borderRadius: 5, border: `1px solid ${COLORS.project}`, background: "transparent", color: COLORS.project, fontFamily: "inherit", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
            >✓</button>
            <button
              onClick={() => { setNewProjMode(false); setNewProjName(""); }}
              style={{ padding: "4px 7px", borderRadius: 5, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer", flexShrink: 0 }}
            >✕</button>
          </div>
        )}
      </div>
    </div>
  );
}
ProjectSelector.propTypes = {
  taskId:            PropTypes.string.isRequired,
  parentId:          PropTypes.string,
  eligibleProjects:  PropTypes.arrayOf(taskShape).isRequired,
  onReassignProject: PropTypes.func.isRequired,
};

// Editable field for the task's original due date, with a confirmation step
// to guard against accidental variance-tracking resets.
function OriginalDueDateField({ taskId, originalDueDate, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Orig. Due</span>
      {editing ? (
        confirming ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: COLORS.muted }}>Reset original due date to {draft}? This affects variance tracking.</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { onUpdate(taskId, { originalDueDate: draft }); setEditing(false); setConfirming(false); }} style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.next}`, background: 'transparent', color: COLORS.next, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Confirm</button>
              <button onClick={() => { setEditing(false); setConfirming(false); }} style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="date"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px" }}
            />
            <button onClick={() => { if (draft) setConfirming(true); }} style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.next}`, background: 'transparent', color: COLORS.next, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Set</button>
            <button onClick={() => setEditing(false)} style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>✕</button>
          </div>
        )
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: originalDueDate ? COLORS.text : COLORS.muted }}>
            {originalDueDate || "—"}
          </span>
          <button
            onClick={() => { setDraft(originalDueDate || ""); setEditing(true); }}
            style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
          >edit</button>
        </div>
      )}
    </div>
  );
}
OriginalDueDateField.propTypes = {
  taskId:          PropTypes.string.isRequired,
  originalDueDate: PropTypes.string,
  onUpdate:        PropTypes.func.isRequired,
};

// Full recurrence configuration: frequency, interval, weekday picker,
// until date, reschedule base, and inbox-on-spawn toggle.
function RecurrenceEditor({ rec, taskId, onUpdate }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: COLORS.text2, width: 64, flexShrink: 0, fontSize: 12 }}>Repeat</span>
        <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12 }}>
          <StyledCheckbox
            checked={!!rec}
            onChange={e => onUpdate(taskId, { recurrence: e.target.checked
              ? { frequency: "weekly", interval: 1, rescheduleFrom: "completion", sendToInbox: false }
              : null })}
            accentColor={COLORS.project}
          />
          {rec ? "Enabled" : "Off"}
        </label>
      </div>
      {rec && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Base on</span>
            <select
              value={rec.rescheduleFrom || "completion"}
              onChange={e => onUpdate(taskId, { recurrence: { ...rec, rescheduleFrom: e.target.value } })}
              style={{ ...fieldInput, flex: 1, fontSize: 12, padding: "3px 6px" }}
            >
              <option value="completion">Completion date</option>
              <option value="dueDate">Original due date</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Every</span>
            <input
              type="number" min={1} max={99}
              value={rec.interval || 1}
              onChange={e => onUpdate(taskId, { recurrence: { ...rec, interval: Math.max(1, parseInt(e.target.value) || 1) } })}
              style={{ ...fieldInput, width: 46, textAlign: "center", padding: "3px 4px", fontSize: 12 }}
            />
            <select
              value={rec.frequency}
              onChange={e => onUpdate(taskId, { recurrence: { ...rec, frequency: e.target.value, weekDays: e.target.value !== "weekly" ? undefined : rec.weekDays } })}
              style={{ ...fieldInput, flex: 1, fontSize: 12, padding: "3px 6px" }}
            >
              <option value="daily">day(s)</option>
              <option value="weekly">week(s)</option>
              <option value="monthly">month(s)</option>
              <option value="yearly">year(s)</option>
            </select>
          </div>
          {rec.frequency === "weekly" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>On</span>
              <div style={{ display: "flex", gap: 3 }}>
                {["Su","Mo","Tu","We","Th","Fr","Sa"].map((day, i) => {
                  const active = (rec.weekDays || []).includes(i);
                  return (
                    <button key={day} onClick={() => {
                      const cur = rec.weekDays || [];
                      const next = active ? cur.filter(x => x !== i) : [...cur, i].sort((a,b) => a-b);
                      onUpdate(taskId, { recurrence: { ...rec, weekDays: next.length ? next : undefined } });
                    }}
                    style={{ width: 26, height: 22, borderRadius: 4, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + "22" : "transparent", color: active ? COLORS.project : COLORS.muted, fontSize: 10, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                    >{day}</button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Until</span>
            <input
              type="date"
              value={rec.until || ""}
              onChange={e => onUpdate(taskId, { recurrence: { ...rec, until: e.target.value || undefined } })}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>On spawn</span>
            <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <StyledCheckbox
                checked={!!rec.sendToInbox}
                onChange={e => onUpdate(taskId, { recurrence: { ...rec, sendToInbox: e.target.checked } })}
                accentColor={COLORS.project}
              />
              Send to Inbox
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
RecurrenceEditor.propTypes = {
  rec:      PropTypes.object,
  taskId:   PropTypes.string.isRequired,
  onUpdate: PropTypes.func.isRequired,
};

// Drive file attachments section. Loads the Google Picker lazily on first use.
// Shown only when driveEnabled is true.
function DriveAttachments({ taskId, attachments, driveEnabled, googleAccessToken, onUpdate }) {
  const pickerLoading = useRef(false);

  function ensureGapi(cb) {
    if (window.gapi && window.gapi.load) { cb(); return; }
    if (pickerLoading.current) return; // script already injected, wait
    pickerLoading.current = true;
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => { pickerLoading.current = false; cb(); };
    document.head.appendChild(script);
  }

  function openPicker() {
    const token = googleAccessToken;
    if (!token) return;
    ensureGapi(() => {
      window.gapi.load('picker', () => {
        const devKey = import.meta.env.VITE_GOOGLE_BROWSER_API_KEY;
        const picker = new window.google.picker.PickerBuilder()
          .addView(
            new window.google.picker.DocsView()
              .setIncludeFolders(false)
              .setSelectFolderEnabled(false)
          )
          .addView(new window.google.picker.DocsView(window.google.picker.ViewId.RECENTLY_PICKED))
          .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
          .setOAuthToken(token)
          .setDeveloperKey(devKey)
          .setCallback((data) => {
            if (data.action !== 'picked') return;
            const picked = (data.docs || []).map(d => ({
              id:       d.id,
              name:     d.name,
              mimeType: d.mimeType,
              url:      d.url,
            }));
            const existing = attachments || [];
            // Merge: skip duplicates
            const merged = [...existing];
            for (const att of picked) {
              if (!merged.find(a => a.id === att.id)) merged.push(att);
            }
            onUpdate(taskId, { driveAttachments: merged });
          })
          .build();
        picker.setVisible(true);
      });
    });
  }

  function removeAttachment(fileId) {
    onUpdate(taskId, { driveAttachments: (attachments || []).filter(a => a.id !== fileId) });
  }

  const [driveSearchQuery, setDriveSearchQuery] = useState('');
  const [driveSearchResults, setDriveSearchResults] = useState([]);
  const [driveSearchLoading, setDriveSearchLoading] = useState(false);

  async function handleDriveSearch(e) {
    e.preventDefault();
    const q = driveSearchQuery.trim();
    if (!q || !googleAccessToken) return;
    setDriveSearchLoading(true);
    try {
      const res = await driveListFiles({
        token: googleAccessToken,
        q: `fullText contains '${q.replace(/'/g, "\\\'")}' and trashed=false`,
        pageSize: 8,
      });
      setDriveSearchResults(res.files || []);
    } catch (err) {
      console.error('Drive search error', err);
    } finally {
      setDriveSearchLoading(false);
    }
  }

  function attachSearchResult(file) {
    const att = { id: file.id, name: file.name, mimeType: file.mimeType, url: file.webViewLink };
    const existing = attachments || [];
    if (existing.find(a => a.id === att.id)) return;
    onUpdate(taskId, { driveAttachments: [...existing, att] });
    setDriveSearchResults([]);
    setDriveSearchQuery('');
  }

  if (!driveEnabled) return null;

  // Deduplicate by id before rendering — guards against duplicate entries in driveAttachments
  const seen = new Set();
  const list = (attachments || []).filter(a => { if (!a.id || seen.has(a.id)) return false; seen.add(a.id); return true; });
  const emailAtts = list.filter(a => a.mimeType === 'message/rfc822' || a.type === 'email');
  const driveAtts = list.filter(a => a.mimeType !== 'message/rfc822' && a.type !== 'email');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {emailAtts.length > 0 && (
        <div>
          <div style={fieldLabel}>Linked Emails</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {emailAtts.map(att => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 12, flexShrink: 0 }}>📧</span>
                <a
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ flex: 1, fontSize: 12, color: COLORS.inbox, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={att.name}
                >{att.name}</a>
                <button
                  onClick={() => removeAttachment(att.id)}
                  title="Remove"
                  style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1, flexShrink: 0 }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <div style={fieldLabel}>Drive Files</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {driveAtts.map(att => (
            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <a
                href={att.url}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, fontSize: 12, color: COLORS.project, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={att.name}
              >{att.name}</a>
              <button
                onClick={() => removeAttachment(att.id)}
                title="Remove"
                style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', padding: '0 2px', fontSize: 15, lineHeight: 1, flexShrink: 0 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={openPicker}
            style={{ alignSelf: 'flex-start', padding: '3px 10px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.project, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
          >+ Attach Drive file</button>
          <form onSubmit={handleDriveSearch} style={{ display: 'flex', gap: 5, marginTop: 4 }}>
            <input
              value={driveSearchQuery}
              onChange={e => setDriveSearchQuery(e.target.value)}
              placeholder="Search Drive…"
              style={{ flex: 1, padding: '3px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.surface2, color: COLORS.text, fontFamily: 'inherit', fontSize: 11, outline: 'none' }}
            />
            <button type="submit" disabled={driveSearchLoading} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.project, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
              {driveSearchLoading ? '…' : 'Search'}
            </button>
          </form>
          {driveSearchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4, padding: '6px 8px', background: COLORS.surface3, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
              {driveSearchResults.map(file => (
                <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ flex: 1, fontSize: 11, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>{file.name}</span>
                  <button
                    onClick={() => attachSearchResult(file)}
                    style={{ padding: '2px 7px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.project, fontFamily: 'inherit', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}
                  >+ Attach</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
DriveAttachments.propTypes = {
  taskId:            PropTypes.string.isRequired,
  attachments:       PropTypes.array,
  driveEnabled:      PropTypes.bool,
  slidesEnabled:     PropTypes.bool,
  googleAccessToken: PropTypes.string,
  onUpdate:          PropTypes.func.isRequired,
};

// Generates a Google Slides briefing deck from a project task and its subtasks.
// Shown in TaskDetailPanel only when Slides is connected and the task has children.
function SlidesGenerator({ task, allTasks, googleAccessToken, onUpdate }) {
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingUrl, setBriefingUrl] = useState(null);
  const [briefingErr, setBriefingErr] = useState(null);

  async function handleGenerateBriefing() {
    setBriefingLoading(true);
    setBriefingErr(null);
    try {
      const presentation = await slidesCreatePresentation({ token: googleAccessToken, title: task.text });

      // Attach to task and expose link immediately — the presentation exists even if slide writes fail
      const att = {
        id: presentation.presentationId,
        name: task.text,
        mimeType: 'application/vnd.google-apps.presentation',
        url: presentation.presentationUrl,
      };
      const existing = task.driveAttachments || [];
      if (!existing.find(a => a.id === att.id)) {
        onUpdate(task.id, { driveAttachments: [...existing, att] });
      }
      setBriefingUrl(presentation.presentationUrl);

      // Add content slides — failures are reported but don't suppress the link
      const subtasks = allTasks.filter(t => (task.childIds || []).includes(t.id) && !t.done);
      const slideErrors = [];
      for (const subtask of subtasks) {
        try {
          await slidesAddTextSlide({
            token: googleAccessToken,
            presentationId: presentation.presentationId,
            title: subtask.text,
            body: subtask.notes || '',
          });
        } catch (err) {
          console.error('slidesAddTextSlide error', err);
          slideErrors.push(subtask.text + ': ' + (err.message || 'unknown error'));
        }
      }
      if (slideErrors.length > 0) {
        setBriefingErr(`Slides created but content failed for: ${slideErrors.join(', ')}`);
      }
    } catch (err) {
      console.error('generateBriefing error', err);
      setBriefingErr(err.message || 'Failed to create presentation');
    } finally {
      setBriefingLoading(false);
    }
  }

  return (
    <div>
      <div style={fieldLabel}>Slides Briefing</div>
      <button
        onClick={handleGenerateBriefing}
        disabled={briefingLoading}
        style={{ padding: '4px 12px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.project, fontFamily: 'inherit', fontSize: 12, cursor: briefingLoading ? 'not-allowed' : 'pointer' }}
      >{briefingLoading ? 'Generating…' : '🎞️ Generate Slides Briefing'}</button>
      {briefingUrl && (
        <a href={briefingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: COLORS.next, textDecoration: 'none', marginTop: 4, display: 'block' }}>View presentation ↗</a>
      )}
      {briefingErr && (
        <div style={{ fontSize: 11, color: COLORS.danger || '#c0392b', marginTop: 4 }}>{briefingErr}</div>
      )}
    </div>
  );
}
SlidesGenerator.propTypes = {
  task:              taskShape.isRequired,
  allTasks:          PropTypes.arrayOf(taskShape).isRequired,
  googleAccessToken: PropTypes.string.isRequired,
  onUpdate:          PropTypes.func.isRequired,
};

// Side panel showing full task detail: editable title and notes, all metadata
// fields, bucket move, complete/skip/delete actions.
function TaskDetailPanel({ task, allTasks, locations, efforts, categories, driveEnabled, slidesEnabled, googleAccessToken, currentBucket, onUpdate, onComplete, onDelete, onReassignProject, onSkipRecurrence, onClose, style }) {
  const {
    titleDraft, setTitleDraft, saveTitle,
    notesDraft, setNotesDraft, saveNotes,
  } = useTaskDetailDrafts({ task, onUpdate, onClose });

  const bucketColor = BUCKETS[task.bucket]?.color || COLORS.muted;
  const bucketLabel = BUCKETS[task.bucket]?.label || task.bucket;

  // Exclude the task and all its descendants from eligible parent projects
  // to prevent circular references in the project hierarchy.
  const excludedIds = collectDescendantIds(task.id, allTasks);
  const eligibleProjects = allTasks.filter(
    t => t.bucket === "project" && !t.done && !excludedIds.has(t.id)
  );
  const hasProjectChildren = allTasks.some(t => t.parentId === task.id && t.bucket === 'project');
  // nodeType===null on existing project-bucket tasks displays as 'project'; on next-bucket tasks as 'task'
  const effectiveNodeType = task.nodeType ?? (task.isNextAction ? 'task' : task.bucket === 'project' ? 'project' : 'task');

  return (
    <div style={{ ...style, background: COLORS.surface, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px", borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase", flex: 1 }}>Task Detail</span>
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{ background: "none", border: "none", color: COLORS.muted, fontSize: 16, cursor: "pointer", padding: "0 2px", lineHeight: 1 }}
        >×</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 10px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Title */}
        <div>
          <div style={fieldLabel}>Title</div>
          <input
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } if (e.key === "Escape") { setTitleDraft(task.text); e.target.blur(); } }}
            style={{ ...fieldInput, fontSize: 13, fontWeight: 500 }}
          />
        </div>

        {/* Notes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 140 }}>
          <div style={fieldLabel}>Notes</div>
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add notes, context, links…"
            style={{ ...fieldInput, flex: 1, resize: "none", lineHeight: 1.5, minHeight: 120 }}
          />
        </div>

        {/* Drive attachments */}
        <DriveAttachments
          taskId={task.id}
          attachments={task.driveAttachments}
          driveEnabled={driveEnabled}
          googleAccessToken={googleAccessToken}
          onUpdate={onUpdate}
        />

        {/* Slides briefing — shown for project tasks when Slides is connected */}
        {slidesEnabled && googleAccessToken && (task.bucket === 'project' || (task.childIds && task.childIds.length > 0)) && (
          <SlidesGenerator
            task={task}
            allTasks={allTasks}
            googleAccessToken={googleAccessToken}
            onUpdate={onUpdate}
          />
        )}

        {/* Metadata */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={fieldLabel}>Info</div>

          {/* Bucket (read-only label) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Bucket</span>
            <span style={{ color: bucketColor, fontWeight: 500 }}>{bucketLabel}</span>
          </div>

          {/* Type toggle — nodeType selector, visible in Projects and Next Actions views */}
          {(['project', 'next', 'waiting', 'someday', 'deferred'].includes(currentBucket)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Type</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {NODE_TYPES.map(({ value, label, color }) => {
                  const isTask = value === 'task';
                  const isActive = effectiveNodeType === value;
                  const disabled = isTask && hasProjectChildren;
                  return (
                    <button
                      key={value}
                      onClick={() => {
                        if (disabled) return;
                        const moveBucket = ['project', 'next'].includes(currentBucket);
                        onUpdate(task.id, moveBucket
                          ? (isTask ? { nodeType: 'task', isNextAction: true, bucket: 'project' } : { nodeType: value, isNextAction: false, bucket: 'project' })
                          : { nodeType: value });
                      }}
                      title={disabled ? 'Cannot convert to task: node has sub-projects' : undefined}
                      style={{ padding: '2px 10px', borderRadius: 10, border: `1px solid ${isActive ? color : COLORS.border}`, background: isActive ? color + '22' : 'transparent', color: isActive ? color : COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
                    >{label}</button>
                  );
                })}
              </div>
              {hasProjectChildren && (
                <span style={{ fontSize: 10, color: COLORS.muted }}>has sub-projects</span>
              )}
            </div>
          )}

          {/* Waiting For / Someday flags */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Flags</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => onUpdate(task.id, { isWaitingFor: !task.isWaitingFor })}
                style={{ padding: '2px 10px', borderRadius: 10, border: `1px solid ${task.isWaitingFor ? '#c04040' : COLORS.border}`, background: task.isWaitingFor ? '#c0404022' : 'transparent', color: task.isWaitingFor ? '#c04040' : COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
              >Waiting For</button>
              <button
                onClick={() => onUpdate(task.id, { isSomeday: !task.isSomeday })}
                style={{ padding: '2px 10px', borderRadius: 10, border: `1px solid ${task.isSomeday ? COLORS.someday || '#888' : COLORS.border}`, background: task.isSomeday ? (COLORS.someday || '#888') + '22' : 'transparent', color: task.isSomeday ? COLORS.someday || '#888' : COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
              >Someday/Maybe</button>
            </div>
          </div>

          {/* Move to bucket */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Move to</span>
            <select
              value={task.bucket}
              onChange={e => onUpdate(task.id, { bucket: e.target.value })}
              style={{ ...fieldInput, flex: 1, fontSize: 12, colorScheme: 'dark' }}
            >
              {Object.entries(BUCKETS).filter(([k]) => !['inboxHistory', 'waiting', 'someday', 'deferred'].includes(k)).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <ProjectSelector
            taskId={task.id}
            parentId={task.parentId}
            eligibleProjects={eligibleProjects}
            onReassignProject={onReassignProject}
          />

          <OriginalDueDateField
            taskId={task.id}
            originalDueDate={task.originalDueDate}
            onUpdate={onUpdate}
          />

          {/* Due date */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Due</span>
            <input
              type="date"
              value={task.dueDate || ""}
              onChange={e => onUpdate(task.id, { dueDate: e.target.value || null })}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px" }}
            />
          </div>

          {/* Due time */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Due time</span>
            <input
              type="time"
              value={task.dueTime || ""}
              onChange={e => onUpdate(task.id, { dueTime: e.target.value || null })}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px", colorScheme: "dark" }}
            />
            {task.dueTime && (
              <button
                onClick={() => onUpdate(task.id, { dueTime: null })}
                style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 11, padding: "0 2px" }}
                title="Clear time"
              >✕</button>
            )}
          </div>

          {/* Defer until */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Defer</span>
            <input
              type="date"
              value={task.deferUntil || ""}
              onChange={e => onUpdate(task.id, { deferUntil: e.target.value || null })}
              style={{ ...fieldInput, width: "auto", fontSize: 12, padding: "3px 6px" }}
            />
          </div>

          {/* Completed date — read-only */}
          {task.completedDate && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Completed</span>
              <span>{task.completedDate}</span>
            </div>
          )}

          {/* Variance — only when originalDueDate is set */}
          {task.originalDueDate && (task.dueDate || task.completedDate) && (() => {
            const ref = new Date(task.originalDueDate);
            const cmp = new Date(task.completedDate || task.dueDate);
            const days = Math.round((cmp - ref) / 86400000);
            const color = days <= 0 ? "#22c55e" : days <= 7 ? "#f59e0b" : "#ef4444";
            const label = days === 0 ? "On time" : days < 0 ? `${Math.abs(days)}d early` : `${days}d late`;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Variance</span>
                <span style={{ background: color + "22", color, border: `1px solid ${color}55`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{label}</span>
              </div>
            );
          })()}

          <RecurrenceEditor rec={task.recurrence || null} taskId={task.id} onUpdate={onUpdate} />

          {/* Effort (estimated) */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Estimated</span>
            <select
              value={task.effort || ""}
              onChange={e => onUpdate(task.id, { effort: e.target.value || null })}
              style={{ ...fieldInput, width: 'auto', fontSize: 12, padding: '3px 6px' }}
            >
              <option value=''>—</option>
              {(efforts || []).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Actual effort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Actual</span>
            <select
              value={task.actualEffort || ""}
              onChange={e => onUpdate(task.id, { actualEffort: e.target.value || null })}
              style={{ ...fieldInput, width: 'auto', fontSize: 12, padding: '3px 6px', colorScheme: 'dark', color: task.actualEffort ? effortAccuracyColor(effortToMinutes(task.effort), effortToMinutes(task.actualEffort)) : COLORS.text }}
            >
              <option value=''>—</option>
              {(efforts || []).map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            {task.effort && task.actualEffort && (() => {
              const estMin = effortToMinutes(task.effort);
              const actMin = effortToMinutes(task.actualEffort);
              const pct = estMin ? Math.round(((actMin - estMin) / estMin) * 100) : null;
              const color = effortAccuracyColor(estMin, actMin);
              return pct !== null ? (
                <span style={{ fontSize: 11, color, fontWeight: 500 }}>
                  {pct > 0 ? `+${pct}%` : `${pct}%`}
                </span>
              ) : null;
            })()}
          </div>

          {/* Reviewed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>
              {'Reviewed'}
            </span>
            <StyledCheckbox
              checked={task.reviewed ?? false}
              onChange={e => onUpdate(task.id, { reviewed: e.target.checked })}
            />
          </div>

          {/* Category */}
          {(categories || []).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: COLORS.text2, width: 64, flexShrink: 0 }}>Category</span>
              <select
                value={task.category || ''}
                onChange={e => onUpdate(task.id, { category: e.target.value || null })}
                style={{ ...fieldInput, width: 'auto', fontSize: 12, padding: '3px 6px', colorScheme: 'dark', color: task.category ? '#d4a844' : COLORS.text }}
              >
                <option value=''>—</option>
                {(categories || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Location tags */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.text2, width: 64, flexShrink: 0, paddingTop: 2 }}>Location</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(locations || []).map(loc => {
                const active = (task.location || []).includes(loc);
                return (
                  <button
                    key={loc}
                    onClick={() => {
                      const cur = task.location || [];
                      onUpdate(task.id, { location: active ? cur.filter(l => l !== loc) : [...cur, loc] });
                    }}
                    style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${active ? COLORS.project : COLORS.border}`, background: active ? COLORS.project + '22' : 'transparent', color: active ? COLORS.project : '#81807a', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}
                  >{loc}</button>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', borderTop: `1px solid ${COLORS.border}`, flexShrink: 0, flexWrap: 'wrap' }}>
        <button
          onClick={() => onComplete(task.id)}
          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${COLORS.next}`, background: 'transparent', color: COLORS.next, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
        >✓ Complete</button>
        {task.recurrence && onSkipRecurrence && (
          <button
            onClick={() => onSkipRecurrence(task.id)}
            title="Skip this occurrence — advances schedule without completing"
            style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${COLORS.deferred}`, background: 'transparent', color: COLORS.deferred, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >↻ Skip</button>
        )}
        <button
          onClick={() => { if (window.confirm(`Delete "${task.text}"?`)) onDelete(task.id); }}
          style={{ flex: 1, padding: '6px 0', borderRadius: 7, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
        >🗑 Delete</button>
      </div>
    </div>
  );
}

TaskDetailPanel.propTypes = {
  task:              taskShape.isRequired,
  allTasks:          PropTypes.arrayOf(taskShape).isRequired,
  locations:         PropTypes.arrayOf(PropTypes.string).isRequired,
  efforts:           PropTypes.arrayOf(PropTypes.string).isRequired,
  categories:        PropTypes.arrayOf(PropTypes.string),
  currentBucket:     PropTypes.string,
  driveEnabled:      PropTypes.bool,
  googleAccessToken: PropTypes.string,
  onUpdate:          PropTypes.func.isRequired,
  onComplete:        PropTypes.func.isRequired,
  onDelete:          PropTypes.func.isRequired,
  onReassignProject: PropTypes.func.isRequired,
  onSkipRecurrence:  PropTypes.func,
  onClose:           PropTypes.func.isRequired,
  style:             PropTypes.object,
};

export { TaskDetailPanel };
