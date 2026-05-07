import { COLORS } from "../constants.jsx";

// Resolves after `ms` milliseconds — used to pace bulk-action queue runs.
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Avatar helpers ────────────────────────────────────────────────────────────

function avatarInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || '?').slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  { bg: '#1e2a3a', text: '#5a8fd4' }, { bg: '#1a2a1e', text: '#5ab878' },
  { bg: '#2a1e14', text: '#d4845a' }, { bg: '#1e1a2a', text: '#9a8ad4' },
  { bg: '#2a1e1a', text: '#d4765a' }, { bg: '#152520', text: '#6ec6a8' },
];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Date formatting ───────────────────────────────────────────────────────────

function formatEmailDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Shared button style factories ─────────────────────────────────────────────

const gmailBtn = (extra = {}) => ({
  fontSize: 12, padding: '5px 10px', borderRadius: 7,
  border: `1px solid ${COLORS.border}`, background: 'transparent',
  color: COLORS.text2, fontFamily: 'inherit', cursor: 'pointer', ...extra,
});
const gmailBtnPrimary  = gmailBtn({ background: COLORS.inboxBg, color: COLORS.inbox, borderColor: COLORS.inbox });
const gmailBtnSm       = gmailBtn({ fontSize: 11, padding: '3px 8px' });
const gmailBtnSmDanger = gmailBtn({ fontSize: 11, padding: '3px 8px', color: '#e05555', borderColor: '#5a2020' });

export { sleep, avatarInitials, AVATAR_COLORS, avatarColor, formatEmailDate, gmailBtn, gmailBtnPrimary, gmailBtnSm, gmailBtnSmDanger };
