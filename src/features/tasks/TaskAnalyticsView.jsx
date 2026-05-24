import PropTypes from 'prop-types';
import { useState } from 'react';
import { COLORS, BUCKETS } from '../../constants.jsx';
import { effortToMinutes, isDeferred } from './taskUtils.jsx';
import {
  buildBucketStats, buildWeeklyCompletions, buildEffortAccuracy,
  buildDueDateCompliance, buildDeferralFrequency,
  buildThroughputTrend, buildProjectHealth,
  buildEffortAccuracyByPeriod, buildEffortAccuracyByProject,
  buildContextUtilization, buildSomedayDecay,
  buildTopChronicDeferrers,
} from './analyticsUtils.js';
import { SECTION_DEFS, loadLayout, saveLayout, defaultLayout, SectionManager } from './analyticsConfig.jsx';

// --- Sub-components ---

function SectionCard({ title, children, collapsed, onToggleCollapse }) {
  const collapsible = typeof onToggleCollapse === 'function';
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
      <div
        onClick={collapsible ? onToggleCollapse : undefined}
        style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: collapsed ? 0 : 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: collapsible ? 'pointer' : 'default', userSelect: 'none' }}
      >
        <span>{title}</span>
        {collapsible && <span style={{ fontSize: 10 }}>{collapsed ? '▶' : '▼'}</span>}
      </div>
      {!collapsed && children}
    </div>
  );
}

SectionCard.propTypes = {
  title:            PropTypes.string.isRequired,
  children:         PropTypes.node.isRequired,
  collapsed:        PropTypes.bool,
  onToggleCollapse: PropTypes.func,
};

// Active buckets displayed in the bucket chart (excludes archive buckets)
const ACTIVE_BUCKET_KEYS = ['inbox', 'project', 'next', 'waiting', 'someday', 'deferred'];

function BucketChart({ counts }) {
  const max = Math.max(1, ...ACTIVE_BUCKET_KEYS.map(k => counts[k] || 0));
  return (
    <div>
      {ACTIVE_BUCKET_KEYS.map(key => {
        const cfg = BUCKETS[key];
        const count = counts[key] || 0;
        const pct = Math.round((count / max) * 100);
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 136, fontSize: 12, color: COLORS.text2, textAlign: 'right', flexShrink: 0 }}>
              {cfg.label}
            </div>
            <div style={{ flex: 1, height: 14, background: COLORS.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: pct + '%', height: '100%', background: cfg.color, borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            <div style={{ width: 28, fontSize: 12, color: COLORS.text, fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>
              {count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

BucketChart.propTypes = { counts: PropTypes.object.isRequired };

function CompletionChart({ labels, counts }) {
  const max = Math.max(1, ...counts);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
        {counts.map((c, i) => {
          const hPct = Math.round((c / max) * 100);
          return (
            <div
              key={i}
              title={labels[i] + ': ' + c + ' completed'}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}
            >
              {c > 0 && (
                <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 2 }}>{c}</div>
              )}
              <div style={{
                width: '100%',
                height: c > 0 ? hPct + '%' : '2px',
                background: c > 0 ? COLORS.next : COLORS.surface2,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 4, borderTop: `1px solid ${COLORS.border}` }}>
        <span style={{ fontSize: 10, color: COLORS.muted }}>{labels[0]}</span>
        <span style={{ fontSize: 10, color: COLORS.muted }}>{labels[Math.floor(labels.length / 2)]}</span>
        <span style={{ fontSize: 10, color: COLORS.muted }}>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

CompletionChart.propTypes = {
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
  counts: PropTypes.arrayOf(PropTypes.number).isRequired,
};

function EffortAccuracyChart({ under, onTarget, over, total }) {
  if (total === 0) {
    return (
      <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>
        No tasks with both estimated and actual effort recorded yet.
      </div>
    );
  }
  const bars = [
    { label: 'Under estimate', value: under, color: COLORS.next, title: 'Finished faster than estimated (actual < 80% of estimate)' },
    { label: 'On target', value: onTarget, color: '#4caf50', title: 'Within ±20% of estimate' },
    { label: 'Over estimate', value: over, color: COLORS.waiting, title: 'Took longer than estimated (actual > 120% of estimate)' },
  ];
  const max = Math.max(1, under, onTarget, over);
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
        {total} task{total !== 1 ? 's' : ''} with effort data
      </div>
      {bars.map(b => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 120, fontSize: 12, color: COLORS.text2, textAlign: 'right', flexShrink: 0 }}>
            {b.label}
          </div>
          <div style={{ flex: 1, height: 14, background: COLORS.surface2, borderRadius: 3, overflow: 'hidden' }} title={b.title}>
            <div style={{ width: Math.round((b.value / max) * 100) + '%', height: '100%', background: b.color, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ width: 56, fontSize: 12, color: COLORS.text, textAlign: 'right', flexShrink: 0 }}>
            {b.value} <span style={{ color: COLORS.muted }}>({Math.round((b.value / total) * 100)}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

EffortAccuracyChart.propTypes = {
  under:    PropTypes.number.isRequired,
  onTarget: PropTypes.number.isRequired,
  over:     PropTypes.number.isRequired,
  total:    PropTypes.number.isRequired,
};

function DueDateComplianceChart({ onTime, late, slipped, noDeadline, total }) {
  if (total === 0) {
    return (
      <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>
        No completed tasks with due dates recorded yet.
      </div>
    );
  }
  const onTimePct = Math.round((onTime / total) * 100);
  const latePct = Math.round((late / total) * 100);
  return (
    <div>
      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
        {onTime > 0 && (
          <div
            title={onTime + ' completed on time (' + onTimePct + '%)'}
            style={{ width: onTimePct + '%', background: COLORS.next, transition: 'width 0.3s' }}
          />
        )}
        {late > 0 && (
          <div
            title={late + ' completed late (' + latePct + '%)'}
            style={{ width: latePct + '%', background: COLORS.waiting, transition: 'width 0.3s' }}
          />
        )}
      </div>
      {/* Legend rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.next, flexShrink: 0 }} />
          <span style={{ color: COLORS.text }}>On time</span>
          <span style={{ marginLeft: 'auto', color: COLORS.text, fontWeight: 500 }}>{onTime}</span>
          <span style={{ color: COLORS.muted, width: 38, textAlign: 'right' }}>{onTimePct}%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.waiting, flexShrink: 0 }} />
          <span style={{ color: COLORS.text }}>Completed late</span>
          <span style={{ marginLeft: 'auto', color: COLORS.text, fontWeight: 500 }}>{late}</span>
          <span style={{ color: COLORS.muted, width: 38, textAlign: 'right' }}>{latePct}%</span>
        </div>
        {noDeadline > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS.muted, flexShrink: 0 }} />
            <span style={{ color: COLORS.text2 }}>No deadline</span>
            <span style={{ marginLeft: 'auto', color: COLORS.text2 }}>{noDeadline}</span>
          </div>
        )}
      </div>
      {/* Deadline slipped callout — only shown when data is available */}
      {slipped > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: COLORS.deferred }}>&#9656;</span>
          <span style={{ color: COLORS.text2 }}>
            <span style={{ color: COLORS.text, fontWeight: 500 }}>{slipped}</span> task{slipped !== 1 ? 's' : ''} had deadline extended before completion
          </span>
        </div>
      )}
    </div>
  );
}

DueDateComplianceChart.propTypes = {
  onTime:     PropTypes.number.isRequired,
  late:       PropTypes.number.isRequired,
  slipped:    PropTypes.number.isRequired,
  noDeadline: PropTypes.number.isRequired,
  total:      PropTypes.number.isRequired,
};

function DeferralFrequencyChart({ once, twice, thrice, more, total }) {
  if (total === 0) {
    return (
      <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>
        No tasks with deferral history yet. The count increments each time a task's defer date is set.
      </div>
    );
  }
  const bars = [
    { label: 'Deferred once',   value: once,   color: COLORS.deferred },
    { label: 'Deferred twice',  value: twice,  color: COLORS.waiting },
    { label: '3 times',         value: thrice, color: '#c87070' },
    { label: '4+ times',        value: more,   color: '#c84444' },
  ].filter(b => b.value > 0);
  const max = Math.max(1, ...bars.map(b => b.value));
  return (
    <div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>
        {total} task{total !== 1 ? 's' : ''} deferred at least once
      </div>
      {bars.map(b => (
        <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 120, fontSize: 12, color: COLORS.text2, textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
          <div style={{ flex: 1, height: 14, background: COLORS.surface2, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: Math.round((b.value / max) * 100) + '%', height: '100%', background: b.color, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
          <div style={{ width: 28, fontSize: 12, color: COLORS.text, fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>{b.value}</div>
        </div>
      ))}
    </div>
  );
}

DeferralFrequencyChart.propTypes = {
  once:   PropTypes.number.isRequired,
  twice:  PropTypes.number.isRequired,
  thrice: PropTypes.number.isRequired,
  more:   PropTypes.number.isRequired,
  total:  PropTypes.number.isRequired,
};

// --- New analytics chart components (FR#120 / FR#121 / FR#123 / FR#124 / FR#125) ---

function ThroughputChart({ labels, counts, current4wk, prior4wk, change }) {
  const max = Math.max(1, ...counts);
  const changePositive = change !== null && change > 0;
  const changeNegative = change !== null && change < 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: 'center', background: COLORS.surface2, borderRadius: 6, padding: '10px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{current4wk}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>last 4 weeks</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: COLORS.surface2, borderRadius: 6, padding: '10px 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text2 }}>{prior4wk}</div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>prior 4 weeks</div>
        </div>
        {change !== null && (
          <div style={{ flex: 1, textAlign: 'center', background: COLORS.surface2, borderRadius: 6, padding: '10px 8px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: changePositive ? '#4caf50' : changeNegative ? COLORS.waiting : COLORS.muted }}>
              {changePositive ? '+' : ''}{change}%
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>vs prior period</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 70 }}>
        {counts.map((c, i) => {
          const hPct = Math.round((c / max) * 100);
          const isCurrent = i >= 4;
          return (
            <div key={i} title={labels[i] + ': ' + c} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
              {c > 0 && <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 2 }}>{c}</div>}
              <div style={{ width: '100%', height: c > 0 ? hPct + '%' : '2px', background: isCurrent && c > 0 ? COLORS.next : c > 0 ? COLORS.project : COLORS.surface2, borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 4, borderTop: '1px solid ' + COLORS.border }}>
        <span style={{ fontSize: 10, color: COLORS.muted }}>{labels[0]}</span>
        <span style={{ fontSize: 10, color: COLORS.muted }}>prior 4w · current 4w</span>
        <span style={{ fontSize: 10, color: COLORS.muted }}>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}

ThroughputChart.propTypes = {
  labels:     PropTypes.arrayOf(PropTypes.string).isRequired,
  counts:     PropTypes.arrayOf(PropTypes.number).isRequired,
  current4wk: PropTypes.number.isRequired,
  prior4wk:   PropTypes.number.isRequired,
  change:     PropTypes.number,
};

function ProjectHealthSection({ stalled, allWaiting, inactive }) {
  if (stalled.length === 0 && allWaiting.length === 0 && inactive.length === 0) {
    return <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>All projects appear healthy.</div>;
  }
  const groups = [
    { label: 'Stalled',        items: stalled,    color: COLORS.waiting,  tip: 'No next action assigned' },
    { label: 'All waiting',    items: allWaiting, color: COLORS.deferred, tip: 'All active tasks are Waiting For' },
    { label: 'Inactive (30d)', items: inactive,   color: COLORS.muted,    tip: 'No completions in 30 days' },
  ].filter(g => g.items.length > 0);
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {groups.map(g => (
        <div key={g.label} style={{ flex: '1 1 160px', minWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: g.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{g.label}</span>
            <span style={{ fontSize: 11, color: COLORS.muted }}>({g.items.length})</span>
          </div>
          {g.items.slice(0, 8).map(p => (
            <div key={p.id} title={g.tip} style={{ fontSize: 12, color: COLORS.text2, padding: '3px 0', borderBottom: '0.5px solid ' + COLORS.border, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.text}
            </div>
          ))}
          {g.items.length > 8 && (
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>+{g.items.length - 8} more</div>
          )}
        </div>
      ))}
    </div>
  );
}

ProjectHealthSection.propTypes = {
  stalled:    PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, text: PropTypes.string })).isRequired,
  allWaiting: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, text: PropTypes.string })).isRequired,
  inactive:   PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, text: PropTypes.string })).isRequired,
};

function EffortAccuracyByPeriodChart({ periods }) {
  const hasData = periods.some(p => p.total > 0);
  if (!hasData) {
    return <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>No effort data by period yet.</div>;
  }
  const maxTotal = Math.max(1, ...periods.map(p => p.total));
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
        {periods.map((p, i) => {
          if (p.total === 0) {
            return (
              <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                <div style={{ width: '100%', height: 2, background: COLORS.surface2, borderRadius: 2 }} />
              </div>
            );
          }
          const stackH   = Math.round((p.total / maxTotal) * 76);
          const underPct = Math.round((p.under    / p.total) * 100);
          const onPct    = Math.round((p.onTarget / p.total) * 100);
          const overPct  = 100 - underPct - onPct;
          return (
            <div key={i} title={p.label + ': ' + p.under + ' under / ' + p.onTarget + ' on / ' + p.over + ' over'}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'default' }}>
              <div style={{ width: '100%', height: stackH, display: 'flex', flexDirection: 'column-reverse', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
                {underPct > 0 && <div style={{ width: '100%', height: underPct + '%', background: COLORS.next }} />}
                {onPct    > 0 && <div style={{ width: '100%', height: onPct    + '%', background: '#4caf50' }} />}
                {overPct  > 0 && <div style={{ width: '100%', height: overPct  + '%', background: COLORS.waiting }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, paddingTop: 4, borderTop: '1px solid ' + COLORS.border }}>
        {periods.map((p, i) => (
          <span key={i} style={{ fontSize: 10, color: COLORS.muted, flex: 1, textAlign: i === 0 ? 'left' : i === periods.length - 1 ? 'right' : 'center' }}>{p.label}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {[{ label: 'Under', color: COLORS.next }, { label: 'On target', color: '#4caf50' }, { label: 'Over', color: COLORS.waiting }].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: COLORS.text2 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />{l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

EffortAccuracyByPeriodChart.propTypes = {
  periods: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string, under: PropTypes.number, onTarget: PropTypes.number, over: PropTypes.number, total: PropTypes.number,
  })).isRequired,
};

function EffortAccuracyByProjectChart({ projects }) {
  if (!projects.length) {
    return <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>No projects with 2+ effort data points yet.</div>;
  }
  return (
    <div>
      {projects.slice(0, 8).map(p => (
        <div key={p.projectText} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: COLORS.text2, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.projectText}</div>
          <div style={{ display: 'flex', height: 12, borderRadius: 3, overflow: 'hidden', background: COLORS.surface2 }}>
            {p.under    > 0 && <div title={'Under: '    + p.under}    style={{ width: Math.round((p.under    / p.total) * 100) + '%', background: COLORS.next    }} />}
            {p.onTarget > 0 && <div title={'On: '       + p.onTarget} style={{ width: Math.round((p.onTarget / p.total) * 100) + '%', background: '#4caf50'     }} />}
            {p.over     > 0 && <div title={'Over: '     + p.over}     style={{ width: Math.round((p.over     / p.total) * 100) + '%', background: COLORS.waiting }} />}
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{p.total} task{p.total !== 1 ? 's' : ''}</div>
        </div>
      ))}
    </div>
  );
}

EffortAccuracyByProjectChart.propTypes = {
  projects: PropTypes.arrayOf(PropTypes.shape({
    projectText: PropTypes.string, under: PropTypes.number, onTarget: PropTypes.number, over: PropTypes.number, total: PropTypes.number,
  })).isRequired,
};

function ContextUtilizationChart({ contexts }) {
  if (!contexts.length) {
    return <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>No location tags assigned to tasks yet.</div>;
  }
  const maxVal = Math.max(1, ...contexts.map(c => c.active + c.completed));
  return (
    <div>
      {contexts.map(c => {
        const activePct    = Math.round((c.active    / maxVal) * 100);
        const completedPct = Math.round((c.completed / maxVal) * 100);
        return (
          <div key={c.context} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 100, fontSize: 12, color: COLORS.text2, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.context}</div>
            <div style={{ flex: 1, height: 14, background: COLORS.surface2, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              {c.active    > 0 && <div title={'Active: ' + c.active}              style={{ width: activePct    + '%', height: '100%', background: COLORS.next, transition: 'width 0.3s' }} />}
              {c.completed > 0 && <div title={'Completed (90d): ' + c.completed}  style={{ width: completedPct + '%', height: '100%', background: '#4caf50', opacity: 0.6, transition: 'width 0.3s' }} />}
            </div>
            <div style={{ width: 44, fontSize: 12, color: COLORS.text2, textAlign: 'right', flexShrink: 0 }}>
              <span style={{ color: COLORS.text, fontWeight: 500 }}>{c.active}</span>
              {c.completed > 0 && <span style={{ color: COLORS.muted }}>/{c.completed}</span>}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: COLORS.text2 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS.next }} />Active</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: COLORS.text2 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#4caf50', opacity: 0.6 }} />Completed (90d)</div>
      </div>
    </div>
  );
}

ContextUtilizationChart.propTypes = {
  contexts: PropTypes.arrayOf(PropTypes.shape({ context: PropTypes.string, active: PropTypes.number, completed: PropTypes.number })).isRequired,
};

function SomedayDecaySection({ flagged, threshold, total, onThresholdChange }) {
  if (total === 0) {
    return <div style={{ fontSize: 13, color: COLORS.muted, padding: '10px 0' }}>No Someday / Maybe items yet.</div>;
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: COLORS.text2 }}>
          <span style={{ color: flagged.length > 0 ? COLORS.waiting : COLORS.muted, fontWeight: 600 }}>{flagged.length}</span> of {total} items older than
        </span>
        <input
          type="number" min={7} max={365} value={threshold}
          onChange={e => onThresholdChange(Math.max(7, Math.min(365, parseInt(e.target.value) || 90)))}
          style={{ width: 52, fontSize: 13, padding: '2px 6px', borderRadius: 4, border: '1px solid ' + COLORS.border, background: COLORS.surface2, color: COLORS.text, textAlign: 'center' }}
        />
        <span style={{ fontSize: 13, color: COLORS.text2 }}>days</span>
      </div>
      {flagged.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.muted }}>No items exceed the threshold.</div>
      ) : (
        flagged.slice(0, 10).map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '0.5px solid ' + COLORS.border }}>
            <div style={{ flex: 1, fontSize: 13, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, flexShrink: 0 }}>{item.ageDays}d</div>
          </div>
        ))
      )}
      {flagged.length > 10 && (
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>+{flagged.length - 10} more</div>
      )}
    </div>
  );
}

SomedayDecaySection.propTypes = {
  flagged:           PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, text: PropTypes.string, ageDays: PropTypes.number })).isRequired,
  threshold:         PropTypes.number.isRequired,
  total:             PropTypes.number.isRequired,
  onThresholdChange: PropTypes.func.isRequired,
};

// --- FR#126: Top chronic deferrers list ---

function TopDeferrersList({ deferrers }) {
  if (!deferrers.length) return null;
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 600 }}>
        Chronic deferrers (3+)
      </div>
      {deferrers.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', borderBottom: `0.5px solid ${COLORS.border}` }}>
          <div style={{ flex: 1, fontSize: 13, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.text}
          </div>
          <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: '#c8444422', color: '#c84444', border: '1px solid #c8444444', flexShrink: 0, whiteSpace: 'nowrap' }}>
            🔁 {d.deferCount}×
          </span>
        </div>
      ))}
    </div>
  );
}

TopDeferrersList.propTypes = {
  deferrers: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, text: PropTypes.string, deferCount: PropTypes.number })).isRequired,
};

// --- Main export ---

function TaskAnalyticsView({ tasks }) {
  const [decayThreshold, setDecayThreshold] = useState(90);
  const [configOpen, setConfigOpen] = useState(false);
  const [layout, setLayout] = useState(() => {
    const saved = loadLayout();
    if (!saved) return defaultLayout();
    const savedIds = new Set(saved.map(s => s.id));
    const merged = [...saved];
    SECTION_DEFS.forEach(def => { if (!savedIds.has(def.id)) merged.push({ id: def.id, visible: true, collapsed: false }); });
    return merged;
  });

  const bucketCounts    = buildBucketStats(tasks);
  const { labels, counts } = buildWeeklyCompletions(tasks);
  const accuracy        = buildEffortAccuracy(tasks);
  const compliance      = buildDueDateCompliance(tasks);
  const deferralFreq    = buildDeferralFrequency(tasks);
  const throughput      = buildThroughputTrend(tasks);
  const projectHealth   = buildProjectHealth(tasks);
  const effortByPeriod  = buildEffortAccuracyByPeriod(tasks);
  const effortByProject = buildEffortAccuracyByProject(tasks);
  const contexts        = buildContextUtilization(tasks);
  const somedayDecay    = buildSomedayDecay(tasks, decayThreshold);
  const topChronicDeferrers = buildTopChronicDeferrers(tasks);
  const totalActive    = ACTIVE_BUCKET_KEYS.reduce((s, k) => s + (bucketCounts[k] || 0), 0);
  const totalCompleted = bucketCounts['done'] || 0;

  function handleLayoutChange(next) { setLayout(next); saveLayout(next); }
  function toggleCollapse(id) {
    handleLayoutChange(layout.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s));
  }

  const sectionContents = {
    buckets:           { title: 'Active tasks by bucket',          node: <BucketChart counts={bucketCounts} /> },
    completions:       { title: 'Completions — last 12 weeks',     node: <CompletionChart labels={labels} counts={counts} /> },
    throughput:        { title: 'Throughput — 8-week trend',       node: <ThroughputChart {...throughput} /> },
    project_health:    { title: 'Project health',                  node: <ProjectHealthSection {...projectHealth} /> },
    effort_accuracy:   { title: 'Effort estimate accuracy',        node: <EffortAccuracyChart {...accuracy} /> },
    effort_by_period:  { title: 'Effort accuracy — by month',      node: <EffortAccuracyByPeriodChart periods={effortByPeriod} /> },
    effort_by_project: { title: 'Effort accuracy — by project',   node: <EffortAccuracyByProjectChart projects={effortByProject} /> },
    due_date:          { title: 'Due date compliance',             node: <DueDateComplianceChart {...compliance} /> },
    deferrals:         { title: 'Deferral frequency',              node: <><DeferralFrequencyChart {...deferralFreq} /><TopDeferrersList deferrers={topChronicDeferrers} /></> },
    context:           { title: 'Context utilization',             node: <ContextUtilizationChart contexts={contexts} /> },
    someday:           { title: 'Someday / Maybe decay',           node: <SomedayDecaySection {...somedayDecay} onThresholdChange={setDecayThreshold} /> },
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: COLORS.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Task Analytics</div>
            <div style={{ fontSize: 13, color: COLORS.muted }}>
              {totalActive} active task{totalActive !== 1 ? 's' : ''} · {totalCompleted} completed
            </div>
          </div>
          <button
            onClick={() => setConfigOpen(o => !o)}
            style={{ fontSize: 12, padding: '4px 10px', background: configOpen ? COLORS.surface2 : 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.text2, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
          >
            {configOpen ? 'Done' : 'Configure'}
          </button>
        </div>
        {configOpen && <SectionManager layout={layout} onChange={handleLayoutChange} />}
        {layout.filter(s => s.visible).map(s => {
          const sec = sectionContents[s.id];
          if (!sec) return null;
          return (
            <SectionCard key={s.id} title={sec.title} collapsed={s.collapsed} onToggleCollapse={() => toggleCollapse(s.id)}>
              {sec.node}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}

TaskAnalyticsView.propTypes = {
  tasks: PropTypes.array.isRequired,
};

export { TaskAnalyticsView };
