import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";
import { taskShape } from "../contexts.js";
import {
  effortAccuracyColor, effortToMinutes, minutesToEffortLabel, MIN_CALIBRATION_SAMPLES,
} from "../utils/taskUtils.jsx";
import {
  createEmptyUsageStats, fmtCost, fmtTokens,
} from "../hooks/useAIUsageTracking.js";
import { GMAIL_SCOPE_OPTS, GMAIL_SCOPE_DISPLAY } from "../api/gmailTools.js";

function SettingsSection({ label, storageKey, children }) {
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) === "1");
  const toggle = () => setOpen(v => {
    const next = !v;
    localStorage.setItem(storageKey, next ? "1" : "0");
    return next;
  });
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <button
        onClick={toggle}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", background: "transparent", border: "none", cursor: "pointer", color: COLORS.text, fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: COLORS.muted }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={{ paddingBottom: 20 }}>{children}</div>}
    </div>
  );
}

// ── Usage Panel ───────────────────────────────────────────────────
const MODE_LABELS = {
  chat: 'Chat', process: 'Process Inbox', weeklyReview: 'Weekly Review',
  brainDump: 'Brain Dump', projectReview: 'Project Review', projectMetadata: 'Project Metadata',
};

function UsagePanel({ stats, onClear, onClose }) {
  const s = stats || createEmptyUsageStats();
  const totalCost = (s.byProvider?.claude?.costUsd || 0);
  const totalSaved = (s.byProvider?.ollama?.savedUsd || 0);
  const claudeIn = s.byProvider?.claude?.inputTokens || 0;
  const claudeOut = s.byProvider?.claude?.outputTokens || 0;
  const claudeReq = s.byProvider?.claude?.requests || 0;
  const ollamaIn = s.byProvider?.ollama?.inputTokens || 0;
  const ollamaOut = s.byProvider?.ollama?.outputTokens || 0;
  const ollamaReq = s.byProvider?.ollama?.requests || 0;

  const avgTokSec = (() => {
    if (!s.history || s.history.length === 0) return null;
    const valid = s.history.filter(h => h.durationMs > 0 && h.outputTokens > 0);
    if (valid.length === 0) return null;
    const avg = valid.reduce((a, h) => a + (h.outputTokens / (h.durationMs / 1000)), 0) / valid.length;
    return avg.toFixed(1);
  })();

  const sectionHd = { fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '20px 0 8px' };
  const stat = (label, value, sub) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <span style={{ fontSize: 12, color: COLORS.text }}>{label}</span>
      <span style={{ fontSize: 12, color: COLORS.text2 }}>{value}{sub && <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: 4 }}>{sub}</span>}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 300 }}>📊 AI Usage</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Lifetime token usage and cost tracking</div>
        </div>
        <button onClick={onClose} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>✕ Close</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>

        {/* Lifetime totals */}
        <div style={sectionHd}>Lifetime Totals</div>
        {stat('Total requests', (s.totalRequests || 0).toLocaleString())}
        {stat('Input tokens', fmtTokens(s.totalInputTokens || 0), `(${(s.totalInputTokens || 0).toLocaleString()})`)}
        {stat('Output tokens', fmtTokens(s.totalOutputTokens || 0), `(${(s.totalOutputTokens || 0).toLocaleString()})`)}
        {avgTokSec && stat('Avg output speed', `${avgTokSec} tok/s`)}

        {/* By provider */}
        <div style={sectionHd}>By Provider</div>
        <div style={{ background: COLORS.surface2, borderRadius: 8, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          {/* Claude */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Claude (Anthropic)</span>
              <span style={{ fontSize: 13, color: COLORS.inbox, fontWeight: 600 }}>{fmtCost(totalCost)}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLORS.muted }}>
              <span>{claudeReq.toLocaleString()} requests</span>
              <span>↑ {fmtTokens(claudeIn)} in</span>
              <span>↓ {fmtTokens(claudeOut)} out</span>
            </div>
          </div>
          {/* Ollama */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Local LLM (Ollama)</span>
              <span style={{ fontSize: 11, color: COLORS.next, fontWeight: 600 }}>Free · saved {fmtCost(totalSaved)}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLORS.muted }}>
              <span>{ollamaReq.toLocaleString()} requests</span>
              <span>↑ {fmtTokens(ollamaIn)} in</span>
              <span>↓ {fmtTokens(ollamaOut)} out</span>
            </div>
            {totalSaved > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: COLORS.next }}>
                💰 You saved {fmtCost(totalSaved)} by using a local model instead of Claude
              </div>
            )}
          </div>
        </div>

        {/* By mode */}
        <div style={sectionHd}>By Mode</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: COLORS.muted }}>
              <th style={{ textAlign: 'left', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Mode</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Requests</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Input</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Output</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(s.byMode || {}).sort((a, b) => b[1].requests - a[1].requests).map(([mode, ms]) => (
              <tr key={mode}>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text }}>{MODE_LABELS[mode] || mode}</td>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', color: COLORS.text2 }}>{ms.requests}</td>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', color: COLORS.text2 }}>{fmtTokens(ms.inputTokens)}</td>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', color: COLORS.text2 }}>{fmtTokens(ms.outputTokens)}</td>
              </tr>
            ))}
            {Object.keys(s.byMode || {}).length === 0 && (
              <tr><td colSpan={4} style={{ padding: '12px 0', color: COLORS.muted, textAlign: 'center' }}>No usage recorded yet</td></tr>
            )}
          </tbody>
        </table>

        {/* Clear */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
          <button
            onClick={() => { if (window.confirm('Clear all lifetime usage statistics? This cannot be undone.')) onClear(); }}
            style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
          >🗑 Clear all stats</button>
        </div>
      </div>
    </div>
  );
}


function SettingsPanel({ locations, tasks, onAdd, onRename, onRemove, efforts, onAddEffort, onRenameEffort, onRemoveEffort, calibrationOverrides, onSetCalibrationOverride, onClearCalibrationOverride, tagDisplay, onSetTagDisplay, onExport, onImport, onClose, googleToken, googleScope, onConnectGmail, onDisconnectGmail, gmailError, calendarEnabled, onConnectCalendar, onDisconnectCalendar, recurringReviewDays, onSetRecurringReviewDays }) {
  const fileInputRef = useRef(null);

  const [importMode, setImportMode] = useState("replace");
  const [gmailPendingScope, setGmailPendingScope] = useState('readonly');
  const [gmailChangingScope, setGmailChangingScope] = useState(false);
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        onImport(data, importMode);
      } catch {
        alert("Could not parse backup file — make sure it's a valid GTD JSON export.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px 10px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 16, fontWeight: 300 }}>⚙ Settings</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Configure your GTD system</div>
        </div>
        <button
          onClick={onClose}
          style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
        >✕ Close</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px" }}>
        <SettingsSection label="Google / Gmail" storageKey="gtd_settings_gmail">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Connect Gmail to let the AI coach read and act on your inbox. Choose the access level below.
          </div>
          {googleToken ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: COLORS.next }}>✓ Gmail connected — {GMAIL_SCOPE_DISPLAY[googleScope] || googleScope || 'read only'}</span>
                {!gmailChangingScope && (<>
                  <button onClick={() => { setGmailPendingScope(googleScope || 'readonly'); setGmailChangingScope(true); }}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Change</button>
                  <button onClick={onDisconnectGmail}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Disconnect</button>
                </>)}
                {gmailChangingScope && (
                  <button onClick={onDisconnectGmail}
                    style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>Disconnect</button>
                )}
              </div>
              {gmailChangingScope && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {GMAIL_SCOPE_OPTS.map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                      borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${gmailPendingScope === opt.key ? COLORS.accent : COLORS.border2}`,
                      background: gmailPendingScope === opt.key ? COLORS.surface3 : 'transparent' }}>
                      <input type="radio" name="gmail_scope_change" value={opt.key}
                        checked={gmailPendingScope === opt.key}
                        onChange={() => setGmailPendingScope(opt.key)}
                        style={{ accentColor: COLORS.accent, cursor: 'pointer' }} />
                      <span style={{ fontSize: 12, fontWeight: gmailPendingScope === opt.key ? 600 : 400, color: COLORS.text, minWidth: 68 }}>{opt.label}</span>
                      <span style={{ fontSize: 11, color: COLORS.muted }}>{opt.desc}</span>
                    </label>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => { setGmailChangingScope(false); onConnectGmail(gmailPendingScope); }}
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: '#fff', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Reconnect</button>
                    <button onClick={() => setGmailChangingScope(false)}
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              )}
              {gmailError && <div style={{ fontSize: 11, color: '#d4845a', lineHeight: 1.4 }}>⚠ {gmailError}</div>}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
                {GMAIL_SCOPE_OPTS.map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                    borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${gmailPendingScope === opt.key ? COLORS.accent : COLORS.border2}`,
                    background: gmailPendingScope === opt.key ? COLORS.surface3 : 'transparent' }}>
                    <input type="radio" name="gmail_scope" value={opt.key}
                      checked={gmailPendingScope === opt.key}
                      onChange={() => setGmailPendingScope(opt.key)}
                      style={{ accentColor: COLORS.accent, cursor: 'pointer' }} />
                    <span style={{ fontSize: 12, fontWeight: gmailPendingScope === opt.key ? 600 : 400, color: COLORS.text, minWidth: 68 }}>{opt.label}</span>
                    <span style={{ fontSize: 11, color: COLORS.muted }}>{opt.desc}</span>
                  </label>
                ))}
              </div>
              <button onClick={() => onConnectGmail(gmailPendingScope)}
                style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${COLORS.border2}`,
                         background: COLORS.surface3, color: COLORS.text2, fontFamily: 'inherit',
                         fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                         alignSelf: 'flex-start' }}>
                <span style={{ fontSize: 14 }}>G</span> Connect Gmail
              </button>
              {gmailError && <div style={{ fontSize: 11, color: '#d4845a', lineHeight: 1.4 }}>⚠ {gmailError}</div>}
            </div>
          )}
        </SettingsSection>
        <SettingsSection label="Google Calendar" storageKey="gtd_settings_calendar">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Connect Google Calendar to view events, add tasks as calendar events, and let the AI suggest tasks from your calendar.
          </div>
          {!calendarEnabled && <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10, lineHeight: 1.4, padding: '7px 10px', background: COLORS.surface2, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
            ⚠ Before connecting, enable the <strong style={{ color: COLORS.text2 }}>Google Calendar API</strong> in your Google Cloud Console project and add the <code style={{ fontSize: 10, background: COLORS.surface3, padding: '1px 4px', borderRadius: 3 }}>calendar.events</code> scope to your OAuth consent screen.
          </div>}
          {calendarEnabled ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: COLORS.next }}>✓ Calendar connected</span>
              <button onClick={onDisconnectCalendar}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
                Disconnect
              </button>
              <button onClick={onConnectCalendar}
                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
                Reconnect
              </button>
            </div>
          ) : (
            <button onClick={onConnectCalendar}
              style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
              <span style={{ fontSize: 14 }}>📅</span> Connect Calendar
            </button>
          )}
        </SettingsSection>
        <SettingsSection label="Weekly Review" storageKey="gtd_settings_weekly_review">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Recurring calendar events you’ve reviewed will resurface during your Weekly Review after this many days.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: COLORS.text2 }}>Resurface after</label>
            <input
              type="number" min="1" max="365"
              value={recurringReviewDays}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v > 0) onSetRecurringReviewDays(v); }}
              style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text, fontFamily: 'inherit', fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: COLORS.text2 }}>days</span>
          </div>
        </SettingsSection>
        <SettingsSection label="Tag Display" storageKey="gtd_settings_tag_display">
          <TagDisplaySetting value={tagDisplay} onChange={onSetTagDisplay} />
        </SettingsSection>
        <SettingsSection label="Locations" storageKey="gtd_settings_locations">
          <LocationManager locations={locations} tasks={tasks} onAdd={onAdd} onRename={onRename} onRemove={onRemove} />
        </SettingsSection>
        <SettingsSection label="Effort Levels" storageKey="gtd_settings_efforts">
          <EffortManager efforts={efforts} tasks={tasks} onAdd={onAddEffort} onRename={onRenameEffort} onRemove={onRemoveEffort} />
        </SettingsSection>
        <SettingsSection label="Effort Calibration" storageKey="gtd_settings_calibration">
          <EffortCalibrationManager
            efforts={efforts}
            tasks={tasks}
            calibrationOverrides={calibrationOverrides}
            onSetOverride={onSetCalibrationOverride}
            onClearOverride={onClearCalibrationOverride}
          />
        </SettingsSection>
        <SettingsSection label="Backup & Restore" storageKey="gtd_settings_backup">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14, lineHeight: 1.5 }}>
            Export all tasks, locations, and effort labels to a JSON file.{" "}
            <strong style={{ color: COLORS.text2 }}>Replace</strong> overwrites all current tasks;{" "}
            <strong style={{ color: COLORS.text2 }}>Merge</strong> adds only tasks from the backup that don't already exist.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={onExport}
              style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >⬇ Export</button>
            <button
              onClick={() => { setImportMode("replace"); fileInputRef.current?.click(); }}
              style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >⬆ Import (Replace)</button>
            <button
              onClick={() => { setImportMode("merge"); fileInputRef.current?.click(); }}
              style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}
            >⬆ Import (Merge)</button>
            <input ref={fileInputRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleFileChange} />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

SettingsPanel.propTypes = {
  locations:                  PropTypes.arrayOf(PropTypes.string).isRequired,
  tasks:                      PropTypes.arrayOf(taskShape).isRequired,
  onAdd:                      PropTypes.func.isRequired,
  onRename:                   PropTypes.func.isRequired,
  onRemove:                   PropTypes.func.isRequired,
  efforts:                    PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddEffort:                PropTypes.func.isRequired,
  onRenameEffort:             PropTypes.func.isRequired,
  onRemoveEffort:             PropTypes.func.isRequired,
  calibrationOverrides:       PropTypes.objectOf(PropTypes.number).isRequired,
  onSetCalibrationOverride:   PropTypes.func.isRequired,
  onClearCalibrationOverride: PropTypes.func.isRequired,
  tagDisplay:                 PropTypes.string.isRequired,
  onSetTagDisplay:            PropTypes.func.isRequired,
  onExport:                   PropTypes.func.isRequired,
  onImport:                   PropTypes.func.isRequired,
  onClose:                    PropTypes.func.isRequired,
  googleToken:                PropTypes.string,
  googleScope:                PropTypes.string,
  onConnectGmail:             PropTypes.func.isRequired,
  onDisconnectGmail:          PropTypes.func.isRequired,
  gmailError:                 PropTypes.string,
  calendarEnabled:            PropTypes.bool.isRequired,
  onConnectCalendar:          PropTypes.func.isRequired,
  onDisconnectCalendar:       PropTypes.func.isRequired,
  recurringReviewDays:        PropTypes.number.isRequired,
  onSetRecurringReviewDays:   PropTypes.func.isRequired,
};

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

function LocationManager({ locations, tasks, onAdd, onRename, onRemove }) {
  const [newLocText, setNewLocText] = useState("");
  const [editingIdx, setEditingIdx] = useState(null);   // index into locations
  const [editText, setEditText] = useState("");
  const [removingName, setRemovingName] = useState(null);  // location being removed
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

      {/* Location list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {locations.map((loc, idx) => {
          const count = usedByCount(loc);
          const isEditing = editingIdx === idx;
          const isRemoving = removingName === loc;

          return (
            <div key={loc} style={{ background: COLORS.surface2, border: `1px solid ${isRemoving ? "#d45a5a55" : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
              {/* Main row */}
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
                    <button onClick={() => startRemove(loc)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid #d45a5a44`, background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>

              {/* Remove confirmation sub-row */}
              {isRemoving && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface3 }}>
                  {inUse > 0 ? (
                    <>
                      <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 8 }}>
                        <strong style={{ color: "#d45a5a" }}>{inUse} task{inUse !== 1 ? "s" : ""}</strong> use this location. Replace with:
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
                        <button onClick={confirmRemove} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #d45a5a", background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Confirm</button>
                        <button onClick={() => setRemovingName(null)} style={{ padding: "5px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ flex: 1, fontSize: 12, color: COLORS.text2 }}>Remove <strong>{loc}</strong>? No tasks use it.</span>
                      <button onClick={confirmRemove} style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #d45a5a", background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
                      <button onClick={() => setRemovingName(null)} style={{ padding: "4px 9px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new location */}
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

      {/* Effort list */}
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
                    <button onClick={() => handleRemove(eff)} style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid #d45a5a44`, background: "transparent", color: "#d45a5a", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}>✕ Remove</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new effort */}
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

function EffortCalibrationManager({ efforts, tasks, calibrationOverrides, onSetOverride, onClearOverride }) {
  // Compute auto stats from completed tasks
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
        {/* Header row */}
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

          // What the AI will use
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
              {/* Label */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.effort, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: COLORS.text }}>{label}</span>
              </div>

              {/* Auto avg */}
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

              {/* Manual override */}
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

              {/* AI uses */}
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


export { SettingsSection, MODE_LABELS, UsagePanel, SettingsPanel, TagDisplaySetting, LocationManager, EffortManager, EffortCalibrationManager };
