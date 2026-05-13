import { useState } from "react";
import { COLORS } from "../../constants.jsx";
import { effortToMinutes } from "./taskUtils.jsx";

const FOCUS_COLOR = "#f0c040";

const TIER_KEYS = ['dueToday', 'overdue', 'dueThisWeek', 'noCalEvent'];

function TodaysFocusView({ tasks, calendarEvents, calendarEnabled, onDailyReview, onOpenDetail, tagDisplay, focusExpandedDefaults, onSetFocusExpandedDefaults }) {
  const today8601 = new Date().toISOString().slice(0, 10);
  const focusKey = `gtd-todays-focus-${today8601}`;

  let focusIds = [];
  try {
    const raw = localStorage.getItem(focusKey);
    if (raw) focusIds = JSON.parse(raw)?.ids || [];
  } catch { /* ignore */ }

  const hasFocusToday = focusIds.length > 0;

  const active = tasks.filter(t => !t.done && t.bucket !== 'done' && t.bucket !== 'inboxHistory');

  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEnd8601 = weekEnd.toISOString().slice(0, 10);

  const calEventIds = new Set((calendarEvents || []).map(e => e.id).filter(Boolean));

  const mustAccomplish = active.filter(t => focusIds.includes(t.id));
  const dueToday       = active.filter(t => t.dueDate === today8601 && !focusIds.includes(t.id));
  const overdue        = active.filter(t => t.dueDate && t.dueDate < today8601 && !focusIds.includes(t.id));
  const dueThisWeek    = active.filter(t =>
    t.dueDate && t.dueDate > today8601 && t.dueDate <= weekEnd8601 &&
    effortToMinutes(t.effort) > 60 &&
    !focusIds.includes(t.id) && t.dueDate !== today8601
  );
  const dueDateChildParents = new Set(
    active.filter(t => t.dueDate && t.parentId).map(t => t.parentId)
  );
  const noCalEvent = calendarEnabled
    ? active.filter(t =>
        t.dueDate && !t.calendarEventId &&
        !focusIds.includes(t.id) && t.dueDate !== today8601 &&
        !(t.dueDate < today8601) &&
        !(t.dueDate > today8601 && t.dueDate <= weekEnd8601 && effortToMinutes(t.effort) > 60) &&
        !dueDateChildParents.has(t.id)
      )
    : [];

  const defaults = focusExpandedDefaults || { dueToday: true, overdue: true, dueThisWeek: false, noCalEvent: false };

  // Per-session expanded state — initialised from defaults, changes don't affect saved defaults
  const [expanded, setExpanded] = useState({
    dueToday:    defaults.dueToday,
    overdue:     defaults.overdue,
    dueThisWeek: defaults.dueThisWeek,
    noCalEvent:  defaults.noCalEvent,
  });

  const toggleTier = key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const sortTier = arr => [...arr].sort((a, b) => {
    const dateA = a.dueDate || '9999';
    const dateB = b.dueDate || '9999';
    if (dateA !== dateB) return dateA < dateB ? -1 : 1;
    const timeA = a.dueTime || '23:59';
    const timeB = b.dueTime || '23:59';
    return timeA < timeB ? -1 : 1;
  });

  const totalItems = mustAccomplish.length + dueToday.length + overdue.length + dueThisWeek.length + noCalEvent.length;

  const s = {
    container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: COLORS.bg },
    header: { padding: '16px 20px 12px', borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0 },
    headerTitle: { fontSize: 16, fontWeight: 600, color: FOCUS_COLOR, marginBottom: 4 },
    headerSub: { fontSize: 12, color: COLORS.text2 },
    body: { flex: 1, overflowY: 'auto', padding: '0 0 16px' },
    emptyState: { padding: '40px 20px', textAlign: 'center' },
    emptyText: { fontSize: 14, color: COLORS.text2, marginBottom: 16 },
    startBtn: { background: FOCUS_COLOR, color: '#1a1a0e', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    tierHeader: (isCollapsible) => ({ padding: '10px 20px 6px', fontSize: 10, color: COLORS.text2, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: isCollapsible ? 'pointer' : 'default', userSelect: 'none' }),
    row: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 20px', cursor: 'pointer', borderLeft: '3px solid transparent', transition: 'background 0.1s' },
    rowText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 1.4 },
    badge: (color, bg) => ({ fontSize: 10, color, background: bg, padding: '1px 6px', borderRadius: 8, fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }),
    dot: (color) => ({ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }),
    metaRow: { display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 },
    noItems: { padding: '8px 20px', fontSize: 12, color: COLORS.muted, fontStyle: 'italic' },
  };

  const showInline = tagDisplay === 'inline';
  const showBelow  = !tagDisplay || tagDisplay === 'below';
  const hideTags   = tagDisplay === 'hidden';

  const TaskRowItem = ({ task, dotColor, accentColor }) => {
    const timeLabel = task.dueTime ? ` · ${task.dueTime}` : '';
    const hasMeta = task.effort || (task.location || []).length || task.dueDate || task.dueTime;
    const tags = !hideTags && hasMeta ? (
      <div style={s.metaRow}>
        {task.effort && <span style={s.badge(COLORS.effort, COLORS.effortBg)}>{task.effort}</span>}
        {(task.location || []).map(loc => (
          <span key={loc} style={s.badge(COLORS.text2, COLORS.surface3)}>{loc}</span>
        ))}
        {(task.dueDate || task.dueTime) && (
          <span style={s.badge(accentColor, accentColor + '22')}>{task.dueDate === today8601 ? 'today' : task.dueDate || ''}{timeLabel}</span>
        )}
      </div>
    ) : null;

    return (
      <div
        style={{ ...s.row, borderLeftColor: 'transparent' }}
        onClick={() => onOpenDetail(task.id)}
        onMouseEnter={e => { e.currentTarget.style.background = COLORS.surface2; e.currentTarget.style.borderLeftColor = dotColor; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderLeftColor = 'transparent'; }}
      >
        <div style={s.dot(dotColor)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {showInline && hasMeta ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={s.rowText}>{task.text}</span>
              {tags}
            </div>
          ) : (
            <>
              <div style={s.rowText}>{task.text}</div>
              {showBelow && tags}
            </>
          )}
        </div>
      </div>
    );
  };

  const Tier = ({ label, tierKey, tasks: tierTasks, dotColor, accentColor, alwaysExpanded }) => {
    if (tierTasks.length === 0) return null;
    const isOpen = alwaysExpanded || expanded[tierKey];
    const isCollapsible = !alwaysExpanded;
    return (
      <>
        <div
          style={s.tierHeader(isCollapsible)}
          onClick={isCollapsible ? () => toggleTier(tierKey) : undefined}
        >
          {isCollapsible && <span style={{ fontSize: 9, color: COLORS.muted, marginRight: 2 }}>{isOpen ? '▾' : '▸'}</span>}
          {label}
          <span style={{ fontSize: 9, color: COLORS.muted, fontWeight: 400, opacity: 0.6 }}>[{tierTasks.length} Task{tierTasks.length !== 1 ? 's' : ''}]</span>
        </div>
        {isOpen && sortTier(tierTasks).map(t => (
          <TaskRowItem key={t.id} task={t} dotColor={dotColor} accentColor={accentColor} />
        ))}
      </>
    );
  };

  if (!hasFocusToday && totalItems === 0) {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <div style={s.headerTitle}>📋 Today's Focus</div>
          <div style={s.headerSub}>{today8601}</div>
        </div>
        <div style={s.emptyState}>
          <div style={s.emptyText}>No focus set for today yet.<br />Start your day to define your MUST ACCOMPLISH tasks.</div>
          <button style={s.startBtn} onClick={onDailyReview}>🌅 Start Day</button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.headerTitle}>📋 Today's Focus</div>
        <div style={s.headerSub}>
          {today8601}
          {hasFocusToday
            ? ` · ${mustAccomplish.filter(t => t.done).length}/${mustAccomplish.length} MUST accomplished`
            : ' · No focus set — run Start Day to set your MITs'}
        </div>
      </div>
      <div style={s.body}>
        {hasFocusToday && (
          <Tier label="⭐ Must Accomplish" tierKey={null} tasks={mustAccomplish} dotColor={FOCUS_COLOR} accentColor={FOCUS_COLOR} alwaysExpanded />
        )}
        {!hasFocusToday && (
          <div style={{ padding: '16px 20px 4px' }}>
            <button style={s.startBtn} onClick={onDailyReview}>🌅 Start Day to set focus</button>
          </div>
        )}
        <Tier label="📅 Due Today"              tierKey="dueToday"    tasks={dueToday}     dotColor={COLORS.next}     accentColor={COLORS.next} />
        <Tier label="⚠ Overdue"                 tierKey="overdue"     tasks={overdue}      dotColor="#e05050"          accentColor="#e05050" />
        <Tier label="📆 Due This Week (>1 hr)"  tierKey="dueThisWeek" tasks={dueThisWeek}  dotColor={COLORS.project}  accentColor={COLORS.project} />
        {calendarEnabled && noCalEvent.length > 0 && (
          <Tier label="📆 Due · No Calendar Event" tierKey="noCalEvent" tasks={noCalEvent} dotColor={COLORS.calendar} accentColor={COLORS.calendar} />
        )}
        {totalItems === 0 && !hasFocusToday && (
          <div style={s.noItems}>No upcoming due dates to surface.</div>
        )}
      </div>
    </div>
  );
}

export { TodaysFocusView };
