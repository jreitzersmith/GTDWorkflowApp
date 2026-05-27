import { docsCreateDocument, docsAppendText, docsAppendMarkdown, docsMoveToFolder } from '../../api/docsApi.js';
import { COACH_MODES, DEFAULT_EXPORT_TEMPLATES } from '../../constants.jsx';

// Apply {{variable}} substitution to a template string.
// Unknown variables are left as-is so typos are visible rather than silently erased.
function applyTemplate(template, vars) {
  return Object.entries(vars).reduce((acc, [key, val]) => {
    return acc.split('{{' + key + '}}').join(val != null ? String(val) : '');
  }, template);
}

// Build a human-readable markdown string from the messages array.
// include: { userMessages, aiResponses, toolChips, metadata }
function buildExportContent(messages, include, coachMode, tasks, { coachName, userName, template, provider, messageRowTemplate } = {}) {
  const modeLabel = (COACH_MODES[coachMode] || {}).label || coachMode;
  const lines = [];
  const resolvedMsgRowTemplate = messageRowTemplate || DEFAULT_EXPORT_TEMPLATES.messageRowTemplate;

  for (const msg of messages) {
    if (msg.isSearchChip) {
      if (!include.toolChips) continue;
      lines.push('> *' + (msg.text || '') + '*');
      lines.push('');
      continue;
    }
    if (msg.role === 'user') {
      if (!include.userMessages) continue;
      lines.push(applyTemplate(resolvedMsgRowTemplate, { speaker: userName || 'You', role: 'user', text: msg.text || '' }));
      lines.push('');
    } else if (msg.role === 'assistant') {
      if (!include.aiResponses) continue;
      lines.push(applyTemplate(resolvedMsgRowTemplate, { speaker: coachName || 'Coach', role: 'assistant', text: msg.text || '' }));
      lines.push('');
    }
  }

  const messagesContent = lines.join('\n');
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  const messageCount = messages.filter(m =>
    (m.role === 'user' && include.userMessages) || (m.role === 'assistant' && include.aiResponses)
  ).length;
  return applyTemplate(template || DEFAULT_EXPORT_TEMPLATES.conversation, {
    coachName: coachName || 'GTD Coach',
    userName: userName || '',
    date: now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
    time,
    weekNumber,
    mode: modeLabel,
    taskCount: Array.isArray(tasks) ? tasks.length : 0,
    messageCount,
    provider: provider || 'Claude',
    messages: messagesContent,
  });
}

// Convert a markdown string to RTF for browser download.
// Supports: headings (h1-h3), bold, italic, indented bullet lists (- [ ]/- [x]/- ),
// blockquotes, horizontal rules. 2-space indent levels map to RTF \li increments.
function buildRtfContent(markdownText) {
  function escRtf(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\{/g, '\\{')
      .replace(/\}/g, '\\}')
      .replace(/[\uD800-\uDFFF]/g, '?')
      .replace(/[^\x00-\x7F]/g, ch => {
        const cp = ch.charCodeAt(0);
        return '\\u' + (cp > 0x7FFF ? cp - 0x10000 : cp) + '?';
      });
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

  return '{\\rtf1\\ansi\\ansicpg1252\\deff0{\\fonttbl{\\f0\\fswiss\\fcharset0 Arial;}}\\f0\\fs24\\pard\n' + rtfLines.join('\n') + '\n}';
}
// Strip markdown symbols to produce plain text.
function stripMarkdown(markdownText) {
  return markdownText
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^---$/gm, '----------');
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
function buildTaskListExportContent(tasks, include, template) {
  const lines = [];
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
  const sectionsContent = lines.join('\n');
  const nowT = new Date();
  const timeT = nowT.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startT = new Date(nowT.getFullYear(), 0, 1);
  const weekT = Math.ceil(((nowT - startT) / 86400000 + startT.getDay() + 1) / 7);
  return applyTemplate(template || DEFAULT_EXPORT_TEMPLATES.taskList, {
    userName: '',
    date: nowT.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
    time: timeT,
    weekNumber: weekT,
    totalTasks: tasks.filter(t => !t.done).length,
    nextActionCount: tasks.filter(t => t.isNextAction && !t.done).length,
    overdueCount: tasks.filter(t => t.dueDate && new Date(t.dueDate) < nowT && !t.done).length,
    inboxCount: tasks.filter(t => t.bucket === 'inbox' && !t.done).length,
    sections: sectionsContent,
  });
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
function buildHierarchicalExportContent(tasks, sections, include, template, rowOptions = {}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const lines = [];
  const resolvedIndentUnit = rowOptions.indentUnit != null ? rowOptions.indentUnit : DEFAULT_EXPORT_TEMPLATES.indentUnit;
  const resolvedTaskRowTemplate = rowOptions.taskRowTemplate || DEFAULT_EXPORT_TEMPLATES.taskRowTemplate;

  function walk(task, depth) {
    const section = _taskSection(task, todayStr);
    const indent = resolvedIndentUnit.repeat(depth);
    const children = (task.childIds || [])
      .map(id => taskMap.get(id))
      .filter(Boolean)
      .filter(c => !c.done);

    if (sections[section]) {
      lines.push(applyTemplate(resolvedTaskRowTemplate, { indent, depth: String(depth), bullet: task.done ? '[x]' : '[ ]', text: task.text }));
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

  const tasksContent = lines.join('\n');
  const nowH = new Date();
  const timeH = nowH.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const startH = new Date(nowH.getFullYear(), 0, 1);
  const weekH = Math.ceil(((nowH - startH) / 86400000 + startH.getDay() + 1) / 7);
  return applyTemplate(template || DEFAULT_EXPORT_TEMPLATES.hierarchical, {
    userName: '',
    date: nowH.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
    time: timeH,
    weekNumber: weekH,
    totalTasks: tasks.filter(t => !t.done).length,
    projectCount: tasks.filter(t => t.bucket === 'project' && !t.parentId && !t.done).length,
    tasks: tasksContent,
  });
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

export { applyTemplate, buildExportContent, buildRtfContent, stripMarkdown, saveToDrive, downloadText, buildExportTitle, buildJsonExport, buildTaskListExportContent, buildTaskListJsonExport, buildFocusViewExportContent, buildFocusViewJsonExport, buildHierarchicalExportContent, buildHierarchicalJsonExport };