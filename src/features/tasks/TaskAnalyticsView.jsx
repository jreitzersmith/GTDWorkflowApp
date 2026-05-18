import PropTypes from 'prop-types';
import { COLORS, BUCKETS } from '../../constants.jsx';
import { effortToMinutes, isDeferred } from './taskUtils.jsx';

// --- Pure data functions ---

function buildBucketStats(tasks) {
  // Mirror the virtual-filter logic from App.jsx counts — next/waiting/someday/deferred
  // are flag-based views that can include tasks from any bucket (e.g. project children).
  return {
    inbox:        tasks.filter(t => t.bucket === 'inbox').length,
    project:      tasks.filter(t => t.bucket === 'project').length,
    next:         tasks.filter(t => t.isNextAction && !t.isSomeday && !t.isWaitingFor && !t.done).length,
    waiting:      tasks.filter(t => t.isWaitingFor && !t.done).length,
    someday:      tasks.filter(t => t.isSomeday && !t.done).length,
    deferred:     tasks.filter(t => isDeferred(t) && !t.done).length,
    done:         tasks.filter(t => t.bucket === 'done').length,
    inboxHistory: tasks.filter(t => t.bucket === 'inboxHistory').length,
  };
}

function buildWeeklyCompletions(tasks, weeks = 12) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const labels = [];
  const weekStarts = [];
  // Build week start dates going back `weeks` weeks (each starting Sunday)
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7 - d.getDay());
    d.setHours(0, 0, 0, 0);
    weekStarts.push(new Date(d));
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  const counts = new Array(weeks).fill(0);
  for (const t of tasks) {
    if (!t.completedDate) continue;
    const cd = new Date(t.completedDate + 'T00:00:00');
    for (let i = 0; i < weeks; i++) {
      const end = new Date(weekStarts[i]);
      end.setDate(end.getDate() + 7);
      if (cd >= weekStarts[i] && cd < end) { counts[i]++; break; }
    }
  }
  return { labels, counts };
}

function buildEffortAccuracy(tasks) {
  let under = 0, onTarget = 0, over = 0;
  for (const t of tasks) {
    if (!t.effort || !t.actualEffort) continue;
    const est = effortToMinutes(t.effort);
    const actual = effortToMinutes(t.actualEffort);
    if (!est || !actual) continue;
    const ratio = actual / est;
    if (ratio < 0.8) under++;
    else if (ratio <= 1.2) onTarget++;
    else over++;
  }
  return { under, onTarget, over, total: under + onTarget + over };
}


function buildDueDateCompliance(tasks) {
  // On-time vs late: completed tasks that had a due date
  const withDeadline = tasks.filter(t => t.done && t.completedDate && t.dueDate);
  let onTime = 0, late = 0;
  for (const t of withDeadline) {
    if (t.completedDate <= t.dueDate) onTime++;
    else late++;
  }
  // Deadline slipped: originalDueDate set and earlier than final dueDate
  // (only populated for tasks whose due date was changed after initial assignment)
  const slipped = tasks.filter(t => t.done && t.originalDueDate && t.dueDate && t.originalDueDate < t.dueDate).length;
  const noDeadline = tasks.filter(t => t.done && t.completedDate && !t.dueDate).length;
  return { onTime, late, slipped, noDeadline, total: withDeadline.length };
}

function buildDeferralFrequency(tasks) {
  const counts = { once: 0, twice: 0, thrice: 0, more: 0 };
  let total = 0;
  for (const t of tasks) {
    const n = t.deferCount || 0;
    if (n === 0) continue;
    total++;
    if (n === 1) counts.once++;
    else if (n === 2) counts.twice++;
    else if (n === 3) counts.thrice++;
    else counts.more++;
  }
  return { ...counts, total };
}

// --- Sub-components ---

function SectionCard({ title, children }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

SectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
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

// --- Main export ---

function TaskAnalyticsView({ tasks }) {
  const bucketCounts = buildBucketStats(tasks);
  const { labels, counts } = buildWeeklyCompletions(tasks);
  const accuracy = buildEffortAccuracy(tasks);
  const compliance = buildDueDateCompliance(tasks);
  const deferralFreq = buildDeferralFrequency(tasks);
  const totalActive = ACTIVE_BUCKET_KEYS.reduce((s, k) => s + (bucketCounts[k] || 0), 0);
  const totalCompleted = bucketCounts['done'] || 0;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: COLORS.bg }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
          Task Analytics
        </div>
        <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 20 }}>
          {totalActive} active task{totalActive !== 1 ? 's' : ''}· {totalCompleted} completed
        </div>

        <SectionCard title="Active tasks by bucket">
          <BucketChart counts={bucketCounts} />
        </SectionCard>

        <SectionCard title="Completions — last 12 weeks">
          <CompletionChart labels={labels} counts={counts} />
        </SectionCard>

        <SectionCard title="Effort estimate accuracy">
          <EffortAccuracyChart {...accuracy} />
        </SectionCard>

        <SectionCard title="Due date compliance">
          <DueDateComplianceChart {...compliance} />
        </SectionCard>

        <SectionCard title="Deferral frequency">
          <DeferralFrequencyChart {...deferralFreq} />
        </SectionCard>
      </div>
    </div>
  );
}

TaskAnalyticsView.propTypes = {
  tasks: PropTypes.array.isRequired,
};

export { TaskAnalyticsView };
