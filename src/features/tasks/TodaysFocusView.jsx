import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../../constants.jsx";
import { useViewport } from "../../hooks/useViewport.js";
import { effortToMinutes } from "./taskUtils.jsx";
import { buildFocusViewExportContent, buildFocusViewJsonExport, buildRtfContent, stripMarkdown, saveToDrive, downloadText } from "../coach/exportUtils.js";

const FOCUS_COLOR = "#f0c040";

const FOCUS_FORMAT_OPTIONS = [
  { value: 'rtf',      shortLabel: 'Rich text'  },
  { value: 'markdown', shortLabel: 'Markdown'   },
  { value: 'text',     shortLabel: 'Plain text' },
  { value: 'json',     shortLabel: 'JSON'       },
];
const FOCUS_INCLUDE_OPTIONS = [
  { key: 'header',   label: 'Export header'        },
  { key: 'metadata', label: 'Dates, effort & tags'  },
  { key: 'notes',    label: 'Task notes'            },
];

// tiers: [{ label, tasks }] — only the sections visible in the view
function FocusExportPopover({ tiers, googleToken, docsEnabled, driveConversationExportFolderId }) {
  const { isPhone } = useViewport();
  const [open, setOpen]       = useState(false);
  const [fmt, setFmt]         = useState('rtf');
  const [include, setInclude] = useState({ header: true, metadata: true, notes: false });
  const [status, setStatus]   = useState('idle');
  const [driveUrl, setDriveUrl] = useState(null);
  const [errMsg, setErrMsg]   = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggleInclude = key => setInclude(prev => ({ ...prev, [key]: !prev[key] }));
  const handleOpen = () => { setOpen(o => !o); setStatus('idle'); setDriveUrl(null); setErrMsg(null); };

  const getContent = useCallback(() => {
    if (fmt === 'json') return buildFocusViewJsonExport(tiers, include);
    return buildFocusViewExportContent(tiers, include);
  }, [tiers, include, fmt]);

  const handleDownload = useCallback(() => {
    setStatus('downloading'); setDriveUrl(null); setErrMsg(null);
    try {
      const title = 'GTD-Focus-' + new Date().toISOString().slice(0, 10);
      const raw = getContent();
      if (fmt === 'rtf')           downloadText(buildRtfContent(raw), title + '.rtf',  'application/rtf');
      else if (fmt === 'markdown') downloadText(raw,                  title + '.md',   'text/markdown');
      else if (fmt === 'json')     downloadText(raw,                  title + '.json', 'application/json');
      else                         downloadText(stripMarkdown(raw),   title + '.txt',  'text/plain');
      setStatus('downloaded');
    } catch (err) { setErrMsg(err.message || 'Download failed'); setStatus('error'); }
  }, [getContent, fmt]);

  const handleSaveToDrive = useCallback(async () => {
    if (!googleToken || !docsEnabled) {
      setErrMsg('Google Docs is not connected. Connect Docs in Settings › Google Services.');
      setStatus('error'); return;
    }
    setStatus('saving'); setDriveUrl(null); setErrMsg(null);
    try {
      const title = 'GTD-Focus-' + new Date().toISOString().slice(0, 10);
      const url = await saveToDrive({ markdownText: getContent(), googleToken, title, format: fmt === 'json' ? 'text' : fmt, driveConversationExportFolderId });
      setDriveUrl(url); setStatus('saved');
    } catch (err) { setErrMsg(err.message || 'Save to Drive failed'); setStatus('error'); }
  }, [getContent, fmt, googleToken, docsEnabled, driveConversationExportFolderId]);

  const busy = status === 'downloading' || status === 'saving';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button onClick={handleOpen} title="Export today's focus"
        style={{ background: 'transparent', border: '0.5px solid ' + COLORS.border2, borderRadius: 6,
          padding: '3px 8px', fontFamily: 'inherit', fontSize: 12, color: COLORS.text2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 3 }}>
        Export
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: COLORS.surface2,
          border: '1px solid ' + COLORS.border2, borderRadius: 8, padding: 14, zIndex: 60, width: isPhone ? 'min(240px, calc(100vw - 32px))' : 240,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Export today's focus</div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Format</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
            {FOCUS_FORMAT_OPTIONS.map(({ value, shortLabel }) => (
              <button key={value} onClick={() => setFmt(value)}
                style={{ padding: '4px 0', borderRadius: 5, fontFamily: 'inherit', fontSize: 10, cursor: 'pointer',
                  border: '0.5px solid ' + (fmt === value ? COLORS.next : COLORS.border2),
                  background: fmt === value ? COLORS.next + '22' : 'transparent',
                  color: fmt === value ? COLORS.next : COLORS.text2,
                  fontWeight: fmt === value ? 600 : 400 }}>
                {shortLabel}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Include</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {FOCUS_INCLUDE_OPTIONS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!include[key]} onChange={() => toggleInclude(key)}
                  style={{ accentColor: COLORS.next, width: 13, height: 13, flexShrink: 0 }} />
                {label}
              </label>
            ))}
          </div>
          {status === 'downloaded' && <div style={{ fontSize: 11, color: COLORS.next, marginBottom: 8 }}>Downloaded successfully.</div>}
          {status === 'saved' && driveUrl && (
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <a href={driveUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.next, textDecoration: 'none' }}>View in Google Docs &#x2197;</a>
            </div>
          )}
          {status === 'error' && <div style={{ fontSize: 11, color: COLORS.waiting, marginBottom: 8, lineHeight: 1.4 }}>{errMsg}</div>}
          <button onClick={handleDownload} disabled={busy}
            style={{ width: '100%', padding: '6px 0', borderRadius: 6, border: 'none', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', marginBottom: docsEnabled ? 6 : 0,
              background: busy ? COLORS.surface3 : COLORS.next, color: busy ? COLORS.muted : '#111' }}>
            {status === 'downloading' ? 'Downloading…' : 'Download'}
          </button>
          {docsEnabled && (
            <button onClick={handleSaveToDrive} disabled={busy}
              style={{ width: '100%', padding: '6px 0', borderRadius: 6, border: '0.5px solid ' + COLORS.border2,
                background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                cursor: busy ? 'not-allowed' : 'pointer', color: busy ? COLORS.muted : COLORS.text2 }}>
              {status === 'saving' ? 'Saving…' : 'Save to Drive'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const TIER_KEYS = ['dueToday', 'overdue', 'dueThisWeek', 'noCalEvent'];

function TodaysFocusView({ tasks, calendarEvents, calendarEnabled, onDailyReview, onOpenDetail, tagDisplay, focusExpandedDefaults, onSetFocusExpandedDefaults, googleToken, docsEnabled, driveConversationExportFolderId }) {
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

  // Tiers passed to FocusExportPopover — only sections with items, matching the view
  const focusTiers = [
    ...(mustAccomplish.length > 0 ? [{ label: '⭐ Must Accomplish', tasks: mustAccomplish }] : []),
    ...(dueToday.length    > 0 ? [{ label: '📅 Due Today',              tasks: dueToday    }] : []),
    ...(overdue.length     > 0 ? [{ label: '⚠ Overdue',                 tasks: overdue     }] : []),
    ...(dueThisWeek.length > 0 ? [{ label: '📆 Due This Week (>1hr)',    tasks: dueThisWeek }] : []),
    ...(noCalEvent.length  > 0 ? [{ label: '📆 Due · No Calendar Event', tasks: noCalEvent  }] : []),
  ];

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
          <span style={{ fontSize: 9, color: COLORS.text2, fontWeight: 400 }}>[{tierTasks.length} Task{tierTasks.length !== 1 ? 's' : ''}]</span>
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
      <div style={{ ...s.header, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={s.headerTitle}>📋 Today's Focus</div>
          <div style={s.headerSub}>
            {today8601}
            {hasFocusToday
              ? ` · ${mustAccomplish.filter(t => t.done).length}/${mustAccomplish.length} MUST accomplished`
              : ' · No focus set — run Start Day to set your MITs'}
          </div>
        </div>
        <FocusExportPopover tiers={focusTiers} googleToken={googleToken} docsEnabled={docsEnabled} driveConversationExportFolderId={driveConversationExportFolderId} />
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
