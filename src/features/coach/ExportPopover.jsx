import PropTypes from 'prop-types';
import { useState, useRef, useEffect, useCallback } from 'react';
import { COLORS } from '../../constants.jsx';
import { buildExportContent, buildRtfContent, stripMarkdown, saveToDrive, downloadText, buildExportTitle, buildJsonExport, buildHierarchicalExportContent, buildHierarchicalJsonExport } from './exportUtils.js';

// Format options: Rich Text | Markdown | Plain text
// Download delivers the native file type; Save to Drive always creates a Google Doc.
const FORMAT_OPTIONS = [
  { value: 'rtf',      label: 'Rich Text (.rtf)',    shortLabel: 'Rich text' },
  { value: 'markdown', label: 'Markdown (.md)',       shortLabel: 'Markdown' },
  { value: 'text',     label: 'Plain text (.txt)',    shortLabel: 'Plain text' },
  { value: 'json',     label: 'JSON (.json)',         shortLabel: 'JSON' },
];

const INCLUDE_OPTIONS = [
  { key: 'userMessages', label: 'User messages' },
  { key: 'aiResponses',  label: 'AI responses' },
  { key: 'toolChips',    label: 'Tool & search activity' },
  { key: 'metadata',     label: 'Session metadata' },
];
// apiThread option only shown when format === 'json'
const API_THREAD_OPTION = { key: 'apiThread', label: 'Raw API tool calls' };

// Migrate a stored format value of 'docs' (old default) to 'rtf'.
function resolveFormat(fmt) {
  return (!fmt || fmt === 'docs') ? 'rtf' : fmt;
}

function ExportPopover({ messages, coachMode, tasks, exportSettings, onExportSettingsChange, googleToken, docsEnabled, driveConversationExportFolderId, rawApiThread, coachName, userName, exportTemplates }) {
  const [open, setOpen]               = useState(false);
  // status: 'idle' | 'downloading' | 'saving' | 'downloaded' | 'saved' | 'error'
  const [status, setStatus]           = useState('idle');
  const [driveUrl, setDriveUrl]       = useState(null);
  const [errMsg, setErrMsg]           = useState(null);
  const [localFormat, setLocalFormat] = useState(() => resolveFormat(exportSettings.format));
  const [localInclude, setLocalInclude] = useState(exportSettings.include);
  const ref = useRef(null);

  // Sync local state when exportSettings changes externally (Settings panel update).
  useEffect(() => {
    setLocalFormat(resolveFormat(exportSettings.format));
  }, [exportSettings.format]);
  useEffect(() => {
    setLocalInclude(exportSettings.include);
  }, [exportSettings.include]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = useCallback(key => {
    setLocalInclude(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    setStatus('idle');
    setDriveUrl(null);
    setErrMsg(null);
  };

  const handleDownload = useCallback(() => {
    setStatus('downloading');
    setDriveUrl(null);
    setErrMsg(null);
    try {
      const title = buildExportTitle(coachMode, coachName);
      if (localFormat === 'json') {
        const jsonText = buildJsonExport({ rawApiThread: rawApiThread || [], messages, include: localInclude, coachMode, tasks, coachName, userName });
        downloadText(jsonText, title + '.json', 'application/json');
      } else {
        const markdownText = buildExportContent(messages, localInclude, coachMode, tasks, { coachName, userName, template: (exportTemplates || {}).conversation, messageRowTemplate: (exportTemplates || {}).messageRowTemplate });
        if (localFormat === 'rtf') {
          downloadText(buildRtfContent(markdownText), title + '.rtf', 'application/rtf');
        } else if (localFormat === 'markdown') {
          downloadText(markdownText, title + '.md', 'text/markdown');
        } else {
          downloadText(stripMarkdown(markdownText), title + '.txt', 'text/plain');
        }
      }
      setStatus('downloaded');
    } catch (err) {
      setErrMsg(err.message || 'Download failed');
      setStatus('error');
    }
  }, [messages, localInclude, coachMode, tasks, localFormat, rawApiThread, exportTemplates]);

  const handleSaveToDrive = useCallback(async () => {
    if (!googleToken || !docsEnabled) {
      setErrMsg('Google Docs is not connected. Connect Docs in Settings › Google Services.');
      setStatus('error');
      return;
    }
    setStatus('saving');
    setDriveUrl(null);
    setErrMsg(null);
    try {
      const title = buildExportTitle(coachMode, coachName);
      const exportText = localFormat === 'json'
        ? buildJsonExport({ rawApiThread: rawApiThread || [], messages, include: localInclude, coachMode, tasks, coachName, userName })
        : buildExportContent(messages, localInclude, coachMode, tasks, { coachName, userName, template: (exportTemplates || {}).conversation, messageRowTemplate: (exportTemplates || {}).messageRowTemplate });
      const url = await saveToDrive({ markdownText: exportText, googleToken, title, format: localFormat === 'json' ? 'text' : localFormat, driveConversationExportFolderId });
      setDriveUrl(url);
      setStatus('saved');
    } catch (err) {
      setErrMsg(err.message || 'Save to Drive failed');
      setStatus('error');
    }
  }, [messages, localInclude, coachMode, tasks, localFormat, googleToken, docsEnabled, driveConversationExportFolderId, rawApiThread, exportTemplates]);

  const busy = status === 'downloading' || status === 'saving';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={handleOpen}
        title="Export conversation"
        style={{
          background: 'transparent',
          border: '0.5px solid ' + COLORS.border2,
          borderRadius: 6,
          padding: '3px 8px',
          fontFamily: 'inherit',
          fontSize: 12,
          color: COLORS.text2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        Export
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: COLORS.surface2,
          border: '1px solid ' + COLORS.border2,
          borderRadius: 8,
          padding: 14,
          zIndex: 60,
          width: 240,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Export conversation</div>

          {/* Format selector */}
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Format</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
            {FORMAT_OPTIONS.map(({ value, shortLabel }) => (
              <button
                key={value}
                onClick={() => setLocalFormat(value)}
                style={{
                  padding: '4px 0',
                  borderRadius: 5,
                  border: '0.5px solid ' + (localFormat === value ? COLORS.next : COLORS.border2),
                  background: localFormat === value ? COLORS.next + '22' : 'transparent',
                  color: localFormat === value ? COLORS.next : COLORS.text2,
                  fontFamily: 'inherit',
                  fontSize: 10,
                  fontWeight: localFormat === value ? 600 : 400,
                  cursor: 'pointer',
                }}
              >{shortLabel}</button>
            ))}
          </div>

          {/* Content checkboxes */}
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Include</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {INCLUDE_OPTIONS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!localInclude[key]}
                  onChange={() => handleToggle(key)}
                  style={{ accentColor: COLORS.next, width: 13, height: 13, flexShrink: 0 }}
                />
                {label}
              </label>
            ))}
            {localFormat === 'json' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: (rawApiThread && rawApiThread.length > 0) ? COLORS.text : COLORS.muted, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!localInclude[API_THREAD_OPTION.key]}
                  onChange={() => handleToggle(API_THREAD_OPTION.key)}
                  style={{ accentColor: COLORS.next, width: 13, height: 13, flexShrink: 0 }}
                />
                {API_THREAD_OPTION.label}{rawApiThread && rawApiThread.length === 0 ? ' (none this session)' : ''}
              </label>
            )}
          </div>

          {/* Status feedback */}
          {status === 'downloaded' && (
            <div style={{ fontSize: 11, color: COLORS.next, marginBottom: 8 }}>Downloaded successfully.</div>
          )}
          {status === 'saved' && driveUrl && (
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <a href={driveUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.next, textDecoration: 'none' }}>
                View in Google Docs &#x2197;
              </a>
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontSize: 11, color: COLORS.waiting, marginBottom: 8, lineHeight: 1.4 }}>{errMsg}</div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={busy}
            style={{
              width: '100%',
              padding: '6px 0',
              borderRadius: 6,
              border: 'none',
              background: busy ? COLORS.surface3 : COLORS.next,
              color: busy ? COLORS.muted : '#111',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              marginBottom: docsEnabled ? 6 : 0,
            }}
          >
            {status === 'downloading' ? 'Downloading…' : 'Download'}
          </button>

          {/* Save to Drive button — only shown when Docs is connected */}
          {docsEnabled && (
            <button
              onClick={handleSaveToDrive}
              disabled={busy}
              style={{
                width: '100%',
                padding: '6px 0',
                borderRadius: 6,
                border: '0.5px solid ' + COLORS.border2,
                background: 'transparent',
                color: busy ? COLORS.muted : COLORS.text2,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 500,
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {status === 'saving' ? 'Saving…' : 'Save to Drive'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task List export popover (used by Projects bucket view) ──────────────────
const TASK_FORMAT_OPTIONS = [
  { value: 'rtf',      shortLabel: 'Rich text'  },
  { value: 'markdown', shortLabel: 'Markdown'   },
  { value: 'text',     shortLabel: 'Plain text' },
  { value: 'json',     shortLabel: 'JSON'       },
];
const SECTION_OPTIONS = [
  { key: 'project',  label: 'Project structure' },
  { key: 'next',     label: 'Next Actions'      },
  { key: 'waiting',  label: 'Waiting For'       },
  { key: 'someday',  label: 'Someday / Maybe'   },
  { key: 'deferred', label: 'Deferred'          },
];
const TASK_INCLUDE_OPTIONS = [
  { key: 'header',   label: 'Export header'       },
  { key: 'metadata', label: 'Dates, effort & tags' },
  { key: 'notes',    label: 'Task notes'           },
];

function TaskListExportPopover({ tasks, googleToken, docsEnabled, driveConversationExportFolderId, defaultSections, exportTemplates }) {
  const [open, setOpen]       = useState(false);
  const [fmt, setFmt]         = useState('rtf');
  const [include, setInclude] = useState({ header: true, metadata: true, notes: false });
  const [sections, setSections] = useState(defaultSections ?? { project: true, next: true, waiting: false, someday: false, deferred: false });
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
  const toggleSection = key => setSections(prev => ({ ...prev, [key]: !prev[key] }));
  const handleOpen = () => { setOpen(o => !o); setStatus('idle'); setDriveUrl(null); setErrMsg(null); };

  const getContent = useCallback(() => {
    if (fmt === 'json') return buildHierarchicalJsonExport(tasks, sections, include);
    return buildHierarchicalExportContent(tasks, sections, include, (exportTemplates || {}).hierarchical, { taskRowTemplate: (exportTemplates || {}).taskRowTemplate, indentUnit: (exportTemplates || {}).indentUnit });
  }, [tasks, sections, include, fmt, exportTemplates]);

  const handleDownload = useCallback(() => {
    setStatus('downloading'); setDriveUrl(null); setErrMsg(null);
    try {
      const title = 'GTD-Task-List-' + new Date().toISOString().slice(0, 10);
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
      const title = 'GTD-Task-List-' + new Date().toISOString().slice(0, 10);
      const url = await saveToDrive({ markdownText: getContent(), googleToken, title, format: fmt === 'json' ? 'text' : fmt, driveConversationExportFolderId });
      setDriveUrl(url); setStatus('saved');
    } catch (err) { setErrMsg(err.message || 'Save to Drive failed'); setStatus('error'); }
  }, [getContent, fmt, googleToken, docsEnabled, driveConversationExportFolderId]);

  const busy = status === 'downloading' || status === 'saving';

  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button onClick={handleOpen} title="Export task list"
        style={{ background: 'transparent', border: '0.5px solid ' + COLORS.border2, borderRadius: 6,
          padding: '3px 8px', fontFamily: 'inherit', fontSize: 12, color: COLORS.text2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 3 }}>
        Export
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: COLORS.surface2,
          border: '1px solid ' + COLORS.border2, borderRadius: 8, padding: 14, zIndex: 60, width: 240,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Export task list</div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Format</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 12 }}>
            {TASK_FORMAT_OPTIONS.map(({ value, shortLabel }) => (
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
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Sections</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {SECTION_OPTIONS.map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!sections[key]} onChange={() => toggleSection(key)}
                  style={{ accentColor: COLORS.next, width: 13, height: 13, flexShrink: 0 }} />
                {label}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Include</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
            {TASK_INCLUDE_OPTIONS.map(({ key, label }) => (
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

ExportPopover.propTypes = {
  messages:               PropTypes.array.isRequired,
  coachMode:              PropTypes.string.isRequired,
  tasks:                  PropTypes.array.isRequired,
  exportSettings:         PropTypes.object.isRequired,
  onExportSettingsChange: PropTypes.func,
  googleToken:            PropTypes.string,
  docsEnabled:            PropTypes.bool,
  driveConversationExportFolderId:    PropTypes.string,
  rawApiThread:           PropTypes.array,
  coachName:              PropTypes.string,
  userName:               PropTypes.string,
  exportTemplates:        PropTypes.object,
};

TaskListExportPopover.propTypes = {
  tasks:                           PropTypes.array.isRequired,
  googleToken:                     PropTypes.string,
  docsEnabled:                     PropTypes.bool,
  driveConversationExportFolderId: PropTypes.string,
  defaultSections:                 PropTypes.object,
  exportTemplates:                 PropTypes.object,
};

export { ExportPopover, TaskListExportPopover };
