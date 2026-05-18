import { docsCreateDocument, docsAppendText, docsAppendMarkdown, docsMoveToFolder } from '../../api/docsApi.js';
import { COACH_MODES } from '../../constants.jsx';

// Build a human-readable markdown string from the messages array.
// include: { userMessages, aiResponses, toolChips, metadata }
function buildExportContent(messages, include, coachMode, tasks) {
  const modeLabel = (COACH_MODES[coachMode] || {}).label || coachMode;
  const lines = [];

  if (include.metadata) {
    const now = new Date();
    lines.push('# GTD Coach Export');
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
      lines.push('**You:** ' + (msg.text || ''));
      lines.push('');
    } else if (msg.role === 'assistant') {
      if (!include.aiResponses) continue;
      lines.push('**Coach:** ' + (msg.text || ''));
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
async function saveToDrive({ markdownText, googleToken, title, format, reviewDriveFolderId }) {
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
  if (reviewDriveFolderId) {
    await docsMoveToFolder({ token: googleToken, documentId: doc.documentId, newParentId: reviewDriveFolderId });
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
function buildExportTitle(coachMode) {
  const modeLabel = (COACH_MODES[coachMode] || {}).label || 'Chat';
  const today = new Date().toISOString().slice(0, 10);
  return 'GTD Coach \u2014 ' + modeLabel + ' \u2014 ' + today;
}

export { buildExportContent, buildRtfContent, stripMarkdown, saveToDrive, downloadText, buildExportTitle };
