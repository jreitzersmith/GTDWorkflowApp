import PropTypes from "prop-types";
import { COLORS, BUCKETS } from "../constants.jsx";
import { BucketItem, SidebarBtn } from "./SidebarComponents.jsx";

function AppSidebar({
  sidebarWidth,
  supabaseReady,
  syncStatus,
  counts,
  currentBucket,
  currentView,
  gmailUnreadCount,
  calendarEnabled,
  onSelectBucket,
  onSelectFocus,
  focusCount,
  onSelectEmail,
  onSelectCalendar,
  onToggleSettings,
  onToggleUsage,
  onDailyReview,
  dailyReviewPhase,
  onWeeklyReview,
  onBrainDump,
  onOpenSearch,
}) {
  return (
    <div style={{ width: sidebarWidth, background: COLORS.surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 300, color: COLORS.text }}>
            GTD <em style={{ fontStyle: "italic", color: COLORS.inbox }}>Manager</em>
          </div>
          {supabaseReady && (
            <div title={syncStatus === "synced" ? "Synced to cloud" : "Offline — changes queued"}
                 style={{ display: "flex", alignItems: "center", gap: 4, cursor: "default" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                             background: syncStatus === "synced" ? COLORS.next : COLORS.waiting }} />
              <span style={{ fontSize: 10, color: syncStatus === "synced" ? COLORS.next : COLORS.waiting }}>
                {syncStatus === "synced" ? "synced" : "offline"}
              </span>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}>Knowledge Worker Edition</div>
      </div>

      <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
        {Object.entries(BUCKETS).map(([key, cfg]) => (
          <BucketItem
            key={key}
            bkey={key}
            cfg={cfg}
            count={counts[key]}
            active={currentBucket === key && currentView === "gtd"}
            onClick={onSelectBucket(key)}
          />
        ))}

        <div style={{ margin: "10px 14px 4px", borderTop: `1px solid ${COLORS.border}` }} />
        <div style={{ padding: "0 16px 4px", fontSize: 10, color: COLORS.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Tools</div>

        <div
          onClick={onSelectFocus}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "focus" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "focus" ? "#f0c040" : "transparent"}`, transition: "background 0.1s" }}
          onMouseEnter={e => { if (currentView !== "focus") { e.currentTarget.style.background = COLORS.surface2; } }}
          onMouseLeave={e => { if (currentView !== "focus") { e.currentTarget.style.background = "transparent"; } }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f0c040", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "focus" ? COLORS.text : COLORS.text2 }}>📋 Today's Focus</span>
          {focusCount > 0 && (
            <span style={{ fontSize: 11, background: "#f0c04022", color: "#f0c040", padding: "1px 7px", borderRadius: 10, fontWeight: 500 }}>{focusCount}</span>
          )}
        </div>

        <div
          onClick={onSelectEmail}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "email" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "email" ? COLORS.inbox : "transparent"}`, transition: "background 0.1s" }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.inbox, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "email" ? COLORS.text : COLORS.text2 }}>📧 Email</span>
          {gmailUnreadCount != null && gmailUnreadCount > 0 && (
            <span style={{ fontSize: 11, background: COLORS.inbox + "22", color: COLORS.inbox, padding: "1px 7px", borderRadius: 10, fontWeight: 500 }}>{gmailUnreadCount}</span>
          )}
        </div>

        <div
          onClick={onSelectCalendar}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "calendar" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "calendar" ? COLORS.calendar : "transparent"}`, transition: "background 0.1s" }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.calendar, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "calendar" ? COLORS.text : COLORS.text2 }}>📅 Calendar</span>
          {calendarEnabled && <span style={{ fontSize: 9, background: COLORS.calendar + "33", color: COLORS.calendar, padding: "1px 5px", borderRadius: 8, fontWeight: 500 }}>✓</span>}
        </div>

        <div
          onClick={onOpenSearch}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: "transparent", borderLeft: "3px solid transparent", transition: "background 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.text2, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: COLORS.text2 }}>🔍 Search</span>
          <kbd style={{ fontSize: 9, color: COLORS.text2, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 4px" }}>⌘K</kbd>
        </div>
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <SidebarBtn primary onClick={onDailyReview}>{dailyReviewPhase === 'end' ? '🌇 End Day' : '🌅 Start Day'}</SidebarBtn>
        <SidebarBtn onClick={onWeeklyReview}>📋 Weekly Review</SidebarBtn>
        <SidebarBtn onClick={onBrainDump}>🧠 Brain Dump</SidebarBtn>
      </div>

      <div style={{ padding: "8px 10px", borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 6 }}>
        <div style={{ flex: 1 }}><SidebarBtn onClick={onToggleSettings}>⚙ Settings</SidebarBtn></div>
        <div style={{ flex: 1 }}><SidebarBtn onClick={onToggleUsage}>📊 Usage</SidebarBtn></div>
      </div>
    </div>
  );
}

AppSidebar.propTypes = {
  sidebarWidth:    PropTypes.number.isRequired,
  supabaseReady:   PropTypes.bool.isRequired,
  syncStatus:      PropTypes.string.isRequired,
  counts:          PropTypes.object.isRequired,
  currentBucket:   PropTypes.string.isRequired,
  currentView:     PropTypes.string.isRequired,
  gmailUnreadCount: PropTypes.number,
  calendarEnabled: PropTypes.bool.isRequired,
  onSelectBucket:  PropTypes.func.isRequired,
  onSelectFocus:   PropTypes.func.isRequired,
  focusCount:      PropTypes.number,
  onSelectEmail:   PropTypes.func.isRequired,
  onSelectCalendar: PropTypes.func.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
  onToggleUsage:   PropTypes.func.isRequired,
  onDailyReview:   PropTypes.func.isRequired,
  dailyReviewPhase: PropTypes.string.isRequired,
  onWeeklyReview:  PropTypes.func.isRequired,
  onBrainDump:     PropTypes.func.isRequired,
  onOpenSearch:    PropTypes.func.isRequired,
};

export { AppSidebar };
