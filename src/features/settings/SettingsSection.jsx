import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";

// Collapsible section wrapper used throughout SettingsPanel.
// Open/closed state is persisted to localStorage via storageKey.
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

SettingsSection.propTypes = {
  label:      PropTypes.string.isRequired,
  storageKey: PropTypes.string.isRequired,
  children:   PropTypes.node.isRequired,
};

export { SettingsSection };
