import PropTypes from 'prop-types';
import { useState, useRef, useEffect, useCallback } from 'react';
import { COLORS } from '../../constants.jsx';
import { buildExportContent, exportToGoogleDocs, downloadText, buildExportTitle } from './exportUtils.js';

const FORMAT_OPTIONS = [
  { value: 'docs',     label: 'Google Docs',      shortLabel: 'Google Docs' },
  { value: 'markdown', label: 'Markdown (.md)',    shortLabel: 'Markdown' },
  { value: 'text',     label: 'Plain text (.txt)', shortLabel: 'Plain text' },
];

const INCLUDE_OPTIONS = [
  { key: 'userMessages', label: 'User messages' },
  { key: 'aiResponses',  label: 'AI responses' },
  { key: 'toolChips',    label: 'Tool & search activity' },
  { key: 'metadata',     label: 'Session metadata' },
];

function ExportPopover({ messages, coachMode, tasks, exportSettings, googleToken, docsEnabled }) {
  const [open, setOpen]               = useState(false);
  const [status, setStatus]           = useState('idle'); // 'idle' | 'loading' | 'done' | 'error'
  const [docUrl, setDocUrl]           = useState(null);
  const [errMsg, setErrMsg]           = useState(null);
  const [localFormat, setLocalFormat]   = useState(exportSettings.format);
  const [localInclude, setLocalInclude] = useState(exportSettings.include);
  const ref = useRef(null);

  // Sync local state when exportSettings changes externally (Settings panel update).
  useEffect(() => {
    setLocalFormat(exportSettings.format);
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
    setDocUrl(null);
    setErrMsg(null);
  };

  const handleExport = useCallback(async () => {
    setStatus('loading');
    setDocUrl(null);
    setErrMsg(null);
    const markdownText = buildExportContent(messages, localInclude, coachMode, tasks);
    const title = buildExportTitle(coachMode);
    const format = localFormat;
    try {
      if (format === 'docs') {
        if (!googleToken || !docsEnabled) {
          throw new Error('Google Docs is not connected. Connect Docs in Settings > Google Services.');
        }
        const url = await exportToGoogleDocs({ markdownText, googleToken, title });
        setDocUrl(url);
      } else if (format === 'markdown') {
        downloadText(markdownText, title + '.md', 'text/markdown');
      } else {
        const plain = markdownText
          .replace(/\*\*([^*]+)\*\*/g, '$1')
          .replace(/\*([^*]+)\*/g, '$1')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/^>\s*/gm, '')
          .replace(/^---$/gm, '');
        downloadText(plain, title + '.txt', 'text/plain');
      }
      setStatus('done');
    } catch (err) {
      setErrMsg(err.message || 'Export failed');
      setStatus('error');
    }
  }, [messages, localInclude, coachMode, tasks, localFormat, googleToken, docsEnabled]);

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
          width: 230,
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Export conversation</div>

          {/* Format selector */}
          <div style={{ fontSize: 11, color: COLORS.text2, marginBottom: 6 }}>Format</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
            {FORMAT_OPTIONS.map(({ value, shortLabel }) => (
              <button
                key={value}
                onClick={() => setLocalFormat(value)}
                style={{
                  flex: 1,
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
          </div>

          {/* Status feedback */}
          {status === 'done' && !docUrl && (
            <div style={{ fontSize: 11, color: COLORS.next, marginBottom: 8 }}>Downloaded successfully.</div>
          )}
          {status === 'done' && docUrl && (
            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <a href={docUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.next, textDecoration: 'none' }}>
                View in Google Docs &uarr;
              </a>
            </div>
          )}
          {status === 'error' && (
            <div style={{ fontSize: 11, color: COLORS.waiting, marginBottom: 8, lineHeight: 1.4 }}>{errMsg}</div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={status === 'loading'}
            style={{
              width: '100%',
              padding: '6px 0',
              borderRadius: 6,
              border: 'none',
              background: status === 'loading' ? COLORS.surface3 : COLORS.next,
              color: status === 'loading' ? COLORS.muted : '#111',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Exporting…' : 'Export'}
          </button>
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
  googleToken:            PropTypes.string,
  docsEnabled:            PropTypes.bool,
};

export { ExportPopover };
