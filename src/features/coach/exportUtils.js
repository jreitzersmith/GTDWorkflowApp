import { docsCreateDocument, docsAppendText, docsAppendMarkdown, docsMoveToFolder } from '../../api/docsApi.js';
import { COACH_MODES } from '../../constants.jsx';

// Build a human-readable markdown string from the messages array.
// include: { userMessages, aiResponses, toolChips, metadata }
function buildExportContent(messages, include, coachMode, tasks, { coachName, userName } = {}) {
  const modeLabel = (COACH_MODES[coachMode] || {}).label || coachMode;
  const lines = [];

  if (include.metadata) {
    const now = new Date();
    lines.push('# ' + (coachName || 'GTD Coach') + ' Export');
    lines.push('');
    lines.push('**Date:** ' + now.toLocaleString());
    lines.push('**Mode:** ' + modeLabel);
    if (Array.isArray(tasks)) lines.push('**Tasks in system:** ' + tasks.length);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  for (const msg of messages) {
    if (msg.isSearchChip) {
      if (!include.toolChips) continue;
      lines.push('> *' + (msg.text || '') + '*');
      lines.push('');
      continue;
    }
    if (msg.role === 'user') {
      if (!include.userMessages) continue;
      lines.push('**' + (userName || 'You') + ':** ' + (msg.text || ''));
      lines.push('');
    } else if (msg.role === 'assistant') {
      if (!include.aiResponses) continue;
      lines.push('**' + (coachName || 'Coach') + ':** ' + (msg.text || ''));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Convert a markdown string to RTF for browser download.
// Supports: headings (h1-h3), bold, italic, blockquotes, horizontal rules.
function buildRtfContent(markdownText) {
  function escRtf(s) {
    return s.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  }
  function applyInline(s) {
    s = escRtf(s);
    s = s.replace(/\*\*([^*]+)\*\*/g, '{\\b $1}');
    s = s.replace(/\*([^*]+)\*/g, '{\\i $1}');
    return s;
  }

  const rtfLines = [];
  for (const raw of markdownText.split('\n')) {
    let m;
    if ((m = raw.match(/^###\s+(.+)/))) {
      rtfLines.push('{\\b\\fs26 ' + applyInline(m[1]) + '}\\par');
    } else if ((m = raw.match(/^##\s+(.+)/))) {
      rtfLines.push('{\\b\\fs28 ' + applyInline(m[1]) + '}\\par');
    } else if ((m = raw.match(/^#\s+(.+)/))) {
      rtfLines.push('{\\b\\fs32 ' + applyInline(m[1]) + '}\\par');
    } else if ((m = raw.match(/^>\s*(.*)/))) {
      rtfLines.push('\\li720 ' + applyInline(m[1]) + '\\li0\\par');
    } else if (/^---+$/.test(raw.trim())) {
      rtfLines.push('\\par');
    } else if (!raw.trim()) {
      rtfLines.push('\\par');
    } else {
      rtfLines.push(applyInline(raw) + '\\par');
    }
  }

  return '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\\f0\\fs24\\pard\n' + rtfLines.join('\n') + '\n}';
}

// Strip markdown symbols to produce plain text.
function stripMarkdown(markdownText) {
  return markdownText
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^---$/gm, '');
}

// Create a new Google Doc and append content formatted for Drive.
// format: 'rtf' -> native Docs formatting (docsAppendMarkdown)
//         'markdown' -> raw markdown text (docsAppendText)
//         'text' -> stripped plain text (docsAppendText)
// Returns the doc URL on success.
async function saveToDrive({ markdownText, googleToken, title, format, driveConversationExportFolderId }) {
  const doc = await docsCreateDocument({ token: googleToken, title });
  if (markdownText.trim()) {
    if (format === 'rtf') {
      await docsAppendMarkdown({ token: googleToken, documentId: doc.documentId, markdownText });
    } else if (format === 'markdown') {
      await docsAppendText({ token: googleToken, documentId: doc.documentId, text: markdownText });
    } else {
      await docsAppendText({ token: googleToken, documentId: doc.documentId, text: stripMarkdown(markdownText) });
    }
  }
  if (driveConversationExportFolderId) {
    await docsMoveToFolder({ token: googleToken, documentId: doc.documentId, newParentId: driveConversationExportFolderId });
  }
  return 'https://docs.google.com/document/d/' + doc.documentId + '/edit';
}

// Trigger a browser file download for any text content.
function downloadText(text, filename, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Build a human-readable document title from the coach mode and today's date.
function buildExportTitle(coachMode, coachName) {
  const modeLabel = (COACH_MODES[coachMode] || {}).label || 'Chat';
  const today = new Date().toISOString().slice(0, 10);
  return (coachName || 'GTD Coach') + ' \u2014 ' + modeLabel + ' \u2014 ' + today;
}

// Build a JSON export containing conversation text and optional raw API tool call data.
// include: { userMessages, aiResponses, toolChips, metadata, apiThread }
// rawApiThread: accumulated tool-round data from useCallAI (FR#102)
function buildJsonExport({ rawApiThread, messages, include, coachMode, tasks, coachName, userName }) {
  const modeLabel = (COACH_MODES[coachMode] || {}).label || coachMode;
  const now = new Date();
  const output = { exportedAt: now.toISOString(), coachMode: modeLabel };
  if (include.metadata) output.tasksCount = Array.isArray(tasks) ? tasks.length : 0;
  if (include.userMessages || include.aiResponses || include.toolChips) {
    output.conversation = messages
      .filter(msg => {
        if (msg.isSearchChip) return !!include.toolChips;
        if (msg.role === 'user') return !!include.userMessages;
        if (msg.role === 'assistant') return !!include.aiResponses;
        return false;
      })
      .map(msg => ({
        role: msg.role,
        speaker: msg.role === 'user' ? (userName || 'You') : (coachName || 'Coach'),
        text: msg.text || '',
        ...(msg.isSearchChip ? { isSearchChip: true } : {}),
      }));
  }
  if (include.apiThread) output.rawApiThread = rawApiThread || [];
  return JSON.stringify(output, null, 2);
}

const TASK_BUCKET_LABELS = {
  inbox:        'Inbox',
  next:         'Next Actions',
  project:      'Projects',
  waiting:      'Waiting For',
  someday:      'Someday / Maybe',
  deferred:     'Deferred',
  done:         'Completed',
  inboxHistory: 'Inbox History',
};
const TASK_BUCKET_ORDER = ['inbox', 'next', 'project', 'waiting', 'someday', 'deferred'];

// Build a human-readable markdown string for all tasks, grouped by bucket.
// include: { header, metadata, notes, completed }
function buildTaskListExportContent(tasks, include) {
  const lines = [];
  if (include.header) {
    lines.push('# GTD Task List Export');
    lines.push('');
    lines.push('**Date:** ' + new Date().toLocaleString());
    lines.push('**Total tasks:** ' + tasks.length);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  const order = [...TASK_BUCKET_ORDER, ...(include.completed ? ['done', 'inboxHistory'] : [])];
  for (const bucket of order) {
    const bucketTasks = tasks.filter(t => t.bucket === bucket);
    if (bucketTasks.length === 0) continue;
    lines.push('## ' + (TASK_BUCKET_LABELS[bucket] || bucket) + ' (' + bucketTasks.length + ')');
    lines.push('');
    for (const t of bucketTasks) {
      lines.push((t.done ? '- [x] ' : '- [ ] ') + t.text);
      if (include.metadata) {
        const meta = [];
        if (t.dueDate) meta.push('Due: ' + t.dueDate);
        if (t.effort)  meta.push('Effort: ' + t.effort);
        if ((t.location || []).length) meta.push('Location: ' + t.location.join(', '));
        if ((t.priority || []).length) meta.push('Priority: ' + t.priority.join(', '));
        if (meta.length) lines.push('  *' + meta.join(' · ') + '*');
      }
      if (include.notes && t.notes) {
        lines.push('  > ' + t.notes.replace(/\n/g, '\n  > '));
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function buildTaskListJsonExport(tasks, include) {
  const order = [...TASK_BUCKET_ORDER, ...(include.completed ? ['done', 'inboxHistory'] : [])];
  const output = {
    exportedAt: new Date().toISOString(),
    type: 'task-list',
    ...(include.header ? { totalTasks: tasks.length } : {}),
    tasks: tasks
      .filter(t => order.includes(t.bucket))
      .map(t => {
        const row = { id: t.id, text: t.text, bucket: t.bucket, done: !!t.done };
        if (include.metadata) {
          if (t.dueDate)           row.dueDate  = t.dueDate;
          if (t.effort)            row.effort   = t.effort;
          if (t.location?.length)  row.location = t.location;
          if (t.priority?.length)  row.priority = t.priority;
          row.created = t.created;
        }
        if (include.notes && t.notes) row.notes = t.notes;
        return row;
      }),
  };
  return JSON.stringify(output, null, 2);
}

export { buildExportContent, buildRtfContent, stripMarkdown, saveToDrive, downloadText, buildExportTitle, buildJsonExport, buildTaskListExportContent, buildTaskListJsonExport };