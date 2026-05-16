import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { taskShape } from "../../contexts.js";
import { SettingsSection } from "./SettingsSection.jsx";
import { TagDisplaySetting, LocationManager, CategoryManager, EffortManager, EffortCalibrationManager, ReviewConfigManager } from "./SettingsManagerComponents.jsx";

// ── Google Services section config ────────────────────────────────────────────
const GOOGLE_SERVICES = [
  {
    id: 'gmail', icon: '✉', name: 'Gmail',
    scopes: [
      { key: 'readonly', label: 'Read only',  desc: 'Search and read emails' },
      { key: 'modify',   label: 'Organize',   desc: '+ label, archive, filter' },
      { key: 'compose',  label: 'Compose',    desc: '+ draft replies' },
      { key: 'send',     label: 'Send',       desc: '+ send messages' },
    ],
  },
  { id: 'calendar', icon: '📅', name: 'Calendar', isToggle: true },
  {
    id: 'drive', icon: '💾', name: 'Drive',
    scopes: [
      { key: 'standard', label: 'Standard', desc: 'Browse, attach & upload files' },
      { key: 'full',     label: 'Full',     desc: '+ manage all Drive content' },
    ],
  },
  {
    id: 'docs', icon: '📄', name: 'Docs',
    scopes: [
      { key: 'readonly', label: 'Read only', desc: 'Read docs for AI context' },
      { key: 'full',     label: 'Full',      desc: '+ create & edit docs' },
    ],
  },
  {
    id: 'sheets', icon: '📊', name: 'Sheets',
    scopes: [
      { key: 'readonly', label: 'Read only', desc: 'Read spreadsheets' },
      { key: 'full',     label: 'Full',      desc: '+ create & edit sheets' },
    ],
  },
  {
    id: 'slides', icon: '📽', name: 'Slides',
    scopes: [
      { key: 'readonly', label: 'Read only', desc: 'Read presentations' },
      { key: 'full',     label: 'Full',      desc: '+ create & edit slides' },
    ],
  },
];

// Map service id → enabled prop
function getEnabled(id, { googleToken, calendarEnabled, driveEnabled, docsEnabled, sheetsEnabled, slidesEnabled }) {
  if (id === 'gmail')    return !!googleToken;
  if (id === 'calendar') return calendarEnabled;
  if (id === 'drive')    return driveEnabled;
  if (id === 'docs')     return docsEnabled;
  if (id === 'sheets')   return sheetsEnabled;
  if (id === 'slides')   return slidesEnabled;
  return false;
}

// ── Inline style helpers ──────────────────────────────────────────────────────
const scopeBtnStyle = (active) => ({
  padding: '3px 8px',
  borderRadius: 5,
  border: `1px solid ${active ? COLORS.accent : COLORS.border2}`,
  background: active ? COLORS.surface3 : 'transparent',
  color: active ? COLORS.text : COLORS.text2,
  fontFamily: 'inherit',
  fontSize: 10,
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
  lineHeight: 1.4,
});

function SettingsPanel({
  locations, tasks, onAdd, onRename, onRemove,
  categories, onAddCategory, onRenameCategory, onRemoveCategory,
  efforts, onAddEffort, onRenameEffort, onRemoveEffort,
  calibrationOverrides, onSetCalibrationOverride, onClearCalibrationOverride,
  tagDisplay, onSetTagDisplay,
  focusExpandedDefaults, onSetFocusExpandedDefaults,
  shortcutModifier, onSetShortcutModifier,
  nextActionsViewMode, onSetNextActionsViewMode,
  reviewNodeTypes, onSetReviewNodeTypes,
  onExport, onImport, onClose,
  // Google props
  googleToken, gmailScope, gmailError,
  calendarEnabled, driveEnabled, docsEnabled, sheetsEnabled, slidesEnabled,
  scopePrefs, onSetScopePref,
  onReauthorizeGoogle, onDisconnectCalendar, onDisconnectAll,
  // Other
  recurringReviewDays, onSetRecurringReviewDays,
  reviewDriveFolderId, onSetReviewDriveFolderId,
  calendarReminderMinutes, onSetCalendarReminderMinutes,
}) {
  const fileInputRef = useRef(null);
  const [importMode, setImportMode] = useState("replace");

  // Tracks whether any scope pref has changed since the last re-auth.
  // Reset to false on mount (fresh after OAuth redirect) and on Re-authorize click.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  const handleScopePref = (service, level) => {
    onSetScopePref(service, level);
    setHasUnsavedChanges(true);
  };

  const handleCalendarToggle = () => {
    if (calendarEnabled) {
      // Disconnect immediately; also mark calendar pref as off
      onDisconnectCalendar();
      onSetScopePref('calendar', false);
    } else {
      // Not yet authorized — mark desired and prompt re-auth
      onSetScopePref('calendar', true);
      setHasUnsavedChanges(true);
    }
  };

  const handleReauthorize = () => {
    setHasUnsavedChanges(false);
    onReauthorizeGoogle();
  };

  const anyConnected = !!googleToken;
  const TOGGLE_ON  = { width: 28, height: 16, borderRadius: 8, background: COLORS.next, position: 'relative', cursor: 'pointer', flexShrink: 0, border: 'none' };
  const TOGGLE_OFF = { ...TOGGLE_ON, background: COLORS.border2 };
  const THUMB      = (on) => ({ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, ...(on ? { right: 2 } : { left: 2 }) });

  const enabledFlags = { googleToken, calendarEnabled, driveEnabled, docsEnabled, sheetsEnabled, slidesEnabled };

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

        {/* ── Google Services ─────────────────────────────────────────────── */}
        <SettingsSection label="Google Services" storageKey="gtd_settings_google_services">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 1.5 }}>
            Connect Google services for email, calendar, documents, and files. Choose the access level
            for each service, then click <strong style={{ color: COLORS.text2 }}>
            {anyConnected ? 'Re-authorize Google' : 'Authorize Google'}</strong> to apply.
          </div>

          {/* Change notice */}
          {hasUnsavedChanges && (
            <div style={{ fontSize: 11, color: COLORS.inbox, background: COLORS.inboxBg, border: `1px solid #3e3418`, borderRadius: 6, padding: '7px 10px', marginBottom: 12, lineHeight: 1.4 }}>
              ⚠ Scope changes are pending — click <strong>
              {anyConnected ? 'Re-authorize Google' : 'Authorize Google'}</strong> below to apply them.
            </div>
          )}

          {/* Service rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {GOOGLE_SERVICES.map(svc => {
              const isConnected = getEnabled(svc.id, enabledFlags);
              return (
                <div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
                  {/* Icon + name */}
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{svc.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, width: 56, flexShrink: 0 }}>{svc.name}</span>

                  {/* Scope controls */}
                  {svc.isToggle ? (
                    /* Calendar: toggle only */
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={handleCalendarToggle}
                        style={isConnected ? TOGGLE_ON : TOGGLE_OFF}
                        title={isConnected ? 'Disconnect Calendar' : 'Enable Calendar (requires Re-authorize)'}
                      >
                        <div style={THUMB(isConnected)} />
                      </button>
                      <span style={{ fontSize: 11, color: COLORS.text2 }}>
                        {isConnected
                          ? 'Full access'
                          : scopePrefs.calendar && !isConnected
                            ? <span style={{ color: COLORS.inbox }}>Pending re-authorize</span>
                            : <span style={{ color: COLORS.muted }}>Off</span>
                        }
                      </span>
                      {isConnected && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                          <span style={{ fontSize: 11, color: COLORS.muted }}>Reminder:</span>
                          <select
                            value={calendarReminderMinutes}
                            onChange={e => onSetCalendarReminderMinutes(Number(e.target.value))}
                            style={{ fontSize: 11, background: COLORS.surface2, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: '2px 4px', fontFamily: 'inherit' }}
                          >
                            {[0, 5, 10, 15, 30, 60].map(m => (
                              <option key={m} value={m}>{m === 0 ? 'None' : `${m} min`}</option>
                            ))}
                          </select>
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Other services: segmented scope selector */
                    <div style={{ flex: 1, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {svc.scopes.map(sc => {
                        const active = (scopePrefs[svc.id] || svc.scopes[0].key) === sc.key;
                        return (
                          <button
                            key={sc.key}
                            onClick={() => handleScopePref(svc.id, sc.key)}
                            title={sc.desc}
                            style={scopeBtnStyle(active)}
                          >
                            {sc.label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Status badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 'auto', paddingLeft: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? COLORS.next : COLORS.muted, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: isConnected ? COLORS.next : COLORS.muted }}>
                      {isConnected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gmail active scope display */}
          {gmailScope && googleToken && (
            <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 10 }}>
              Gmail authorized at: <span style={{ color: COLORS.text2 }}>{gmailScope}</span>
            </div>
          )}

          {/* Error */}
          {gmailError && (
            <div style={{ fontSize: 11, color: COLORS.waiting, lineHeight: 1.4, marginBottom: 10 }}>⚠ {gmailError}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleReauthorize}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: `1px solid ${COLORS.accent}`, background: COLORS.accent, color: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <span style={{ fontSize: 13 }}>G</span>
              {anyConnected ? 'Re-authorize Google' : 'Authorize Google'}
            </button>
            {anyConnected && (
              <button
                onClick={onDisconnectAll}
                style={{ padding: '8px 14px', borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
              >
                Disconnect All
              </button>
            )}
          </div>
          <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 8, lineHeight: 1.4 }}>
            Re-authorizing opens a single Google sign-in that grants all selected scopes at once.
            Your tasks and settings are not affected.
          </div>
        </SettingsSection>

        {/* ── Weekly Review ────────────────────────────────────────────────── */}
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
          {docsEnabled && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 6 }}>Save review transcripts to Drive</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6, lineHeight: 1.4 }}>
                Paste a Google Drive folder ID to save Weekly Review transcripts there. Leave blank to save to My Drive root.
              </div>
              <input
                value={reviewDriveFolderId || ''}
                onChange={e => onSetReviewDriveFolderId(e.target.value.trim())}
                placeholder="Drive folder ID (optional)"
                style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text, fontFamily: 'inherit', fontSize: 12, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          )}
        </SettingsSection>

        {/* ── Next Actions ──────────────────────────────────────────────────── */}
        <SettingsSection label="Next Actions" storageKey="gtd_settings_next_actions">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
            How tasks are shown in the Next Actions view.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { value: 'simple',     label: 'Simple',     desc: 'All next actions',          disabled: false },
              { value: 'gtd-strict', label: 'GTD Strict', desc: 'One per project (coming soon)', disabled: true  },
            ].map(({ value, label, desc, disabled }) => {
              const active = nextActionsViewMode === value;
              return (
                <button
                  key={value}
                  onClick={() => { if (!disabled) onSetNextActionsViewMode(value); }}
                  disabled={disabled}
                  title={desc}
                  style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${active ? COLORS.next : COLORS.border}`, background: active ? COLORS.next + '22' : 'transparent', color: disabled ? COLORS.muted : active ? COLORS.next : COLORS.text2, fontFamily: 'inherit', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
                >{label}</button>
              );
            })}
          </div>
        </SettingsSection>

        <SettingsSection label="Review Configuration" storageKey="gtd_settings_review_config">
          <div style={{ fontSize: 12, color: COLORS.text2, fontWeight: 600, marginBottom: 8 }}>Project Review</div>
          <ReviewConfigManager reviewNodeTypes={reviewNodeTypes} onSetReviewNodeTypes={onSetReviewNodeTypes} />
        </SettingsSection>

        <SettingsSection label="Keyboard Shortcuts" storageKey="gtd_settings_keyboard">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Choose the modifier key combination used for global view and mode shortcuts.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { value: 'ctrl+alt',   label: 'Ctrl + Alt + key',   hint: 'Recommended — fewest browser conflicts. Note: equals AltGr on European keyboards.' },
              { value: 'alt+shift',  label: 'Alt + Shift + key',  hint: 'Some combos conflict with Chrome accessibility shortcuts (Alt+Shift+I etc.).' },
              { value: 'ctrl+shift', label: 'Ctrl + Shift + key', hint: 'Some combos conflict with browser DevTools (Ctrl+Shift+I/J/C).' },
            ].map(({ value, label, hint }) => (
              <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="shortcutModifier"
                  value={value}
                  checked={shortcutModifier === value}
                  onChange={() => onSetShortcutModifier(value)}
                  style={{ accentColor: COLORS.next, marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>{hint}</div>
                </div>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection label="Today's Focus" storageKey="gtd_settings_todays_focus">
          <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10, lineHeight: 1.5 }}>
            Choose which sections are expanded by default when you open Today's Focus.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'dueToday',    label: '📅 Due Today' },
              { key: 'overdue',     label: '⚠ Overdue' },
              { key: 'dueThisWeek', label: '📆 Due This Week (>1 hr)' },
              { key: 'noCalEvent',  label: '📆 Due · No Calendar Event' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!(focusExpandedDefaults || {})[key]}
                  onChange={e => onSetFocusExpandedDefaults(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ accentColor: COLORS.next, width: 14, height: 14 }}
                />
                {label}
                <span style={{ fontSize: 10, color: COLORS.muted }}>(expanded by default)</span>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection label="Tag Display" storageKey="gtd_settings_tag_display">
          <TagDisplaySetting value={tagDisplay} onChange={onSetTagDisplay} />
        </SettingsSection>
        <SettingsSection label="Categories" storageKey="gtd_settings_categories">
          <CategoryManager categories={categories} tasks={tasks} onAdd={onAddCategory} onRename={onRenameCategory} onRemove={onRemoveCategory} />
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
            <button onClick={onExport} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>⬇ Export</button>
            <button onClick={() => { setImportMode("replace"); fileInputRef.current?.click(); }} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>⬆ Import (Replace)</button>
            <button onClick={() => { setImportMode("merge"); fileInputRef.current?.click(); }} style={{ padding: "7px 14px", borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: COLORS.surface3, color: COLORS.text2, fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>⬆ Import (Merge)</button>
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
  categories:                 PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddCategory:              PropTypes.func.isRequired,
  onRenameCategory:           PropTypes.func.isRequired,
  onRemoveCategory:           PropTypes.func.isRequired,
  efforts:                    PropTypes.arrayOf(PropTypes.string).isRequired,
  onAddEffort:                PropTypes.func.isRequired,
  onRenameEffort:             PropTypes.func.isRequired,
  onRemoveEffort:             PropTypes.func.isRequired,
  calibrationOverrides:       PropTypes.objectOf(PropTypes.number).isRequired,
  onSetCalibrationOverride:   PropTypes.func.isRequired,
  onClearCalibrationOverride: PropTypes.func.isRequired,
  tagDisplay:                 PropTypes.string.isRequired,
  onSetTagDisplay:            PropTypes.func.isRequired,
  focusExpandedDefaults:      PropTypes.object.isRequired,
  onSetFocusExpandedDefaults: PropTypes.func.isRequired,
  shortcutModifier:           PropTypes.string.isRequired,
  onSetShortcutModifier:      PropTypes.func.isRequired,
  nextActionsViewMode:        PropTypes.string.isRequired,
  onSetNextActionsViewMode:   PropTypes.func.isRequired,
  onExport:                   PropTypes.func.isRequired,
  onImport:                   PropTypes.func.isRequired,
  onClose:                    PropTypes.func.isRequired,
  // Google
  googleToken:                PropTypes.string,
  gmailScope:                 PropTypes.string,
  gmailError:                 PropTypes.string,
  calendarEnabled:            PropTypes.bool.isRequired,
  driveEnabled:               PropTypes.bool.isRequired,
  docsEnabled:                PropTypes.bool.isRequired,
  sheetsEnabled:              PropTypes.bool.isRequired,
  slidesEnabled:              PropTypes.bool.isRequired,
  scopePrefs:                 PropTypes.object.isRequired,
  onSetScopePref:             PropTypes.func.isRequired,
  onReauthorizeGoogle:        PropTypes.func.isRequired,
  onDisconnectCalendar:       PropTypes.func.isRequired,
  onDisconnectAll:            PropTypes.func.isRequired,
  // Other
  recurringReviewDays:        PropTypes.number.isRequired,
  onSetRecurringReviewDays:   PropTypes.func.isRequired,
  calendarReminderMinutes:    PropTypes.number.isRequired,
  onSetCalendarReminderMinutes: PropTypes.func.isRequired,
  reviewNodeTypes:            PropTypes.arrayOf(PropTypes.string).isRequired,
  onSetReviewNodeTypes:       PropTypes.func.isRequired,
  reviewDriveFolderId:        PropTypes.string,
  onSetReviewDriveFolderId:   PropTypes.func.isRequired,
};

export { SettingsPanel };
