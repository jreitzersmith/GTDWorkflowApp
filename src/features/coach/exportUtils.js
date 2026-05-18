import { docsCreateDocument, docsAppendMarkdown } from '../../api/docsApi.js';
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

// Create a new Google Doc and append markdown-formatted content.
// Returns the doc URL on success.
async function exportToGoogleDocs({ markdownText, googleToken, title }) {
  const doc = await docsCreateDocument({ token: googleToken, title });
  if (markdownText.trim()) {
    await docsAppendMarkdown({ token: googleToken, documentId: doc.documentId, markdownText });
  }
  return 'https://docs.google.com/document/d/' + doc.documentId + '/edit';
}

// Trigger a browser file download for markdown or plain text.
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
  return 'GTD Coach — ' + modeLabel + ' — ' + today;
}

export { buildExportContent, exportToGoogleDocs, downloadText, buildExportTitle };
