// Google Drive API v3 — utility functions
// All functions accept { token, onTokenRefresh? } and throw on non-OK responses.
// onTokenRefresh: async () => string | null — called on 401 before a single retry.

const DRIVE_BASE   = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

async function driveRequest(url, { token, method = 'GET', headers = {}, body } = {}, onTokenRefresh) {
  const doFetch = (t) => fetch(url, {
    method,
    headers: { Authorization: `Bearer ${t}`, ...headers },
    ...(body !== undefined ? { body } : {}),
  });
  let res = await doFetch(token);
  if (res.status === 401 && onTokenRefresh) {
    const newToken = await onTokenRefresh();
    if (newToken) res = await doFetch(newToken);
  }
  return res;
}

// ── List / search ─────────────────────────────────────────────────────────────

// List files and folders matching a Drive query string.
// q examples:
//   "trashed=false"
//   "name contains 'budget' and trashed=false"
//   "'FOLDER_ID' in parents"
//   "mimeType='application/vnd.google-apps.document'"
// Returns { files: [...], nextPageToken? }
async function driveListFiles({
  token,
  q = 'trashed=false',
  fields = 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,size,parents)',
  pageToken,
  pageSize = 20,
  onTokenRefresh,
} = {}) {
  const params = new URLSearchParams({ q, fields, pageSize,
    supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await driveRequest(`${DRIVE_BASE}/files?${params}`, { token }, onTokenRefresh);
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Get metadata for a single file without downloading its content.
async function driveGetFile({
  token,
  fileId,
  fields = 'id,name,mimeType,modifiedTime,webViewLink,thumbnailLink,size,parents,owners',
  onTokenRefresh,
} = {}) {
  const res = await driveRequest(
    `${DRIVE_BASE}/files/${fileId}?fields=${encodeURIComponent(fields)}`,
    { token },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Drive getFile failed: ${res.status}`);
  return res.json();
}

// ── Create ────────────────────────────────────────────────────────────────────

// Create a file or folder with no content.
// For a folder: mimeType = 'application/vnd.google-apps.folder'
// For a Google Doc: mimeType = 'application/vnd.google-apps.document'
async function driveCreateFile({
  token,
  name,
  mimeType = 'application/octet-stream',
  parents = [],
  onTokenRefresh,
} = {}) {
  const meta = { name, mimeType, ...(parents.length ? { parents } : {}) };
  const res = await driveRequest(`${DRIVE_BASE}/files?fields=id,name,webViewLink,mimeType`, {
    token, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(meta),
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Drive createFile failed: ${res.status}`);
  return res.json();
}

// ── Upload ────────────────────────────────────────────────────────────────────

// Upload a file with content using the simple multipart upload (≤ 5 MB).
// content: string | Blob | ArrayBuffer
// Returns { id, name, webViewLink }
async function driveUploadFile({
  token,
  name,
  mimeType = 'application/octet-stream',
  content,
  parents = [],
  onTokenRefresh,
} = {}) {
  const meta = JSON.stringify({ name, mimeType, ...(parents.length ? { parents } : {}) });
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const form = new FormData();
  form.append('metadata', new Blob([meta], { type: 'application/json' }));
  form.append('file', blob);
  const res = await driveRequest(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`,
    { token, method: 'POST', body: form },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  return res.json();
}

// ── Download / export ─────────────────────────────────────────────────────────

// Download a non-Google-native file's raw content as text.
// For Docs/Sheets/Slides use driveExportFile() instead.
async function driveDownloadFile({ token, fileId, onTokenRefresh } = {}) {
  const res = await driveRequest(
    `${DRIVE_BASE}/files/${fileId}?alt=media`,
    { token },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.text();
}

// Download a non-Google-native file as base64 — used for PDFs sent to Claude as document blocks.
async function driveDownloadFileAsBase64({ token, fileId, onTokenRefresh } = {}) {
  const res = await driveRequest(
    `${DRIVE_BASE}/files/${fileId}?alt=media`,
    { token },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  // FileReader-free base64 encoding via Uint8Array
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Export a Google-native file (Doc, Sheet, Slide) to another MIME type.
// Useful for feeding document content to the AI coach as plain text.
// Common mimeType values:
//   'text/plain'           — Google Docs → plain text
//   'text/csv'             — Google Sheets → CSV
//   'application/pdf'      — any → PDF
//   'text/html'            — Docs → HTML
async function driveExportFile({ token, fileId, mimeType = 'text/plain', onTokenRefresh } = {}) {
  const res = await driveRequest(
    `${DRIVE_BASE}/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`,
    { token },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Drive export failed: ${res.status}`);
  return res.text();
}

// ── Rename / move / delete ────────────────────────────────────────────────────

// Rename a file or folder.
async function driveRenameFile({ token, fileId, name, onTokenRefresh } = {}) {
  const res = await driveRequest(`${DRIVE_BASE}/files/${fileId}?fields=id,name`, {
    token, method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Drive rename failed: ${res.status}`);
  return res.json();
}

// Move a file or folder to a different parent.
// oldParentId: optional — omit if unknown (file stays in existing parents too).
async function driveMoveFile({ token, fileId, newParentId, oldParentId, onTokenRefresh } = {}) {
  let url = `${DRIVE_BASE}/files/${fileId}?addParents=${newParentId}&fields=id,parents`;
  if (oldParentId) url += `&removeParents=${oldParentId}`;
  const res = await driveRequest(url, { token, method: 'PATCH' }, onTokenRefresh);
  if (!res.ok) throw new Error(`Drive move failed: ${res.status}`);
  return res.json();
}

// Move a file to trash (reversible).  Pass hardDelete: true to permanently delete.
async function driveDeleteFile({ token, fileId, hardDelete = false, onTokenRefresh } = {}) {
  if (hardDelete) {
    const res = await driveRequest(
      `${DRIVE_BASE}/files/${fileId}`,
      { token, method: 'DELETE' },
      onTokenRefresh,
    );
    if (!res.ok && res.status !== 204) throw new Error(`Drive delete failed: ${res.status}`);
    return;
  }
  const res = await driveRequest(`${DRIVE_BASE}/files/${fileId}?fields=id,trashed`, {
    token, method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Drive trash failed: ${res.status}`);
  return res.json();
}

export {
  driveListFiles, driveGetFile,
  driveCreateFile, driveUploadFile,
  driveDownloadFile, driveDownloadFileAsBase64, driveExportFile,
  driveRenameFile, driveMoveFile, driveDeleteFile,
};
