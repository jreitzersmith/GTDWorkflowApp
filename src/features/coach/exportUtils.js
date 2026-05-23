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
// Supports: headings (h1-h3), bold, italic, indented bullet lists (- [ ]/- [x]/- ),
// blockquotes, horizontal rules. 2-space indent levels map to RTF \li increments.
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

  const INDENT_TWIPS = 360; // 0.25 in per 2-space markdown indent level
  const rtfLines = [];
  for (const raw of markdownText.split('\n')) {
    let m;
    const leadingSpaces = (raw.match(/^( *)/) || ['', ''])[1].length;
    const indentLevel = Math.floor(leadingSpaces / 2);
    const li = indentLevel * INDENT_TWIPS;
    const liCmd   = li > 0 ? '\\li' + li + ' ' : '';
    const liReset = li > 0 ? '\\li0' : '';
    const stripped = raw.trimStart();

    if ((m = stripped.match(/^###\s+(.+)/))) {
      rtfLines.push(liCmd + '{\\b\\fs26 ' + applyInline(m[1]) + '}' + liReset + '\\par');
    } else if ((m = stripped.match(/^##\s+(.+)/))) {
      rtfLines.push(liCmd + '{\\b\\fs28 ' + applyInline(m[1]) + '}' + liReset + '\\par');
    } else if ((m = stripped.match(/^#\s+(.+)/))) {
      rtfLines.push('{\\b\\fs32 ' + applyInline(m[1]) + '}\\par');
    } else if ((m = stripped.match(/^-\s+\[x\]\s+(.*)/))) {
      rtfLines.push(liCmd + '{\\strike ' + applyInline(m[1]) + '}' + liReset + '\\par');
    } else if ((m = stripped.match(/^-\s+\[\s\]\s+(.*)/))) {
      rtfLines.push(liCmd + '\\u8226? ' + applyInline(m[1]) + liReset + '\\par');
    } else if ((m = stripped.match(/^-\s+(.*)/))) {
      rtfLines.push(liCmd + '\\u8226? ' + applyInline(m[1]) + liReset + '\\par');
    } else if ((m = stripped.match(/^>\s*(.*)/))) {
      rtfLines.push('\\li' + ((indentLevel + 1) * INDENT_TWIPS) + ' {\\i ' + applyInline(m[1]) + '}\\li0\\par');
    } else if (/^---+$/.test(stripped)) {
      rtfLines.push('\\par');
    } else if (!stripped) {
      rtfLines.push('\\par');
    } else {
      rtfLines.push(liCmd + applyInline(stripped) + liReset + '\\par');
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

// Flag-based view filters matching App.jsx bucketTasks logic.
// next/waiting/someday/deferred are virtual views: tasks stored as bucket:'project' + flag.
const _todayStr = () => new Date().toISOString().slice(0, 10);
const TASK_VIEW_FILTERS = {
  inbox:        t => t.bucket === 'inbox',
  next:         t => t.bucket === 'project' && !!t.isNextAction && !t.isSomeday && !t.isWaitingFor,
  project:      t => t.bucket === 'project' && !t.isNextAction && !t.isSomeday && !t.isWaitingFor && !(t.deferUntil && t.deferUntil > _todayStr()),
  waiting:      t => t.bucket === 'project' && !!t.isWaitingFor,
  someday:      t => t.bucket === 'project' && !!t.isSomeday,
  deferred:     t => t.bucket === 'project' && !!(t.deferUntil && t.deferUntil > _todayStr()),
  done:         t => t.bucket === 'done',
  inboxHistory: t => t.bucket === 'inboxHistory',
};
const TASK_VIEW_LABELS = {
  inbox:        'Inbox',
  next:         'Next Actions',
  project:      'Projects',
  waiting:      'Waiting For',
  someday:      'Someday / Maybe',
  deferred:     'Deferred',
  done:         'Completed',
  inboxHistory: 'Inbox History',
};
const TASK_VIEW_ORDER = ['inbox', 'next', 'project', 'waiting', 'someday', 'deferred'];

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
  const order = [...TASK_VIEW_ORDER, ...(include.completed ? ['done', 'inboxHistory'] : [])];
  for (const view of order) {
    const viewTasks = tasks.filter(TASK_VIEW_FILTERS[view] || (() => false));
    if (viewTasks.length === 0) continue;
    lines.push('## ' + (TASK_VIEW_LABELS[view] || view) + ' (' + viewTasks.length + ')');
    lines.push('');
    for (const t of viewTasks) {
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
  const order = [...TASK_VIEW_ORDER, ...(include.completed ? ['done', 'inboxHistory'] : [])];
  const output = {
    exportedAt: new Date().toISOString(),
    type: 'task-list',
    ...(include.header ? { totalTasks: tasks.length } : {}),
    tasks: order.flatMap(view => tasks.filter(TASK_VIEW_FILTERS[view] || (() => false)).map(t => {
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
    })),
  };
  return JSON.stringify(output, null, 2);
}

// Build a human-readable markdown string for the Today's Focus view tiers.
// tiers: [{ label, tasks }]
// include: { header, metadata, notes }
function buildFocusViewExportContent(tiers, include) {
  const lines = [];
  const totalTasks = tiers.reduce((n, t) => n + t.tasks.length, 0);
  if (include.header) {
    lines.push("# Today's Focus Export");
    lines.push('');
    lines.push('**Date:** ' + new Date().toLocaleString());
    lines.push('**Items:** ' + totalTasks);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  for (const tier of tiers) {
    if (tier.tasks.length === 0) continue;
    lines.push('## ' + tier.label + ' (' + tier.tasks.length + ')');
    lines.push('');
    for (const t of tier.tasks) {
      lines.push((t.done ? '- [x] ' : '- [ ] ') + t.text);
      if (include.metadata) {
        const meta = [];
        if (t.dueDate) meta.push('Due: ' + t.dueDate);
        if (t.effort)  meta.push('Effort: ' + t.effort);
        if ((t.location || []).length) meta.push('Location: ' + t.location.join(', '));
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

function buildFocusViewJsonExport(tiers, include) {
  const totalTasks = tiers.reduce((n, t) => n + t.tasks.length, 0);
  const output = {
    exportedAt: new Date().toISOString(),
    type: 'focus-view',
    ...(include.header ? { totalItems: totalTasks } : {}),
    tiers: tiers
      .filter(tier => tier.tasks.length > 0)
      .map(tier => ({
        label: tier.label,
        tasks: tier.tasks.map(t => {
          const row = { id: t.id, text: t.text, bucket: t.bucket, done: !!t.done };
          if (include.metadata) {
            if (t.dueDate)          row.dueDate  = t.dueDate;
            if (t.effort)           row.effort   = t.effort;
            if (t.location?.length) row.location = t.location;
          }
          if (include.notes && t.notes) row.notes = t.notes;
          return row;
        }),
      })),
  };
  return JSON.stringify(output, null, 2);
}


// Section labels for hierarchical export.
const HIERARCHICAL_SECTION_LABELS = {
  project: 'Project Structure',
  next:    'Next Actions',
  waiting: 'Waiting For',
  someday: 'Someday / Maybe',
  deferred: 'Deferred',
};

// Determine which virtual section a task belongs to.
function _taskSection(t, todayStr) {
  if (t.isWaitingFor) return 'waiting';
  if (t.isSomeday) return 'someday';
  if (t.deferUntil && t.deferUntil > todayStr) return 'deferred';
  if (t.isNextAction) return 'next';
  return 'project';
}

// Build a hierarchical markdown export by walking the childIds/parentId tree.
// tasks: full task array
// sections: { project, next, waiting, someday, deferred } — booleans
// include: { header, metadata, notes }
function buildHierarchicalExportContent(tasks, sections, include) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const lines = [];

  if (include.header) {
    const activeSections = Object.entries(sections)
      .filter(([, v]) => v)
      .map(([k]) => HIERARCHICAL_SECTION_LABELS[k] || k)
      .join(', ');
    lines.push('# GTD Project Export');
    lines.push('');
    lines.push('**Date:** ' + new Date().toLocaleString());
    lines.push('**Sections:** ' + (activeSections || 'none'));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  function walk(task, depth) {
    const section = _taskSection(task, todayStr);
    const indent = '  '.repeat(depth);
    const children = (task.childIds || [])
      .map(id => taskMap.get(id))
      .filter(Boolean)
      .filter(c => !c.done);

    if (sections[section]) {
      lines.push(indent + (task.done ? '- [x] ' : '- [ ] ') + task.text);
      if (include.metadata) {
        const meta = [];
        if (task.dueDate)                    meta.push('Due: ' + task.dueDate);
        if (task.effort)                     meta.push('Effort: ' + task.effort);
        if ((task.location || []).length)    meta.push('Location: ' + task.location.join(', '));
        if ((task.priority || []).length)    meta.push('Priority: ' + task.priority.join(', '));
        if (meta.length) lines.push(indent + '  *' + meta.join(' · ') + '*');
      }
      if (include.notes && task.notes) {
        lines.push(indent + '  > ' + task.notes.replace(/\n/g, '\n' + indent + '  > '));
      }
    }

    for (const child of children) {
      walk(child, sections[section] ? depth + 1 : depth);
    }
  }

  const roots = tasks.filter(t => t.bucket === 'project' && !t.parentId && !t.done);
  for (const root of roots) {
    walk(root, 0);
  }

  return lines.join('\n');
}

// Build a JSON hierarchical export. Emits a nested structure with children arrays.
// tasks: full task array
// sections: { project, next, waiting, someday, deferred } — booleans
// include: { header, metadata, notes }
function buildHierarchicalJsonExport(tasks, sections, include) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function walk(task, depth) {
    const section = _taskSection(task, todayStr);
    const children = (task.childIds || [])
      .map(id => taskMap.get(id))
      .filter(Boolean)
      .filter(c => !c.done);
    const childNodes = children.flatMap(c => walk(c, depth + 1));

    if (!sections[section]) return childNodes;

    const row = { id: task.id, text: task.text, section, depth, done: !!task.done };
    if (include.metadata) {
      if (task.dueDate)           row.dueDate  = task.dueDate;
      if (task.effort)            row.effort   = task.effort;
      if (task.location?.length)  row.location = task.location;
      if (task.priority?.length)  row.priority = task.priority;
    }
    if (include.notes && task.notes) row.notes = task.notes;
    if (childNodes.length) row.children = childNodes;
    return [row];
  }

  const roots = tasks.filter(t => t.bucket === 'project' && !t.parentId && !t.done);
  const nodes = roots.flatMap(r => walk(r, 0));
  const activeSections = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);

  const output = {
    exportedAt: new Date().toISOString(),
    type: 'hierarchical',
    ...(include.header ? { totalNodes: nodes.length } : {}),
    sections: activeSections,
    tasks: nodes,
  };
  return JSON.stringify(output, null, 2);
}

export { buildExportContent, buildRtfContent, stripMarkdown, saveToDrive, downloadText, buildExportTitle, buildJsonExport, buildTaskListExportContent, buildTaskListJsonExport, buildFocusViewExportContent, buildFocusViewJsonExport, buildHierarchicalExportContent, buildHierarchicalJsonExport };