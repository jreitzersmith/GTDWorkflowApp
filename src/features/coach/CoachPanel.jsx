import PropTypes from "prop-types";
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
  onSwitchToChat,
  onMITSubmit,
}) {
  return (
    <div style={{ height: coachHeight, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Header: label + provider selector + mode tabs */}
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: "0.06em", textTransform: "uppercase" }}>🤖 AI Coach</span>
        <ProviderSelector
          provider={provider} setProvider={setProvider}
          localModel={localModel} setLocalModel={setLocalModel}
          availableModels={availableModels} fetchModels={fetchModels}
        />
        <div style={{ display: "flex", gap: 4 }}>
          {Object.entries(COACH_MODES).map(([key, cfg]) => (
            <ToolbarBtn
              key={key}
              active={coachMode === key}
              onClick={() => {
                if (key === "process") onStartProcessInbox();
                else if (key === "review") onStartWeeklyReview();
                else if (key === "dump") onStartBrainDump();
                else if (key === "projectReview") onStartProjectReview();
                else onSwitchToChat();
              }}
            >
              {cfg.label}
            </ToolbarBtn>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} onRecurringStillFine={onRecurringStillFine} onRecurringNeedsWork={onRecurringNeedsWork} onMITSubmit={onMITSubmit} />
        ))}
        {loading && <TypingIndicator />}
        {pendingAction && (
          <PendingActionBar
            action={pendingAction}
            onConfirm={onConfirmMove}
            onDismiss={onDismissPendingAction}
            onDelete={onDeleteInboxItem}
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
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderTop: `1px solid ${COLORS.border}`, flexShrink: 0, alignItems: "flex-end" }}>
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

      {/* Usage footer */}
      <div style={{ padding: "3px 14px", borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: COLORS.muted, flexShrink: 0, gap: 8 }}>
        <span>Session · ↑ {fmtTokens(sessionUsage.inputTokens)} in · ↓ {fmtTokens(sessionUsage.outputTokens)} out · {sessionUsage.requests} req</span>
        {sessionUsage.costUsd > 0 && <span style={{ color: COLORS.text2 }}>{fmtCost(sessionUsage.costUsd)}</span>}
      </div>
    </div>
  );
}

CoachPanel.propTypes = {
  coachHeight:            PropTypes.number.isRequired,
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
  onSwitchToChat:         PropTypes.func.isRequired,
};

export { CoachPanel };
