import PropTypes from "prop-types";
import { COLORS } from "../constants.jsx";
import { createEmptyUsageStats, fmtCost, fmtTokens } from "../hooks/useAIUsageTracking.js";

const MODE_LABELS = {
  chat: 'Chat', process: 'Process Inbox', weeklyReview: 'Weekly Review',
  brainDump: 'Brain Dump', projectReview: 'Project Review', projectMetadata: 'Project Metadata',
};

function UsagePanel({ stats, onClear, onClose }) {
  const s = stats || createEmptyUsageStats();
  const totalCost = (s.byProvider?.claude?.costUsd || 0);
  const totalSaved = (s.byProvider?.ollama?.savedUsd || 0);
  const claudeIn = s.byProvider?.claude?.inputTokens || 0;
  const claudeOut = s.byProvider?.claude?.outputTokens || 0;
  const claudeReq = s.byProvider?.claude?.requests || 0;
  const ollamaIn = s.byProvider?.ollama?.inputTokens || 0;
  const ollamaOut = s.byProvider?.ollama?.outputTokens || 0;
  const ollamaReq = s.byProvider?.ollama?.requests || 0;

  const avgTokSec = (() => {
    if (!s.history || s.history.length === 0) return null;
    const valid = s.history.filter(h => h.durationMs > 0 && h.outputTokens > 0);
    if (valid.length === 0) return null;
    const avg = valid.reduce((a, h) => a + (h.outputTokens / (h.durationMs / 1000)), 0) / valid.length;
    return avg.toFixed(1);
  })();

  const sectionHd = { fontSize: 11, fontWeight: 600, color: COLORS.text2, letterSpacing: '0.07em', textTransform: 'uppercase', margin: '20px 0 8px' };
  const stat = (label, value, sub) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <span style={{ fontSize: 12, color: COLORS.text }}>{label}</span>
      <span style={{ fontSize: 12, color: COLORS.text2 }}>{value}{sub && <span style={{ fontSize: 10, color: COLORS.muted, marginLeft: 4 }}>{sub}</span>}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 300 }}>📊 AI Usage</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>Lifetime token usage and cost tracking</div>
        </div>
        <button onClick={onClose} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>✕ Close</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>

        {/* Lifetime totals */}
        <div style={sectionHd}>Lifetime Totals</div>
        {stat('Total requests', (s.totalRequests || 0).toLocaleString())}
        {stat('Input tokens', fmtTokens(s.totalInputTokens || 0), `(${(s.totalInputTokens || 0).toLocaleString()})`)}
        {stat('Output tokens', fmtTokens(s.totalOutputTokens || 0), `(${(s.totalOutputTokens || 0).toLocaleString()})`)}
        {avgTokSec && stat('Avg output speed', `${avgTokSec} tok/s`)}

        {/* By provider */}
        <div style={sectionHd}>By Provider</div>
        <div style={{ background: COLORS.surface2, borderRadius: 8, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
          {/* Claude */}
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Claude (Anthropic)</span>
              <span style={{ fontSize: 13, color: COLORS.inbox, fontWeight: 600 }}>{fmtCost(totalCost)}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLORS.muted }}>
              <span>{claudeReq.toLocaleString()} requests</span>
              <span>↑ {fmtTokens(claudeIn)} in</span>
              <span>↓ {fmtTokens(claudeOut)} out</span>
            </div>
          </div>
          {/* Ollama */}
          <div style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Local LLM (Ollama)</span>
              <span style={{ fontSize: 11, color: COLORS.next, fontWeight: 600 }}>Free · saved {fmtCost(totalSaved)}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: COLORS.muted }}>
              <span>{ollamaReq.toLocaleString()} requests</span>
              <span>↑ {fmtTokens(ollamaIn)} in</span>
              <span>↓ {fmtTokens(ollamaOut)} out</span>
            </div>
            {totalSaved > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: COLORS.next }}>
                💰 You saved {fmtCost(totalSaved)} by using a local model instead of Claude
              </div>
            )}
          </div>
        </div>

        {/* By mode */}
        <div style={sectionHd}>By Mode</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: COLORS.muted }}>
              <th style={{ textAlign: 'left', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Mode</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Requests</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Input</th>
              <th style={{ textAlign: 'right', padding: '4px 0', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500 }}>Output</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(s.byMode || {}).sort((a, b) => b[1].requests - a[1].requests).map(([mode, ms]) => (
              <tr key={mode}>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text }}>{MODE_LABELS[mode] || mode}</td>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', color: COLORS.text2 }}>{ms.requests}</td>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', color: COLORS.text2 }}>{fmtTokens(ms.inputTokens)}</td>
                <td style={{ padding: '5px 0', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', color: COLORS.text2 }}>{fmtTokens(ms.outputTokens)}</td>
              </tr>
            ))}
            {Object.keys(s.byMode || {}).length === 0 && (
              <tr><td colSpan={4} style={{ padding: '12px 0', color: COLORS.muted, textAlign: 'center' }}>No usage recorded yet</td></tr>
            )}
          </tbody>
        </table>

        {/* Clear */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
          <button
            onClick={() => { if (window.confirm('Clear all lifetime usage statistics? This cannot be undone.')) onClear(); }}
            style={{ padding: '7px 14px', borderRadius: 7, border: `1px solid ${COLORS.border2}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}
          >🗑 Clear all stats</button>
        </div>
      </div>
    </div>
  );
}

UsagePanel.propTypes = {
  stats:   PropTypes.object,
  onClear: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export { MODE_LABELS, UsagePanel };
