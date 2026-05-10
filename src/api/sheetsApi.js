// Google Sheets API v4 — utility functions
// All functions accept { token, onTokenRefresh? } and throw on non-OK responses.

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

async function sheetsRequest(url, { token, method = 'GET', body } = {}, onTokenRefresh) {
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

// Get spreadsheet metadata (title, sheets list, named ranges).
async function sheetsGetSpreadsheet({ token, spreadsheetId, onTokenRefresh } = {}) {
  const res = await sheetsRequest(`${SHEETS_BASE}/${spreadsheetId}`, { token }, onTokenRefresh);
  if (!res.ok) throw new Error(`Sheets get failed: ${res.status}`);
  return res.json();
}

// Read values from a range using A1 notation (e.g. 'Sheet1!A1:Z100' or 'Sheet1').
// Returns { range, majorDimension, values: string[][] }
async function sheetsGetValues({ token, spreadsheetId, range, onTokenRefresh } = {}) {
  const res = await sheetsRequest(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { token },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Sheets getValues failed: ${res.status}`);
  return res.json();
}

// ── Create ────────────────────────────────────────────────────────────────────

// Create a new spreadsheet.
// Returns { spreadsheetId, spreadsheetUrl, properties: { title } }
async function sheetsCreateSpreadsheet({ token, title = 'Untitled Spreadsheet', onTokenRefresh } = {}) {
  const res = await sheetsRequest(SHEETS_BASE, {
    token, method: 'POST',
    body: { properties: { title } },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Sheets create failed: ${res.status}`);
  return res.json();
}

// ── Modify ────────────────────────────────────────────────────────────────────

// Append rows to a sheet. Values are treated as USER_ENTERED (formulas parsed).
// values: string[][] — rows of cells, e.g. [['Name', 'Date', 'Amount'], ['Coffee', '2026-05-09', '4.50']]
// range: the table to find for appending (usually just the sheet name, e.g. 'Sheet1').
async function sheetsAppendRows({ token, spreadsheetId, range = 'Sheet1', values, onTokenRefresh } = {}) {
  const params = new URLSearchParams({ valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS' });
  const res = await sheetsRequest(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?${params}`,
    { token, method: 'POST', body: { values } },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Sheets append failed: ${res.status}`);
  return res.json();
}

// Overwrite a specific range with new values.
async function sheetsUpdateValues({ token, spreadsheetId, range, values, onTokenRefresh } = {}) {
  const res = await sheetsRequest(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    { token, method: 'PUT', body: { range, values } },
    onTokenRefresh,
  );
  if (!res.ok) throw new Error(`Sheets updateValues failed: ${res.status}`);
  return res.json();
}

// Send an arbitrary batchUpdate requests array for structural changes
// (add/delete sheets, format cells, freeze rows, etc.)
// See: https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/batchUpdate
async function sheetsBatchUpdate({ token, spreadsheetId, requests, onTokenRefresh } = {}) {
  const res = await sheetsRequest(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Sheets batchUpdate failed: ${res.status}`);
  return res.json();
}

// ── Move ──────────────────────────────────────────────────────────────────────

// Move a spreadsheet to a different Drive folder (uses Drive API).
async function sheetsMoveToFolder({ token, spreadsheetId, newParentId, oldParentId, onTokenRefresh } = {}) {
  let url = `https://www.googleapis.com/drive/v3/files/${spreadsheetId}?addParents=${newParentId}&fields=id,parents`;
  if (oldParentId) url += `&removeParents=${oldParentId}`;
  const doFetch = (t) => fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${t}` } });
  let res = await doFetch(token);
  if (res.status === 401 && onTokenRefresh) {
    const newToken = await onTokenRefresh();
    if (newToken) res = await doFetch(newToken);
  }
  if (!res.ok) throw new Error(`Sheets move failed: ${res.status}`);
  return res.json();
}

export {
  sheetsGetSpreadsheet, sheetsGetValues,
  sheetsCreateSpreadsheet,
  sheetsAppendRows, sheetsUpdateValues, sheetsBatchUpdate,
  sheetsMoveToFolder,
};
