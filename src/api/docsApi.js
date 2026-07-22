// Google Docs API v1 — utility functions
// All functions accept { token, onTokenRefresh? } and throw on non-OK responses.
//
// For reading Docs content as plain text, prefer driveExportFile() from driveApi.js
// (it avoids parsing the complex structural document resource).
// These functions are for creation and programmatic modification.

const DOCS_BASE = 'https://docs.googleapis.com/v1/documents';

async function docsRequest(url, { token, method = 'GET', body } = {}, onTokenRefresh) {
  const doFetch = (t) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let res = await doFetch(token);
  if (res.status === 401 && onTokenRefresh) {
    const newToken = await onTokenRefresh();
    if (newToken) res = await doFetch(newToken);
  }
  return res;
}

// ── Read ──────────────────────────────────────────────────────────────────────

// Fetch the full document resource (title, body, inline objects, etc.).
// To get plain text content for AI context, use driveExportFile() instead.
async function docsGetDocument({ token, documentId, onTokenRefresh } = {}) {
  const res = await docsRequest(`${DOCS_BASE}/${documentId}`, { token }, onTokenRefresh);
  if (!res.ok) throw new Error(`Docs get failed: ${res.status}`);
  return res.json();
}

// ── Create ────────────────────────────────────────────────────────────────────

// Create a new Google Doc with the given title (body starts empty).
// Returns the full document resource including { documentId, title }.
async function docsCreateDocument({ token, title = 'Untitled Document', onTokenRefresh } = {}) {
  const res = await docsRequest(DOCS_BASE, {
    token, method: 'POST',
    body: { title },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Docs create failed: ${res.status}`);
  return res.json();
}

// ── Modify ────────────────────────────────────────────────────────────────────

// Append plain text to the end of an existing document.
// This reads the document first to find the correct insertion index.
async function docsAppendText({ token, documentId, text, onTokenRefresh } = {}) {
  const doc = await docsGetDocument({ token, documentId, onTokenRefresh });
  // The last structural element is always a paragraph with a trailing newline.
  // Insert before it so our text lands at the end of the visible content.
  const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;
  const insertAt = Math.max(1, endIndex - 1);

  const res = await docsRequest(`${DOCS_BASE}/${documentId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests: [{ insertText: { location: { index: insertAt }, text } }] },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Docs append failed: ${res.status}`);
  return res.json();
}

// Send an arbitrary batchUpdate requests array.
// Use this for advanced modifications (paragraph styles, tables, named ranges, etc.)
// See: https://developers.google.com/docs/api/reference/rest/v1/documents/batchUpdate
async function docsBatchUpdate({ token, documentId, requests, onTokenRefresh } = {}) {
  const res = await docsRequest(`${DOCS_BASE}/${documentId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Docs batchUpdate failed: ${res.status}`);
  return res.json();
}

// ── Move ──────────────────────────────────────────────────────────────────────

// Move a Doc to a different Drive folder (uses Drive API).
// oldParentId is optional — omit if unknown.
async function docsMoveToFolder({ token, documentId, newParentId, oldParentId, onTokenRefresh } = {}) {
  let url = `https://www.googleapis.com/drive/v3/files/${documentId}?addParents=${newParentId}&fields=id,parents`;
  if (oldParentId) url += `&removeParents=${oldParentId}`;
  const doFetch = (t) => fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${t}` } });
  let res = await doFetch(token);
  if (res.status === 401 && onTokenRefresh) {
    const newToken = await onTokenRefresh();
    if (newToken) res = await doFetch(newToken);
  }
  if (!res.ok) throw new Error(`Docs move failed: ${res.status}`);
  return res.json();
}


// ── Markdown formatting ───────────────────────────────────────────────────────

// Parse inline markdown markers (*italic*, **bold**, ***bold+italic***).
// Returns { plainText: string (markers stripped), styles: [{start, end, bold, italic}] }
function parseInlineMarkdown(rawText) {
  const styles = [];
  let plain = '';
  let i = 0;
  while (i < rawText.length) {
    if ((rawText[i] === '*' || rawText[i] === '_') && rawText[i + 1] !== ' ') {
      const marker = rawText[i];
      let markerLen = 1;
      if (rawText[i + 1] === marker) { markerLen++; if (rawText[i + 2] === marker) markerLen++; }
      const closeMarker = marker.repeat(markerLen);
      const closeIdx = rawText.indexOf(closeMarker, i + markerLen);
      if (closeIdx !== -1 && closeIdx > i + markerLen) {
        const content = rawText.slice(i + markerLen, closeIdx);
        const start = plain.length;
        plain += content;
        styles.push({
          start,
          end: plain.length,
          bold: markerLen >= 2,
          italic: markerLen === 1 || markerLen === 3,
        });
        i = closeIdx + markerLen;
        continue;
      }
    }
    plain += rawText[i];
    i++;
  }
  return { plainText: plain, styles };
}

// Convert a markdown string to a Docs API batchUpdate requests array.
// Handles: # / ## / ### headings, - or * bullets, **bold**, *italic*.
// insertAt: the document character index at which to begin inserting.
// All requests are sent in a single batchUpdate — insertText is request[0],
// styling requests follow and reference the post-insertion document indices.
function buildMarkdownRequests(markdownText, insertAt) {
  const lines = markdownText.split('\n');
  const segments = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    const bulletMatch  = !headingMatch && line.match(/^[-*]\s+(.*)/);
    let rawContent, paraStyle, isBullet;

    if (headingMatch) {
      rawContent = headingMatch[2];
      paraStyle  = ['HEADING_1', 'HEADING_2', 'HEADING_3'][headingMatch[1].length - 1];
      isBullet   = false;
    } else if (bulletMatch) {
      rawContent = bulletMatch[1];
      paraStyle  = 'NORMAL_TEXT';
      isBullet   = true;
    } else {
      rawContent = line;
      paraStyle  = 'NORMAL_TEXT';
      isBullet   = false;
    }

    const { plainText, styles } = parseInlineMarkdown(rawContent);
    segments.push({ text: plainText + '\n', paraStyle, isBullet, inlineStyles: styles });
  }

  const fullText = segments.map(s => s.text).join('');
  const requests = [{ insertText: { location: { index: insertAt }, text: fullText } }];

  // Compute absolute document positions for each segment
  let offset = insertAt;
  for (const seg of segments) {
    seg.absStart = offset;
    seg.absEnd   = offset + seg.text.length;
    offset       = seg.absEnd;
  }

  // Apply styles back-to-front (indices are stable since styling ops don't shift text)
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];

    if (seg.paraStyle !== 'NORMAL_TEXT') {
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: seg.absStart, endIndex: seg.absEnd },
          paragraphStyle: { namedStyleType: seg.paraStyle },
          fields: 'namedStyleType',
        },
      });
    }

    if (seg.isBullet) {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: seg.absStart, endIndex: seg.absEnd },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
    }

    for (let j = seg.inlineStyles.length - 1; j >= 0; j--) {
      const style    = seg.inlineStyles[j];
      const absStart = seg.absStart + style.start;
      const absEnd   = seg.absStart + style.end;
      if (absStart >= absEnd) continue;
      const textStyle = {};
      const fields    = [];
      if (style.bold)   { textStyle.bold   = true; fields.push('bold');   }
      if (style.italic) { textStyle.italic = true; fields.push('italic'); }
      if (fields.length) {
        requests.push({
          updateTextStyle: {
            range: { startIndex: absStart, endIndex: absEnd },
            textStyle,
            fields: fields.join(','),
          },
        });
      }
    }
  }

  return requests;
}

// Append markdown-formatted text to an existing document using native Docs formatting.
// Headings become HEADING_1/2/3, bullets become BULLET_DISC_CIRCLE_SQUARE,
// **bold** and *italic* become character styles.
// The raw markdownText is available at the call site for a future Obsidian export path.
async function docsAppendMarkdown({ token, documentId, markdownText, onTokenRefresh } = {}) {
  const doc      = await docsGetDocument({ token, documentId, onTokenRefresh });
  const endIndex = doc.body && doc.body.content && doc.body.content.length
    ? doc.body.content[doc.body.content.length - 1].endIndex
    : 1;
  const insertAt = Math.max(1, endIndex - 1);
  const requests = buildMarkdownRequests(markdownText, insertAt);
  return docsBatchUpdate({ token, documentId, requests, onTokenRefresh });
}

export { docsGetDocument, docsCreateDocument, docsAppendText, docsAppendMarkdown, docsBatchUpdate, docsMoveToFolder };
