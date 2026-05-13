import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { EmailInboxPanel } from "./EmailInboxPanel.jsx";
import { EmailCleanupPanel } from "./EmailCleanupPanel.jsx";
import { EmailRulesPanel } from "./EmailRulesPanel.jsx";
import { useGmailRulesCache } from "./useGmailRulesCache.js";

// Tab container for the Email Management view — renders one of three panels
// (Inbox, Cleanup, Rules) based on the active emailTab prop.
function EmailManagementView({ googleToken, googleScope, gmailQueue, setGmailQueue, emailTab, setEmailTab, processEmailWithAI, attachEmailToTask, tasks, openCoachChat, authUser }) {
  const { gmailLabels, setGmailLabels, gmailFilters, setGmailFilters } = useGmailRulesCache();

  const tabStyle = (t) => ({
    padding: '9px 14px', fontSize: 13, cursor: 'pointer',
    color: emailTab === t ? COLORS.text : COLORS.text2,
    fontWeight: emailTab === t ? 500 : 400,
    borderBottom: `2px solid ${emailTab === t ? COLORS.inbox : 'transparent'}`,
    marginBottom: -1,
  });

  if (!googleToken) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: COLORS.text2 }}>
        <div style={{ fontSize: 32 }}>📧</div>
        <div style={{ fontSize: 14, color: COLORS.text2 }}>Connect Gmail to use Email Management</div>
        <div style={{ fontSize: 12, color: COLORS.muted }}>Go to Settings → Gmail to connect your account</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.surface, padding: '0 16px', flexShrink: 0 }}>
        {['inbox', 'cleanup', 'rules'].map(t => (
          <div key={t} style={tabStyle(t)} onClick={() => setEmailTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'cleanup' && gmailQueue.length > 0 && (
              <span style={{ marginLeft: 5, fontSize: 10, background: COLORS.surface3, color: COLORS.muted, padding: '1px 6px', borderRadius: 10 }}>{gmailQueue.length}</span>
            )}
          </div>
        ))}
      </div>

      {emailTab === 'inbox'   && <EmailInboxPanel   googleToken={googleToken} googleScope={googleScope} processEmailWithAI={processEmailWithAI} attachEmailToTask={attachEmailToTask} tasks={tasks} />}
      {emailTab === 'cleanup' && <EmailCleanupPanel gmailQueue={gmailQueue} setGmailQueue={setGmailQueue} googleToken={googleToken} authUser={authUser} openCoachChat={openCoachChat} />}
      {emailTab === 'rules'   && <EmailRulesPanel   googleToken={googleToken} googleScope={googleScope} gmailLabels={gmailLabels} setGmailLabels={setGmailLabels} gmailFilters={gmailFilters} setGmailFilters={setGmailFilters} />}
    </div>
  );
}

EmailManagementView.propTypes = {
  googleToken:        PropTypes.string.isRequired,
  googleScope:        PropTypes.string,
  gmailQueue:         PropTypes.arrayOf(PropTypes.object).isRequired,
  setGmailQueue:      PropTypes.func.isRequired,
  emailTab:           PropTypes.string.isRequired,
  setEmailTab:        PropTypes.func.isRequired,
  processEmailWithAI: PropTypes.func.isRequired,
  attachEmailToTask:  PropTypes.func,
  tasks:              PropTypes.array,
  openCoachChat:      PropTypes.func.isRequired,
  authUser:           PropTypes.object,
};

export { EmailManagementView };
