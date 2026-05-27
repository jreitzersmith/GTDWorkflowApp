import React, { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { COLORS, DEFAULT_EXPORT_TEMPLATES } from '../../constants.jsx';
import { applyTemplate, stripMarkdown } from '../coach/exportUtils.js';

const TEMPLATE_TABS = [
  { key: 'conversation', label: 'Conversation' },
  { key: 'taskList', label: 'Task list' },
  { key: 'hierarchical', label: 'Hierarchical' },
];

const VAR_GROUPS = {
  conversation: [
    { label: 'Identity', vars: ['coachName', 'userName', 'provider'] },
    { label: 'Date & time', vars: ['date', 'time', 'weekNumber'] },
    { label: 'Session', vars: ['mode', 'taskCount', 'messageCount'] },
    { label: 'Content', vars: ['messages'] },
  ],
  taskList: [
    { label: 'Identity', vars: ['userName'] },
    { label: 'Date & time', vars: ['date', 'time', 'weekNumber'] },
    { label: 'Counts', vars: ['totalTasks', 'nextActionCount', 'overdueCount', 'inboxCount'] },
    { label: 'Content', vars: ['sections'] },
  ],
  hierarchical: [
    { label: 'Identity', vars: ['userName'] },
    { label: 'Date & time', vars: ['date', 'time', 'weekNumber'] },
    { label: 'Counts', vars: ['totalTasks', 'projectCount'] },
    { label: 'Content', vars: ['tasks'] },
  ],
};

const SAMPLE_DATA = {
  coachName: 'GTD Coach', userName: 'John', provider: 'Claude',
  date: '2026-05-27', time: '09:15', weekNumber: '22',
  mode: 'Chat', taskCount: '47', messageCount: '8',
  messages: '[conversation messages]',
  totalTasks: '47', nextActionCount: '12', overdueCount: '2', inboxCount: '3',
  sections: '[task sections]', projectCount: '8', tasks: '[project tree]',
};

const TOOLBAR_BUTTONS = [
  { id: 'h1', label: 'H1' },
  { id: 'h2', label: 'H2' },
  { id: 'bold', label: 'B' },
  { id: 'italic', label: 'I' },
  { id: 'underline', label: 'U' },
  { id: 'blockquote', label: '❝' },
  { id: 'bullet', label: '•' },
  { id: 'hr', label: '—' },
];

// Minimal Markdown-to-HTML for inline preview (headings, bold, italic, HR, lists)
function renderMarkdownPreview(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="margin:4px 0">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:4px 0">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:4px 0">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/<u>(.+?)<\/u>/g, '<u>$1</u>')
    .replace(/^---$/gm, '<hr style="border-color:#333530"/>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #404240;margin:2px 0;padding-left:8px;color:#a8a49c">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>');
}

// ── ExportTemplateEditor ─────────────────────────────────────────────────────
// Per-tab template editor with formatting toolbar, variable chips, and
// format-aware live preview. FR#119.
function ExportTemplateEditor({ exportTemplates, onExportTemplatesChange, exportFormat }) {
  const [activeTab, setActiveTab] = useState('conversation');
  const [previewOn, setPreviewOn] = useState(false);
  const textareaRef = useRef(null);

  const currentTemplate = exportTemplates[activeTab] || DEFAULT_EXPORT_TEMPLATES[activeTab];

  const handleChange = useCallback((value) => {
    onExportTemplatesChange({ ...exportTemplates, [activeTab]: value });
  }, [exportTemplates, activeTab, onExportTemplatesChange]);

  const insertAtCursor = useCallback((insertion) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = currentTemplate.slice(0, start) + insertion + currentTemplate.slice(end);
    handleChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + insertion.length;
      ta.setSelectionRange(pos, pos);
    });
  }, [currentTemplate, handleChange]);

  const insertFormatting = useCallback((type) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = currentTemplate.slice(start, end);
    const map = {
      h1: `# ${sel || 'Heading 1'}`,
      h2: `## ${sel || 'Heading 2'}`,
      bold: `**${sel || 'bold'}**`,
      italic: `*${sel || 'italic'}*`,
      underline: `<u>${sel || 'underline'}</u>`,
      blockquote: `> ${sel || 'quote'}`,
      bullet: `- ${sel || 'item'}`,
      hr: '\n\n---\n\n',
    };
    const ins = map[type];
    if (!ins) return;
    const newValue = currentTemplate.slice(0, start) + ins + currentTemplate.slice(end);
    handleChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + ins.length, start + ins.length);
    });
  }, [currentTemplate, handleChange]);

  const handleReset = useCallback(() => {
    onExportTemplatesChange({ ...exportTemplates, [activeTab]: DEFAULT_EXPORT_TEMPLATES[activeTab] });
  }, [exportTemplates, activeTab, onExportTemplatesChange]);

  const previewContent = previewOn
    ? (() => {
        const applied = applyTemplate(currentTemplate, SAMPLE_DATA);
        return exportFormat === 'text' ? stripMarkdown(applied) : applied;
      })()
    : null;

  const s = {
    container: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 },
    tabs: { display: 'flex', gap: 4 },
    tab: (active) => ({
      padding: '4px 12px',
      background: active ? COLORS.surface3 : 'transparent',
      border: `1px solid ${active ? COLORS.border2 : COLORS.border}`,
      borderRadius: 4,
      color: active ? COLORS.text : COLORS.text2,
      cursor: 'pointer',
      fontSize: 12,
    }),
    toolbar: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' },
    toolbarBtn: (id) => ({
      padding: '3px 8px',
      background: COLORS.surface2,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 4,
      color: COLORS.text,
      cursor: 'pointer',
      fontSize: 12,
      fontFamily: 'inherit',
      minWidth: 28,
      fontWeight: id === 'bold' ? 'bold' : 'normal',
      fontStyle: id === 'italic' ? 'italic' : 'normal',
    }),
    toolbarSep: { width: 1, height: 18, background: COLORS.border, margin: '0 2px' },
    previewToggle: (active) => ({
      padding: '3px 10px',
      background: active ? COLORS.project + '33' : COLORS.surface2,
      border: `1px solid ${active ? COLORS.project : COLORS.border}`,
      borderRadius: 4,
      color: active ? COLORS.project : COLORS.text2,
      cursor: 'pointer',
      fontSize: 12,
      marginLeft: 'auto',
    }),
    textarea: {
      width: '100%', minHeight: 120,
      background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, color: COLORS.text, padding: '8px 10px',
      fontSize: 12, fontFamily: 'monospace', resize: 'vertical',
      boxSizing: 'border-box', lineHeight: 1.5,
    },
    previewBadge: {
      fontSize: 10, color: COLORS.text2, background: COLORS.surface3,
      border: `1px solid ${COLORS.border}`, borderRadius: 10,
      padding: '2px 8px', alignSelf: 'flex-start',
    },
    previewBox: {
      background: COLORS.surface2, border: `1px solid ${COLORS.border}`,
      borderRadius: 4, padding: '8px 10px',
      fontSize: 12, color: COLORS.text, minHeight: 80, lineHeight: 1.6,
    },
    varSection: { display: 'flex', flexDirection: 'column', gap: 6 },
    varGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
    varGroupLabel: { fontSize: 10, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' },
    varChips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
    chip: {
      padding: '2px 8px', background: COLORS.surface3,
      border: `1px solid ${COLORS.border}`, borderRadius: 10,
      color: COLORS.text2, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
    },
    footer: { display: 'flex', justifyContent: 'flex-end' },
    resetBtn: {
      background: 'transparent', border: `1px solid ${COLORS.border}`,
      borderRadius: 4, color: COLORS.text2, cursor: 'pointer',
      fontSize: 11, padding: '3px 10px',
    },
  };

  return (
    <div style={s.container}>
      {/* Tab row */}
      <div style={s.tabs}>
        {TEMPLATE_TABS.map(tab => (
          <button key={tab.key} style={s.tab(activeTab === tab.key)}
            onClick={() => { setActiveTab(tab.key); setPreviewOn(false); }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        {TOOLBAR_BUTTONS.map(btn => (
          <button key={btn.id} style={s.toolbarBtn(btn.id)}
            onClick={() => insertFormatting(btn.id)} title={btn.id}>
            {btn.label}
          </button>
        ))}
        <div style={s.toolbarSep} />
        <button style={s.previewToggle(previewOn)} onClick={() => setPreviewOn(p => !p)}>
          {previewOn ? 'Edit' : 'Preview'}
        </button>
      </div>

      {/* Editor or preview */}
      {previewOn ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={s.previewBadge}>Previewing as {exportFormat || 'rtf'}</span>
          {exportFormat === 'text' ? (
            <pre style={{ ...s.previewBox, fontFamily: 'monospace', whiteSpace: 'pre-wrap', margin: 0 }}>
              {previewContent}
            </pre>
          ) : (
            <div style={s.previewBox}
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(previewContent || '') }} />
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          style={s.textarea}
          value={currentTemplate}
          onChange={e => handleChange(e.target.value)}
          spellCheck={false}
        />
      )}

      {/* Variable chips */}
      <div style={s.varSection}>
        {(VAR_GROUPS[activeTab] || []).map(group => (
          <div key={group.label} style={s.varGroup}>
            <span style={s.varGroupLabel}>{group.label}</span>
            <div style={s.varChips}>
              {group.vars.map(v => (
                <button key={v} style={s.chip}
                  onClick={() => insertAtCursor(`{{${v}}}`)}
                  title={`Insert {{${v}}}`}>
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={s.footer}>
        <button style={s.resetBtn} onClick={handleReset}>↺ Reset to default</button>
      </div>
    </div>
  );
}

ExportTemplateEditor.propTypes = {
  exportTemplates: PropTypes.object.isRequired,
  onExportTemplatesChange: PropTypes.func.isRequired,
  exportFormat: PropTypes.string,
};

export default ExportTemplateEditor;
