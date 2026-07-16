import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import { COLORS, COACH_MODES } from "../../constants.jsx";
import {
  ActionBtn, ChatBubble, TypingIndicator,
  PendingActionBar, ReviewModeBar, MetadataReviewBar, ProjectReviewBar,
  ProviderSelector,
} from "./AICoach.jsx";
import { CalendarSuggestionsBar } from "../calendar/CalendarSuggestionsBar.jsx";
import { ProjectGroupSuggestionBar } from "../tasks/InboxBars.jsx";
import { ResizeHandle } from "../../shared/ResizeHandle.jsx";
import { ToolbarBtn } from "../../shared/SidebarComponents.jsx";
import { fmtTokens, fmtCost } from "../settings/useAIUsageTracking.js";
import { ExportPopover } from "./ExportPopover.jsx";

function CoachPanel({
  coachHeight,
  coachMode,
  messages,
  loading,
  pendingAction,
  reviewMode,
  reviewReady,
  reviewSuggestions,
  metadataSuggestions,
  calendarSuggestionsReady,
  calendarSuggestions,
  pendingGroupSuggestion,
  reviewProjectIdx,
  totalReviewProjects,
  provider,
  setProvider,
  localModel,
  setLocalModel,
  availableModels,
  fetchModels,
  chatInput,
  setChatInput,
  chatInputHeight,
  chatInputDragDown,
  chatEndRef,
  chatInputRef,
  sessionUsage,
  onSendChat,
  pendingPdf,
  onPdfAttach,
  onPdfClear,
  onConfirmMove,
  onDismissPendingAction,
  onDeleteInboxItem,
  onRecurringStillFine,
  onRecurringNeedsWork,
  onSelectReviewMode,
  onToggleReviewSuggestion,
  onAdvanceProjectReview,
  onSkipProjectReview,
  onToggleMetadataSuggestion,
  onChangeMetadataOverride,
  onAdvanceMetadataReview,
  onSkipMetadataReview,
  onToggleCalendarSuggestion,
  onChangeCalendarSuggestionBucket,
  onAcceptCalendarSuggestions,
  onDismissCalendarSuggestions,
  onAcceptGroupSuggestion,
  onDismissGroupSuggestion,
  tasks,
  onStartProcessInbox,
  onStartWeeklyReview,
  onStartBrainDump,
  onStartProjectReview,
  onStartDailyReview,
  onSwitchToChat,
  onMITSubmit,
  efforts,
  locations,
  categories,
  onUpdatePendingAction,
  docsEnabled,
  driveConversationExportFolderId,
  exportSettings,
  onExportSettingsChange,
  exportTemplates,
  googleToken,
  rawApiThread,
  coachName,
  userName,
}) {
  return (
    <div style={{ height: coachHeight, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Header: label + provider selector + mode tabs */}
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, rowGap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase" }}>🤖 {coachName || 'AI Coach'}</span>
        <ProviderSelector
          provider={provider} setProvider={setProvider}
          localModel={localModel} setLocalModel={setLocalModel}
          availableModels={availableModels} fetchModels={fetchModels}
        />
        {(() => {
          const [modeOpen, setModeOpen] = useState(false);
          const modeRef = useRef(null);
          useEffect(() => {
            if (!modeOpen) return;
            const h = e => { if (modeRef.current && !modeRef.current.contains(e.target)) setModeOpen(false); };
            document.addEventListener('mousedown', h);
            return () => document.removeEventListener('mousedown', h);
          }, [modeOpen]);
          const activeCfg = COACH_MODES[coachMode] || COACH_MODES.chat;
          return (
            <div ref={modeRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: COLORS.text2 }}>Mode:</span>
              <button
                onClick={() => setModeOpen(o => !o)}
                style={{ background: 'transparent', border: `0.5px solid ${COLORS.border2}`, borderRadius: 6, padding: '3px 9px', fontFamily: 'inherit', fontSize: 12, color: '#d4a844', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                {activeCfg.icon} {activeCfg.label} ▾
              </button>
              {modeOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border2}`, borderRadius: 6, padding: 4, zIndex: 60, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
                  {Object.entries(COACH_MODES).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setModeOpen(false);
                        if (key === 'process') onStartProcessInbox();
                        else if (key === 'review') onStartWeeklyReview();
                        else if (key === 'dump') onStartBrainDump();
                        else if (key === 'projectReview') onStartProjectReview();
                        else if (key === 'daily') onStartDailyReview?.();
                        else onSwitchToChat();
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', borderRadius: 4, color: coachMode === key ? '#d4a844' : COLORS.text, fontWeight: coachMode === key ? 600 : 400 }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surface3}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        {messages.length > 1 && exportSettings && (
          <div style={{ marginLeft: 'auto' }}>
            <ExportPopover
              messages={messages}
              coachMode={coachMode}
              tasks={tasks}
              exportSettings={exportSettings}
              onExportSettingsChange={onExportSettingsChange}
              driveConversationExportFolderId={driveConversationExportFolderId}
              googleToken={googleToken}
              docsEnabled={docsEnabled}
              rawApiThread={rawApiThread}
              coachName={coachName}
              userName={userName}
              exportTemplates={exportTemplates}
            />
          </div>
        )}
      </div>



      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} onRecurringStillFine={onRecurringStillFine} onRecurringNeedsWork={onRecurringNeedsWork} onMITSubmit={onMITSubmit} coachName={coachName} userName={userName} />
        ))}
        {loading && <TypingIndicator coachName={coachName} />}
        {pendingAction && (
          <PendingActionBar
            key={`${pendingAction.type}|${pendingAction.title || ""}`}
            action={pendingAction}
            onConfirm={onConfirmMove}
            onDismiss={onDismissPendingAction}
            onDelete={onDeleteInboxItem}
            efforts={efforts}
            locations={locations}
            categories={categories}
            allTasks={tasks}
            onUpdatePendingAction={onUpdatePendingAction}
          />
        )}
        {coachMode === "projectReview" && reviewMode === null && !loading && (
          <ReviewModeBar onSelect={onSelectReviewMode} />
        )}
        {coachMode === "projectReview" && reviewMode === "tasks" && reviewReady && (
          <ProjectReviewBar
            suggestions={reviewSuggestions}
            onToggle={onToggleReviewSuggestion}
            onNext={onAdvanceProjectReview}
            onSkip={onSkipProjectReview}
            projectIdx={reviewProjectIdx}
            totalProjects={totalReviewProjects}
          />
        )}
        {coachMode === "projectReview" && reviewMode === "metadata" && reviewReady && (
          <MetadataReviewBar
            suggestions={metadataSuggestions}
            onToggleAccepted={onToggleMetadataSuggestion}
            onChangeOverride={onChangeMetadataOverride}
            onNext={onAdvanceMetadataReview}
            onSkip={onSkipMetadataReview}
            projectIdx={reviewProjectIdx}
            totalProjects={totalReviewProjects}
          />
        )}
        {calendarSuggestionsReady && (
          <CalendarSuggestionsBar
            suggestions={calendarSuggestions}
            onToggle={onToggleCalendarSuggestion}
            onChangeBucket={onChangeCalendarSuggestionBucket}
            onAccept={onAcceptCalendarSuggestions}
            onDismiss={onDismissCalendarSuggestions}
          />
        )}
        {pendingGroupSuggestion && (
          <ProjectGroupSuggestionBar
            suggestion={pendingGroupSuggestion.suggestion}
            taskCount={pendingGroupSuggestion.taskIds.length}
            allTasks={tasks}
            onAccept={onAcceptGroupSuggestion}
            onDismiss={onDismissGroupSuggestion}
          />
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <ResizeHandle onMouseDown={chatInputDragDown} direction="v" />
      <div style={{ padding: "0 12px 0", flexShrink: 0 }}>
        {/* PDF attachment chip */}
        {pendingPdf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: COLORS.surface3, borderRadius: 8, marginBottom: 4, border: `1px solid ${COLORS.border}` }}>
            <span style={{ fontSize: 14 }}>📄</span>
            <span style={{ fontSize: 12, color: COLORS.text2, flex: 1 }}>{pendingPdf.name}</span>
            <button onClick={onPdfClear} style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 6, paddingBottom: 8, borderTop: pendingPdf ? 'none' : `1px solid ${COLORS.border}`, paddingTop: pendingPdf ? 0 : 8, alignItems: "flex-end" }}>
          {/* Hidden PDF file input */}
          <input
            type="file" accept="application/pdf" style={{ display: 'none' }}
            ref={el => { if (el) el._pdfInput = true; }}
            id="coach-pdf-input"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file || !onPdfAttach) return;
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                onPdfAttach({ name: file.name, data: base64, size: file.size });
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          {/* PDF attach button */}
          {onPdfAttach && (
            <button
              onClick={() => document.getElementById('coach-pdf-input')?.click()}
              title="Attach PDF"
              style={{ width: 34, height: 34, background: pendingPdf ? COLORS.inbox : COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >📎</button>
          )}
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSendChat(); } }}
            placeholder="Ask the coach anything…"
            style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 11px", fontFamily: "inherit", fontSize: 13, color: COLORS.text, outline: "none", resize: "none", height: chatInputHeight, minHeight: 36 }}
          />
          <button
            onClick={onSendChat}
            disabled={loading}
            style={{ width: 34, height: 34, background: loading ? COLORS.surface3 : COLORS.inbox, color: "#111", border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >↑</button>
        </div>
      </div>

      {/* Usage footer */}
      <div style={{ padding: "3px 14px", borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: COLORS.muted, flexShrink: 0, gap: 8 }}>
        <span>Session · ↑ {fmtTokens(sessionUsage.inputTokens)} in · ↓ {fmtTokens(sessionUsage.outputTokens)} out · {sessionUsage.requests} req</span>
        {sessionUsage.costUsd > 0 && <span style={{ color: COLORS.text2 }}>{fmtCost(sessionUsage.costUsd)}</span>}
      </div>
    </div>
  );
}

CoachPanel.propTypes = {
  coachHeight:            PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  coachMode:              PropTypes.string.isRequired,
  messages:               PropTypes.array.isRequired,
  loading:                PropTypes.bool.isRequired,
  pendingAction:          PropTypes.object,
  reviewMode:             PropTypes.string,
  reviewReady:            PropTypes.bool.isRequired,
  reviewSuggestions:      PropTypes.array.isRequired,
  metadataSuggestions:    PropTypes.array.isRequired,
  calendarSuggestionsReady: PropTypes.bool.isRequired,
  calendarSuggestions:    PropTypes.array.isRequired,
  pendingGroupSuggestion: PropTypes.object,
  reviewProjectIdx:       PropTypes.number.isRequired,
  totalReviewProjects:    PropTypes.number.isRequired,
  provider:               PropTypes.string.isRequired,
  setProvider:            PropTypes.func.isRequired,
  localModel:             PropTypes.string.isRequired,
  setLocalModel:          PropTypes.func.isRequired,
  availableModels:        PropTypes.array.isRequired,
  fetchModels:            PropTypes.func.isRequired,
  chatInput:              PropTypes.string.isRequired,
  setChatInput:           PropTypes.func.isRequired,
  chatInputHeight:        PropTypes.number.isRequired,
  chatInputDragDown:      PropTypes.func.isRequired,
  chatEndRef:             PropTypes.object.isRequired,
  chatInputRef:           PropTypes.object.isRequired,
  sessionUsage:           PropTypes.object.isRequired,
  onSendChat:             PropTypes.func.isRequired,
  pendingPdf:             PropTypes.object,
  onPdfAttach:            PropTypes.func,
  onPdfClear:             PropTypes.func,
  onConfirmMove:          PropTypes.func.isRequired,
  onDismissPendingAction: PropTypes.func.isRequired,
  onDeleteInboxItem:      PropTypes.func.isRequired,
  onRecurringStillFine:   PropTypes.func.isRequired,
  onRecurringNeedsWork:   PropTypes.func.isRequired,
  onSelectReviewMode:     PropTypes.func.isRequired,
  onToggleReviewSuggestion: PropTypes.func.isRequired,
  onAdvanceProjectReview: PropTypes.func.isRequired,
  onSkipProjectReview:    PropTypes.func.isRequired,
  onToggleMetadataSuggestion: PropTypes.func.isRequired,
  onChangeMetadataOverride: PropTypes.func.isRequired,
  onAdvanceMetadataReview: PropTypes.func.isRequired,
  onSkipMetadataReview:   PropTypes.func.isRequired,
  onToggleCalendarSuggestion: PropTypes.func.isRequired,
  onChangeCalendarSuggestionBucket: PropTypes.func.isRequired,
  onAcceptCalendarSuggestions: PropTypes.func.isRequired,
  onDismissCalendarSuggestions: PropTypes.func.isRequired,
  onAcceptGroupSuggestion: PropTypes.func.isRequired,
  onDismissGroupSuggestion: PropTypes.func.isRequired,
  tasks:                  PropTypes.array.isRequired,
  onStartProcessInbox:    PropTypes.func.isRequired,
  onStartWeeklyReview:    PropTypes.func.isRequired,
  onStartBrainDump:       PropTypes.func.isRequired,
  onStartProjectReview:   PropTypes.func.isRequired,
  onStartDailyReview:     PropTypes.func,
  onSwitchToChat:         PropTypes.func.isRequired,
  efforts:                PropTypes.array,
  locations:              PropTypes.array,
  categories:             PropTypes.array,
  onUpdatePendingAction:  PropTypes.func,
  docsEnabled:            PropTypes.bool,
  driveConversationExportFolderId: PropTypes.string,
  exportSettings:         PropTypes.object,
  onExportSettingsChange: PropTypes.func,
  exportTemplates:        PropTypes.object,
  googleToken:            PropTypes.string,
  rawApiThread:           PropTypes.array,
  coachName:              PropTypes.string,
  userName:               PropTypes.string,
};

export { CoachPanel };
