import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";

function AuthGate({ authLoading, authUser, authSent, authEmail, setAuthEmail, sendMagicLink, authError, children }) {
  if (authLoading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
                  background: COLORS.bg, color: COLORS.muted,
                  fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif" }}>
      Loading…
    </div>
  );

  if (!authUser) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center",
                  background: COLORS.bg, fontFamily: "'Instrument Sans', 'Segoe UI', sans-serif" }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12,
                    padding: "36px 40px", width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>
          GTD <em style={{ fontStyle: "italic", color: COLORS.next }}>Manager</em>
        </div>
        <div style={{ fontSize: 13, color: COLORS.text2 }}>Sign in with a magic link — no password needed.</div>
        {authSent ? (
          <div style={{ fontSize: 13, color: COLORS.next, padding: "10px 14px",
                        background: COLORS.nextBg, borderRadius: 8 }}>
            Check your email for a login link.
          </div>
        ) : (
          <>
            <input
              type="email"
              placeholder="your@email.com"
              value={authEmail}
              onChange={e => setAuthEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") sendMagicLink(); }}
              autoFocus
              style={{ padding: "8px 12px", borderRadius: 7, border: `1px solid ${COLORS.border}`,
                       background: COLORS.surface2, color: COLORS.text,
                       fontFamily: "inherit", fontSize: 13, outline: "none" }}
            />
            <button
              onClick={sendMagicLink}
              style={{ padding: "9px 0", borderRadius: 7, border: "none", background: COLORS.next,
                       color: "#111", fontFamily: "inherit", fontSize: 13,
                       fontWeight: 600, cursor: "pointer" }}
            >Send login link</button>
            {authError && (
              <div style={{ fontSize: 12, color: "#e57373", padding: "8px 12px",
                            background: "rgba(229,115,115,0.1)", borderRadius: 8 }}>
                {authError}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return children;
}

AuthGate.propTypes = {
  authLoading:   PropTypes.bool.isRequired,
  authUser:      PropTypes.object,
  authSent:      PropTypes.bool.isRequired,
  authEmail:     PropTypes.string.isRequired,
  setAuthEmail:  PropTypes.func.isRequired,
  sendMagicLink: PropTypes.func.isRequired,
  authError:     PropTypes.string,
  children:      PropTypes.node.isRequired,
};

export { AuthGate };
