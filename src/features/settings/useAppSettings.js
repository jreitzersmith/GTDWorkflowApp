import { useState, useEffect } from "react";
import { DEFAULT_EXPORT_TEMPLATES } from "../../constants.jsx";

const DEFAULT_EFFORTS = ["2 min", "5 min", "10 min", "30 min", "1 hour", "2 hours", "6 hours", "1 day", "3 days", "1 week", "1 month"];

// ── useAppSettings ────────────────────────────────────────────────────────────
// Manages user-configurable settings (locations, efforts, calibration, tag display)
// and keeps them synced to localStorage.
function useAppSettings() {
  const [locations, setLocations] = useState(() => {
    try { return (JSON.parse(localStorage.getItem("gtd_locations") || "null") || ["Computer", "Home", "Phone", "Work"]); } catch { return ["Computer", "Home", "Phone", "Work"]; }
  });
  const [efforts, setEfforts] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_efforts") || "null") || DEFAULT_EFFORTS; } catch { return DEFAULT_EFFORTS; }
  });
  // calibrationOverrides: { [effortLabel]: overrideLabel | null }
  // Stores manual overrides set in Settings; auto-computed values are derived from tasks at runtime.
  const [calibrationOverrides, setCalibrationOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_effort_calibration") || "null") || {}; } catch { return {}; }
  });
  const [tagDisplay, setTagDisplay] = useState(() => localStorage.getItem("gtd_tag_display") || "below");
  const [categories, setCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gtd_categories") || "null") || []; } catch { return []; }
  });
  // FR#37: calendar reminder interval (minutes, device-local preference)
  const [calendarReminderMinutes, setCalendarReminderMinutes] = useState(() => {
    const v = parseInt(localStorage.getItem("gtd_calendar_reminder_minutes"), 10);
    return isNaN(v) ? 10 : v;
  });

  useEffect(() => { localStorage.setItem("gtd_locations",          JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem("gtd_efforts",            JSON.stringify(efforts)); }, [efforts]);
  useEffect(() => { localStorage.setItem("gtd_effort_calibration", JSON.stringify(calibrationOverrides)); }, [calibrationOverrides]);
  useEffect(() => { localStorage.setItem("gtd_tag_display", tagDisplay); }, [tagDisplay]);
  useEffect(() => { localStorage.setItem("gtd_categories",         JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem("gtd_calendar_reminder_minutes", String(calendarReminderMinutes)); }, [calendarReminderMinutes]);

  // Next Actions view mode: 'simple' (all bucket:next tasks) | 'gtd-strict' (one per project — stub, not yet implemented)
  const [nextActionsViewMode, setNextActionsViewMode] = useState(() =>
    localStorage.getItem('gtd_next_actions_mode') || 'simple'
  );
  useEffect(() => { localStorage.setItem('gtd_next_actions_mode', nextActionsViewMode); }, [nextActionsViewMode]);

  // focusExpandedDefaults: which Today\'s Focus tiers are expanded by default
  const [focusExpandedDefaults, setFocusExpandedDefaults] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_focus_expanded') || 'null') || { dueToday: true, overdue: true, dueThisWeek: false, noCalEvent: false }; }
    catch { return { dueToday: true, overdue: true, dueThisWeek: false, noCalEvent: false }; }
  });
  useEffect(() => { localStorage.setItem('gtd_focus_expanded', JSON.stringify(focusExpandedDefaults)); }, [focusExpandedDefaults]);

  // reviewNodeTypes: which nodeTypes appear in the Project Review queue
  const [reviewNodeTypes, setReviewNodeTypes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_review_node_types') || 'null') || ['project', 'subproject']; } catch { return ['project', 'subproject']; }
  });
  useEffect(() => { localStorage.setItem('gtd_review_node_types', JSON.stringify(reviewNodeTypes)); }, [reviewNodeTypes]);

  const [shortcutModifier, setShortcutModifier] = useState(() =>
    localStorage.getItem('gtd_shortcut_modifier') || 'ctrl+alt'
  );
  useEffect(() => { localStorage.setItem('gtd_shortcut_modifier', shortcutModifier); }, [shortcutModifier]);

  // FR#96: per-action Drive folder destinations (fallback chain: specific → base → Drive root)
  const [driveBaseFolderId, setDriveBaseFolderId] = useState(() => localStorage.getItem('gtd_drive_base_folder_id') || '');
  const [driveConversationExportFolderId, setDriveConversationExportFolderId] = useState(() =>
    localStorage.getItem('gtd_drive_conversation_export_folder_id') ||
    localStorage.getItem('gtd_review_drive_folder_id') || ''
  );
  const [driveSlideDeckFolderId, setDriveSlideDeckFolderId] = useState(() => localStorage.getItem('gtd_drive_slide_deck_folder_id') || '');
  const [driveSpreadsheetFolderId, setDriveSpreadsheetFolderId] = useState(() => localStorage.getItem('gtd_drive_spreadsheet_folder_id') || '');
  const [driveDocumentFolderId, setDriveDocumentFolderId] = useState(() => localStorage.getItem('gtd_drive_document_folder_id') || '');
  useEffect(() => { localStorage.setItem('gtd_drive_base_folder_id', driveBaseFolderId); }, [driveBaseFolderId]);
  useEffect(() => { localStorage.setItem('gtd_drive_conversation_export_folder_id', driveConversationExportFolderId); }, [driveConversationExportFolderId]);
  useEffect(() => { localStorage.setItem('gtd_drive_slide_deck_folder_id', driveSlideDeckFolderId); }, [driveSlideDeckFolderId]);
  useEffect(() => { localStorage.setItem('gtd_drive_spreadsheet_folder_id', driveSpreadsheetFolderId); }, [driveSpreadsheetFolderId]);
  useEffect(() => { localStorage.setItem('gtd_drive_document_folder_id', driveDocumentFolderId); }, [driveDocumentFolderId]);

  // Display paths for Drive folders (human-readable labels stored alongside IDs)
  const [driveBaseFolderPath, setDriveBaseFolderPath] = useState(() => localStorage.getItem('gtd_drive_base_folder_path') || '');
  const [driveConversationExportFolderPath, setDriveConversationExportFolderPath] = useState(() => localStorage.getItem('gtd_drive_conversation_export_folder_path') || '');
  const [driveSlideDeckFolderPath, setDriveSlideDeckFolderPath] = useState(() => localStorage.getItem('gtd_drive_slide_deck_folder_path') || '');
  const [driveSpreadsheetFolderPath, setDriveSpreadsheetFolderPath] = useState(() => localStorage.getItem('gtd_drive_spreadsheet_folder_path') || '');
  const [driveDocumentFolderPath, setDriveDocumentFolderPath] = useState(() => localStorage.getItem('gtd_drive_document_folder_path') || '');
  // App data backup folder
  const [driveBackupFolderId, setDriveBackupFolderId] = useState(() => localStorage.getItem('gtd_drive_backup_folder_id') || '');
  const [driveBackupFolderPath, setDriveBackupFolderPath] = useState(() => localStorage.getItem('gtd_drive_backup_folder_path') || '');
  useEffect(() => { localStorage.setItem('gtd_drive_base_folder_path', driveBaseFolderPath); }, [driveBaseFolderPath]);
  useEffect(() => { localStorage.setItem('gtd_drive_conversation_export_folder_path', driveConversationExportFolderPath); }, [driveConversationExportFolderPath]);
  useEffect(() => { localStorage.setItem('gtd_drive_slide_deck_folder_path', driveSlideDeckFolderPath); }, [driveSlideDeckFolderPath]);
  useEffect(() => { localStorage.setItem('gtd_drive_spreadsheet_folder_path', driveSpreadsheetFolderPath); }, [driveSpreadsheetFolderPath]);
  useEffect(() => { localStorage.setItem('gtd_drive_document_folder_path', driveDocumentFolderPath); }, [driveDocumentFolderPath]);
  useEffect(() => { localStorage.setItem('gtd_drive_backup_folder_id', driveBackupFolderId); }, [driveBackupFolderId]);
  useEffect(() => { localStorage.setItem('gtd_drive_backup_folder_path', driveBackupFolderPath); }, [driveBackupFolderPath]);

  const [exportSettings, setExportSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gtd_export_settings') || 'null') || {
        format: 'rtf',
        include: { userMessages: true, aiResponses: true, toolChips: true, metadata: true, apiThread: false },
      };
    } catch { return { format: 'docs', include: { userMessages: true, aiResponses: true, toolChips: true, metadata: true, apiThread: false } }; }
  });
  useEffect(() => { localStorage.setItem('gtd_export_settings', JSON.stringify(exportSettings)); }, [exportSettings]);

  // FR#104: user location settings — threaded into AI system prompts
  const [userCity, setUserCity] = useState(() => localStorage.getItem('gtd_user_city') || '');
  const [userHomeAddress, setUserHomeAddress] = useState(() => localStorage.getItem('gtd_user_home_address') || '');
  const [userWorkAddress, setUserWorkAddress] = useState(() => localStorage.getItem('gtd_user_work_address') || '');
  useEffect(() => { localStorage.setItem('gtd_user_city', userCity); }, [userCity]);
  useEffect(() => { localStorage.setItem('gtd_user_home_address', userHomeAddress); }, [userHomeAddress]);
  useEffect(() => { localStorage.setItem('gtd_user_work_address', userWorkAddress); }, [userWorkAddress]);

  // FR#98: configurable AI coach name and user display name
  const [coachName, setCoachName] = useState(() => localStorage.getItem('gtd_coach_name') || '');
  const [userName, setUserName] = useState(() => localStorage.getItem('gtd_user_name') || '');
  useEffect(() => { localStorage.setItem('gtd_coach_name', coachName); }, [coachName]);
  useEffect(() => { localStorage.setItem('gtd_user_name', userName); }, [userName]);

  // FR#119: user-editable export templates — persisted to localStorage (and Supabase via useSupabaseSync)
  const [exportTemplates, setExportTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_export_templates') || 'null') || DEFAULT_EXPORT_TEMPLATES; }
    catch { return DEFAULT_EXPORT_TEMPLATES; }
  });
  useEffect(() => { localStorage.setItem('gtd_export_templates', JSON.stringify(exportTemplates)); }, [exportTemplates]);

  // FR#46: receipt-to-sheets pipeline — target spreadsheet ID
  const [receiptSheetId, setReceiptSheetId] = useState(() => localStorage.getItem('gtd_receipt_sheet_id') || '');
  useEffect(() => { localStorage.setItem('gtd_receipt_sheet_id', receiptSheetId); }, [receiptSheetId]);

  const [contactRelationshipTags, setContactRelationshipTags] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_contact_relationship_tags') || 'null') || []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('gtd_contact_relationship_tags', JSON.stringify(contactRelationshipTags)); }, [contactRelationshipTags]);

  const [contactLikesCategories, setContactLikesCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_contact_likes_categories') || 'null') || []; } catch { return []; }
  });
  useEffect(() => { localStorage.setItem('gtd_contact_likes_categories', JSON.stringify(contactLikesCategories)); }, [contactLikesCategories]);

  // FR#163: contact email auto-linking mode
  const [contactEmailLinkingMode, setContactEmailLinkingMode] = useState(() =>
    localStorage.getItem('gtd_contact_email_linking') || 'both'
  );
  useEffect(() => { localStorage.setItem('gtd_contact_email_linking', contactEmailLinkingMode); }, [contactEmailLinkingMode]);

  return {
    locations, setLocations, efforts, setEfforts, calibrationOverrides, setCalibrationOverrides,
    tagDisplay, setTagDisplay, categories, setCategories,
    calendarReminderMinutes, setCalendarReminderMinutes,
    nextActionsViewMode, setNextActionsViewMode,
    reviewNodeTypes, setReviewNodeTypes,
    focusExpandedDefaults, setFocusExpandedDefaults,
    shortcutModifier, setShortcutModifier,
    driveBaseFolderId, setDriveBaseFolderId,
    driveConversationExportFolderId, setDriveConversationExportFolderId,
    driveSlideDeckFolderId, setDriveSlideDeckFolderId,
    driveSpreadsheetFolderId, setDriveSpreadsheetFolderId,
    driveDocumentFolderId, setDriveDocumentFolderId,
    driveBaseFolderPath, setDriveBaseFolderPath,
    driveConversationExportFolderPath, setDriveConversationExportFolderPath,
    driveSlideDeckFolderPath, setDriveSlideDeckFolderPath,
    driveSpreadsheetFolderPath, setDriveSpreadsheetFolderPath,
    driveDocumentFolderPath, setDriveDocumentFolderPath,
    driveBackupFolderId, setDriveBackupFolderId,
    driveBackupFolderPath, setDriveBackupFolderPath,
    exportSettings, setExportSettings,
    userCity, setUserCity,
    userHomeAddress, setUserHomeAddress,
    userWorkAddress, setUserWorkAddress,
    coachName, setCoachName,
    userName, setUserName,
    exportTemplates, setExportTemplates,
    receiptSheetId, setReceiptSheetId,
    contactRelationshipTags, setContactRelationshipTags,
    contactLikesCategories, setContactLikesCategories,
    contactEmailLinkingMode, setContactEmailLinkingMode,
  };
}


export { useAppSettings, DEFAULT_EFFORTS };
