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
  contactsEnabled,
  onSelectBucket,
  onSelectFocus,
  focusCount,
  onSelectEmail,
  onSelectCalendar,
  onSelectAnalytics,
  onSelectContacts,
  onSelectHealth,
  onSelectHabits,
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
          accessKey="f"
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "focus" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "focus" ? "#f0c040" : "transparent"}`, transition: "background 0.1s" }}
          onMouseEnter={e => { if (currentView !== "focus") { e.currentTarget.style.background = COLORS.surface2; } }}
          onMouseLeave={e => { if (currentView !== "focus") { e.currentTarget.style.background = "transparent"; } }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f0c040", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "focus" ? COLORS.text : COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>📋</span>
            Today's Focus
          </span>
          {focusCount > 0 && (
            <span style={{ fontSize: 11, background: "#f0c04022", color: "#f0c040", padding: "1px 7px", borderRadius: 10, fontWeight: 500 }}>{focusCount}</span>
          )}
        </div>

        <div
          onClick={onSelectEmail}
          accessKey="e"
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "email" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "email" ? COLORS.inbox : "transparent"}`, transition: "background 0.1s" }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.inbox, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "email" ? COLORS.text : COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>📧</span>
            Email
          </span>
          {gmailUnreadCount != null && gmailUnreadCount > 0 && (
            <span style={{ fontSize: 11, background: COLORS.inbox + "22", color: COLORS.inbox, padding: "1px 7px", borderRadius: 10, fontWeight: 500 }}>{gmailUnreadCount}</span>
          )}
        </div>

        <div
          onClick={onSelectCalendar}
          accessKey="l"
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "calendar" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "calendar" ? COLORS.calendar : "transparent"}`, transition: "background 0.1s" }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.calendar, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "calendar" ? COLORS.text : COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>📅</span>
            Calendar
          </span>
          {calendarEnabled && <span style={{ fontSize: 9, background: COLORS.calendar + "33", color: COLORS.calendar, padding: "1px 5px", borderRadius: 8, fontWeight: 500 }}>✓</span>}
        </div>

        <div
          onClick={onSelectContacts}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "contacts" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "contacts" ? "#4db6ac" : "transparent"}`, transition: "background 0.1s" }}
          onMouseEnter={e => { if (currentView !== "contacts") { e.currentTarget.style.background = COLORS.surface2; } }}
          onMouseLeave={e => { if (currentView !== "contacts") { e.currentTarget.style.background = "transparent"; } }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4db6ac", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "contacts" ? COLORS.text : COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>👤</span>
            Contacts
          </span>
          {contactsEnabled && <span style={{ fontSize: 9, background: "#4db6ac33", color: "#4db6ac", padding: "1px 5px", borderRadius: 8, fontWeight: 500 }}>✓</span>}
        </div>

        <div
          onClick={onSelectHealth}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "health" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "health" ? "#e57373" : "transparent"}`, transition: "background 0.1s" }}
          onMouseEnter={e => { if (currentView !== "health") { e.currentTarget.style.background = COLORS.surface2; } }}
          onMouseLeave={e => { if (currentView !== "health") { e.currentTarget.style.background = "transparent"; } }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e57373", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "health" ? COLORS.text : COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>💊</span>
            Health
          </span>
        </div>

        <div
          onClick={onSelectHabits}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 16px', cursor: 'pointer', background: currentView === 'habits' ? COLORS.surface2 : 'transparent', borderLeft: `3px solid ${currentView === 'habits' ? '#a5d6a7' : 'transparent'}`, transition: 'background 0.1s' }}
          onMouseEnter={e => { if (currentView !== 'habits') { e.currentTarget.style.background = COLORS.surface2; } }}
          onMouseLeave={e => { if (currentView !== 'habits') { e.currentTarget.style.background = 'transparent'; } }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#a5d6a7', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === 'habits' ? COLORS.text : COLORS.text2, display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: '1.4em', textAlign: 'center', flexShrink: 0 }}>🌱</span>
            Habits
          </span>
        </div>

        <div
          onClick={onSelectAnalytics}
          accessKey="a"
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: currentView === "analytics" ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${currentView === "analytics" ? COLORS.accent : "transparent"}`, transition: "background 0.1s" }}
          onMouseEnter={e => { if (currentView !== "analytics") { e.currentTarget.style.background = COLORS.surface2; } }}
          onMouseLeave={e => { if (currentView !== "analytics") { e.currentTarget.style.background = "transparent"; } }}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: currentView === "analytics" ? COLORS.text : COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>📊</span>
            Analytics
          </span>
        </div>

        <div
          onClick={onOpenSearch}
          accessKey="k"
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: "transparent", borderLeft: "3px solid transparent", transition: "background 0.1s" }}
          onMouseEnter={e => e.currentTarget.style.background = COLORS.surface2}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.text2, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: COLORS.text2, display: "flex", alignItems: "center" }}>
            <span style={{ display: "inline-block", width: "1.4em", textAlign: "center", flexShrink: 0 }}>🔍</span>
            Search
          </span>
          <kbd style={{ fontSize: 9, color: COLORS.text2, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "1px 4px" }}>⌘K</kbd>
        </div>
      </div>

      <div style={{ padding: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
        <SidebarBtn primary onClick={onDailyReview} accessKey="q">{dailyReviewPhase === 'end' ? '🌇 End Day' : '🌅 Start Day'}</SidebarBtn>
        <SidebarBtn onClick={onWeeklyReview} accessKey="r">📋 Weekly Review</SidebarBtn>
        <SidebarBtn onClick={onBrainDump} accessKey="b">🧠 Brain Dump</SidebarBtn>
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
  calendarEnabled:  PropTypes.bool.isRequired,
  contactsEnabled:  PropTypes.bool.isRequired,
  onSelectBucket:  PropTypes.func.isRequired,
  onSelectFocus:   PropTypes.func.isRequired,
  focusCount:      PropTypes.number,
  onSelectEmail:   PropTypes.func.isRequired,
  onSelectCalendar: PropTypes.func.isRequired,
  onSelectAnalytics:  PropTypes.func.isRequired,
  onSelectContacts:   PropTypes.func.isRequired,
  onSelectHealth:     PropTypes.func.isRequired,
  onSelectHabits:     PropTypes.func.isRequired,
  onToggleSettings: PropTypes.func.isRequired,
  onToggleUsage:   PropTypes.func.isRequired,
  onDailyReview:   PropTypes.func.isRequired,
  dailyReviewPhase: PropTypes.string.isRequired,
  onWeeklyReview:  PropTypes.func.isRequired,
  onBrainDump:     PropTypes.func.isRequired,
  onOpenSearch:    PropTypes.func.isRequired,
};

export { AppSidebar };
