import PropTypes from 'prop-types';
import { COLORS, BUCKETS } from '../../constants.jsx';
import { effortToMinutes } from './taskUtils.jsx';

// --- Pure data functions ---

function buildBucketStats(tasks) {
  const counts = {};
  for (const key of Object.keys(BUCKETS)) counts[key] = 0;
  for (const t of tasks) {
    if (t.bucket in counts) counts[t.bucket]++;
  }
  return counts;
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

// --- Main export ---

function TaskAnalyticsView({ tasks }) {
  const bucketCounts = buildBucketStats(tasks);
  const { labels, counts } = buildWeeklyCompletions(tasks);
  const accuracy = buildEffortAccuracy(tasks);
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
      </div>
    </div>
  );
}

TaskAnalyticsView.propTypes = {
  tasks: PropTypes.array.isRequired,
};

export { TaskAnalyticsView };
