import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { COLORS } from "../../constants.jsx";
import { doGmailFetchLabelsRaw, doGmailFetchFilters, doGmailDeleteFilter } from "./gmailTools.js";
import { gmailBtnSm, gmailBtnSmDanger } from "./emailUtils.js";

// Displays Gmail filters and labels with search/filter and letter quicklinks.
function EmailRulesPanel({ googleToken, googleScope, gmailLabels, setGmailLabels, gmailFilters, setGmailFilters }) {
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesError, setRulesError] = useState(null);
  const [deletingFilterId, setDeletingFilterId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const [labelFilter, setLabelFilter] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Load rules on mount / when token changes
  useEffect(() => {
    if (googleToken && !rulesLoading && gmailLabels.length === 0) loadRules();
  }, [googleToken]); // eslint-disable-line

  const loadRules = async () => {
    setRulesLoading(true);
    setRulesError(null);
    try {
      const [labels, filters] = await Promise.all([
        doGmailFetchLabelsRaw(googleToken),
        doGmailFetchFilters(googleToken),
      ]);
      setGmailLabels(labels.filter(l => !l.type || l.type === 'user'));
      setGmailFilters(filters);
    } catch (e) { setRulesError(e.message); }
    finally { setRulesLoading(false); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {rulesLoading && <div style={{ padding: 20, textAlign: 'center', color: COLORS.muted, fontSize: 13 }}>Loading…</div>}
      {rulesError && (
        <div style={{ margin: '8px 14px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {rulesError}</span>
          <button onClick={() => setRulesError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontWeight: 700, padding: '0 4px' }}>×</button>
        </div>
      )}

      {/* Filters */}
      {!rulesLoading && (
        <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }} onClick={() => setFiltersOpen(v => !v)}>
            <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
              Filters <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>
                {filterSearch.trim() ? `${gmailFilters.filter(f => { const t = filterSearch.trim().toLowerCase(); const c = f.criteria || {}; return [c.from, c.to, c.subject, c.query].some(v => v?.toLowerCase().includes(t)); }).length} of ${gmailFilters.length}` : gmailFilters.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button style={gmailBtnSm} onClick={e => { e.stopPropagation(); loadRules(); }}>↻</button>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{filtersOpen ? '▾' : '▸'}</span>
            </div>
          </div>
          {filtersOpen && (
            <div style={{ padding: '6px 16px 8px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="text"
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Filter by from, subject, query…"
                style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 9px', fontFamily: 'inherit', fontSize: 12, color: COLORS.text, outline: 'none' }}
              />
              {filterSearch && (
                <button onClick={() => setFilterSearch('')}
                  style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                  ✕
                </button>
              )}
            </div>
          )}
          {filtersOpen && (() => {
            const term = filterSearch.trim().toLowerCase();
            const visible = term
              ? gmailFilters.filter(f => { const c = f.criteria || {}; return [c.from, c.to, c.subject, c.query].some(v => v?.toLowerCase().includes(term)); })
              : gmailFilters;
            return visible.map(f => {
            const c = f.criteria || {};
            const a = f.action || {};
            const criteriaChips = [
              c.from    && { label: `from:${c.from}` },
              c.to      && { label: `to:${c.to}` },
              c.subject && { label: `subject:${c.subject}` },
              c.query   && { label: c.query },
            ].filter(Boolean);
            const resolveLabelId = id => {
              const match = gmailLabels.find(l => l.id === id);
              return match ? match.name : id;
            };
            const addChips    = (a.addLabelIds    || []).map(id => ({ label: `+ ${resolveLabelId(id)}`, color: COLORS.next,   bg: COLORS.nextBg }));
            const removeChips = (a.removeLabelIds || []).map(id => ({ label: `− ${resolveLabelId(id)}`, color: '#e05555',     bg: '#2a1010' }));
            return (
              <div key={f.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
                    {criteriaChips.map((ch, i) => (
                      <span key={ch.label} style={{ fontSize: 11, background: COLORS.projectBg, color: COLORS.project, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{ch.label}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {[...addChips, ...removeChips].map((ch, i) => (
                      <span key={ch.label} style={{ fontSize: 11, background: ch.bg, color: ch.color, padding: '2px 8px', borderRadius: 99 }}>{ch.label}</span>
                    ))}
                  </div>
                </div>
                <button style={gmailBtnSmDanger} disabled={deletingFilterId === f.id} onClick={async () => {
                  if (googleScope !== 'full') { setRulesError('Deleting filters requires Gmail write access — reconnect in Settings.'); return; }
                  setDeletingFilterId(f.id);
                  try {
                    await doGmailDeleteFilter(f.id, googleToken);
                    setGmailFilters(prev => prev.filter(x => x.id !== f.id));
                  } catch (e) {
                    setRulesError(`Delete failed: ${e.message}`);
                  } finally {
                    setDeletingFilterId(null);
                  }
                }}>{deletingFilterId === f.id ? 'Deleting…' : 'Delete'}</button>
              </div>
            );
          }); })()}
          {filtersOpen && gmailFilters.length === 0 && !rulesLoading && (
            <div style={{ padding: '10px 16px', fontSize: 12, color: COLORS.muted }}>No filters found.</div>
          )}
          {filtersOpen && gmailFilters.length > 0 && filterSearch.trim() && (() => {
            const term = filterSearch.trim().toLowerCase();
            const count = gmailFilters.filter(f => { const c = f.criteria || {}; return [c.from, c.to, c.subject, c.query].some(v => v?.toLowerCase().includes(term)); }).count;
            return count === 0 ? <div style={{ padding: '10px 16px', fontSize: 12, color: COLORS.muted }}>No filters match "{filterSearch}"</div> : null;
          })()}
        </div>
      )}

      {/* Labels */}
      {!rulesLoading && (() => {
        const allSorted = [...gmailLabels].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        const filterTerm = labelFilter.trim().toLowerCase();
        const sortedLabels = filterTerm ? allSorted.filter(l => l.name.toLowerCase().includes(filterTerm)) : allSorted;
        // Group by first character (uppercase), non-alpha goes under '#'
        const groups = {};
        sortedLabels.forEach(label => {
          const ch = label.name[0]?.toUpperCase() || '#';
          const key = /[A-Z]/.test(ch) ? ch : '#';
          if (!groups[key]) groups[key] = [];
          groups[key].push(label);
        });
        const letters = Object.keys(groups).sort((a, b) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b));
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: 'pointer' }} onClick={() => setLabelsOpen(v => !v)}>
              <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                Labels{' '}
                <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 400 }}>
                  {filterTerm ? `${sortedLabels.length} of ${gmailLabels.length}` : gmailLabels.length}
                </span>
              </div>
              <span style={{ fontSize: 11, color: COLORS.muted }}>{labelsOpen ? '▾' : '▸'}</span>
            </div>
            {labelsOpen && (
              <>
                {/* Filter input */}
                <div style={{ padding: '6px 16px 8px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="text"
                    value={labelFilter}
                    onChange={e => setLabelFilter(e.target.value)}
                    placeholder="Filter labels…"
                    style={{ flex: 1, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '5px 9px', fontFamily: 'inherit', fontSize: 12, color: COLORS.text, outline: 'none' }}
                  />
                  {labelFilter && (
                    <button onClick={() => setLabelFilter('')}
                      style={{ padding: '4px 8px', borderRadius: 6, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                      ✕
                    </button>
                  )}
                </div>
                {/* Letter quicklinks — only shown when not filtering */}
                {!filterTerm && letters.length > 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, padding: '4px 16px 8px' }}>
                    {letters.map(letter => (
                      <button key={letter} onClick={() => document.getElementById(`label-group-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.text2, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4 }}>
                        {letter}
                      </button>
                    ))}
                  </div>
                )}
                {/* Label groups */}
                <div>
                  {sortedLabels.length === 0 && filterTerm ? (
                    <div style={{ padding: '12px 16px', fontSize: 12, color: COLORS.muted }}>No labels match "{labelFilter}"</div>
                  ) : letters.map(letter => {
                    const groupLabels = groups[letter];
                    return (
                      <div key={letter} id={filterTerm ? undefined : `label-group-${letter}`}>
                        {/* Letter divider */}
                        <div style={{ padding: '4px 16px', background: COLORS.surface2, borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 600, color: COLORS.muted, letterSpacing: '0.06em' }}>
                          {letter}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                          {groupLabels.map((label, i) => (
                            <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderTop: `1px solid ${COLORS.border}`, borderRight: i % 2 === 0 ? `1px solid ${COLORS.border}` : 'none' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: label.color?.backgroundColor || COLORS.muted, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: COLORS.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {gmailLabels.length === 0 && (
                    <div style={{ padding: '10px 16px', fontSize: 12, color: COLORS.muted }}>No user labels found.</div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

EmailRulesPanel.propTypes = {
  googleToken:     PropTypes.string.isRequired,
  googleScope:     PropTypes.string,
  gmailLabels:     PropTypes.array.isRequired,
  setGmailLabels:  PropTypes.func.isRequired,
  gmailFilters:    PropTypes.array.isRequired,
  setGmailFilters: PropTypes.func.isRequired,
};

export { EmailRulesPanel };
