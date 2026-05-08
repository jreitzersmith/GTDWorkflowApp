import { useState, useEffect, useCallback } from "react";

// ── AI Usage tracking helpers ──────────────────────────────────────
function createEmptyUsageStats() {
  return {
    totalInputTokens: 0, totalOutputTokens: 0, totalRequests: 0,
    byMode: {},
    byProvider: {
      claude: { inputTokens: 0, outputTokens: 0, requests: 0, costUsd: 0 },
      ollama: { inputTokens: 0, outputTokens: 0, requests: 0, savedUsd: 0 },
    },
    history: [],
  };
}
function calcCost(inputTokens, outputTokens) {
  return (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;
}
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
function fmtCost(usd) {
  if (!usd) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return '$' + usd.toFixed(2);
}

// ── useAIUsageTracking ────────────────────────────────────────────────────────
// Tracks token usage and cost across all AI calls; persists totals to localStorage.
function useAIUsageTracking() {
  const [aiUsageStats, setAiUsageStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gtd_ai_usage') || 'null') || createEmptyUsageStats(); }
    catch { return createEmptyUsageStats(); }
  });
  const [sessionUsage, setSessionUsage] = useState({ inputTokens: 0, outputTokens: 0, requests: 0, costUsd: 0 });

  useEffect(() => { localStorage.setItem('gtd_ai_usage', JSON.stringify(aiUsageStats)); }, [aiUsageStats]);

  const recordUsage = useCallback((inputTokens, outputTokens, durationMs, mode, prov) => {
    const cost  = prov === 'claude' ? calcCost(inputTokens, outputTokens) : 0;
    const saved = prov === 'ollama' ? calcCost(inputTokens, outputTokens) : 0;
    setSessionUsage(prev => ({
      inputTokens:  prev.inputTokens  + inputTokens,
      outputTokens: prev.outputTokens + outputTokens,
      requests:     prev.requests     + 1,
      costUsd:      prev.costUsd      + cost,
    }));
    setAiUsageStats(prev => {
      const mk = mode || 'chat';
      const ms = prev.byMode[mk]       || { inputTokens: 0, outputTokens: 0, requests: 0 };
      const ps = prev.byProvider[prov] || { inputTokens: 0, outputTokens: 0, requests: 0 };
      const histEntry = { ts: new Date().toISOString(), mode: mk, provider: prov, inputTokens, outputTokens, durationMs };
      const history = [histEntry, ...(prev.history || [])].slice(0, 500);
      return {
        ...prev,
        totalInputTokens:  (prev.totalInputTokens  || 0) + inputTokens,
        totalOutputTokens: (prev.totalOutputTokens || 0) + outputTokens,
        totalRequests:     (prev.totalRequests     || 0) + 1,
        byMode: { ...prev.byMode, [mk]: { inputTokens: ms.inputTokens + inputTokens, outputTokens: ms.outputTokens + outputTokens, requests: ms.requests + 1 } },
        byProvider: {
          ...prev.byProvider,
          [prov]: {
            ...ps,
            inputTokens:  ps.inputTokens  + inputTokens,
            outputTokens: ps.outputTokens + outputTokens,
            requests:     ps.requests     + 1,
            costUsd:  (ps.costUsd  || 0) + cost,
            savedUsd: (ps.savedUsd || 0) + saved,
          },
        },
        history,
      };
    });
  }, []);

  return { aiUsageStats, setAiUsageStats, sessionUsage, recordUsage };
}


export { useAIUsageTracking, createEmptyUsageStats, fmtTokens, fmtCost };
