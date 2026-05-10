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

export { docsGetDocument, docsCreateDocument, docsAppendText, docsBatchUpdate, docsMoveToFolder };
