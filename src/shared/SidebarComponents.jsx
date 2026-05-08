import { useState } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";

// Sidebar navigation item — shows bucket label, colour dot, and task count.
function BucketItem({ bkey, cfg, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", cursor: "pointer", background: active ? COLORS.surface2 : "transparent", borderLeft: `3px solid ${active ? cfg.color : "transparent"}`, transition: "background 0.1s" }}
    >
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, color: active ? COLORS.text : COLORS.text2 }}>{cfg.label}</span>
      <span style={{ fontSize: 11, background: COLORS.surface3, color: COLORS.muted, padding: "1px 7px", borderRadius: 10, minWidth: 22, textAlign: "center" }}>{count}</span>
    </div>
  );
}
BucketItem.propTypes = {
  bkey:    PropTypes.string.isRequired,
  cfg:     PropTypes.shape({ label: PropTypes.string, color: PropTypes.string }).isRequired,
  count:   PropTypes.number.isRequired,
  active:  PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

// Sidebar action button — primary variant uses the inbox accent colour.
function SidebarBtn({ children, onClick, primary }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 11px", borderRadius: 7, border: `1px solid ${primary ? COLORS.inbox : COLORS.border}`, background: primary ? (hover ? "#f0d060" : COLORS.inbox) : (hover ? COLORS.surface2 : "transparent"), color: primary ? "#111" : (hover ? COLORS.text : COLORS.text2), fontFamily: "inherit", fontSize: 12, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 7, fontWeight: primary ? 600 : 400, transition: "all 0.12s" }}
    >
      {children}
    </button>
  );
}
SidebarBtn.propTypes = {
  children: PropTypes.node.isRequired,
  onClick:  PropTypes.func.isRequired,
  primary:  PropTypes.bool,
};

// Generic surface button used in toolbar and action areas.
function Btn({ children, onClick, style }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "7px 12px", borderRadius: 7, border: `1px solid ${COLORS.border}`, background: hover ? COLORS.surface3 : COLORS.surface2, color: COLORS.text2, fontFamily: "inherit", cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap", ...style }}
    >
      {children}
    </button>
  );
}
Btn.propTypes = {
  children: PropTypes.node.isRequired,
  onClick:  PropTypes.func.isRequired,
  style:    PropTypes.object,
};

export { BucketItem, SidebarBtn, Btn };
