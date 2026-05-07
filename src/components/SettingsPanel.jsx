import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";
import { taskShape } from "../contexts.js";
import { GMAIL_SCOPE_OPTS, GMAIL_SCOPE_DISPLAY } from "../api/gmailTools.js";
import { SettingsSection } from "./SettingsSection.jsx";
import { TagDisplaySetting, LocationManager, EffortManager, EffortCalibrationManager } from "./SettingsManagerComponents.jsx";

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
            Recurring calendar events you've reviewed will resurface during your Weekly Review after this many days.
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

export { SettingsPanel };
