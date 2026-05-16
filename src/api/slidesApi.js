// Google Slides API v1 — utility functions
// All functions accept { token, onTokenRefresh? } and throw on non-OK responses.
//
// Note: The Slides API batchUpdate uses EMU (English Metric Units) for sizes.
// 1 inch = 914400 EMU. A standard 10" x 7.5" slide = 9144000 x 6858000 EMU.

const SLIDES_BASE = 'https://slides.googleapis.com/v1/presentations';

async function slidesRequest(url, { token, method = 'GET', body } = {}, onTokenRefresh) {
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

// -- Read ---------------------------------------------------------------------

// Get a presentation's full resource (title, slides, page elements).
async function slidesGetPresentation({ token, presentationId, onTokenRefresh } = {}) {
  const res = await slidesRequest(`${SLIDES_BASE}/${presentationId}`, { token }, onTokenRefresh);
  if (!res.ok) throw new Error(`Slides get failed: ${res.status}`);
  return res.json();
}

// -- Create -------------------------------------------------------------------

// Create a new presentation with the given title.
// Google automatically adds one blank title slide.
// Returns the full presentation resource; a convenience presentationUrl is added.
async function slidesCreatePresentation({ token, title = 'Untitled Presentation', onTokenRefresh } = {}) {
  const res = await slidesRequest(SLIDES_BASE, {
    token, method: 'POST',
    body: { title },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Slides create failed: ${res.status}`);
  const data = await res.json();
  return {
    ...data,
    presentationUrl: `https://docs.google.com/presentation/d/${data.presentationId}/edit`,
  };
}

// -- Modify -------------------------------------------------------------------

// Add a new "Title and Body" slide with text content.
// Uses TITLE_AND_BODY layout: creates the slide, fetches the presentation to
// resolve Google-assigned placeholder IDs, then inserts text into them.
// Appends to the end of the presentation.
async function slidesAddTextSlide({
  token,
  presentationId,
  title = '',
  body  = '',
  onTokenRefresh,
} = {}) {
  const rnd = () => Math.random().toString(36).slice(2, 9);
  const slideId = `s${rnd()}${rnd()}`; // 14 alphanumeric chars, valid object ID

  // Step 1: create slide with TITLE_AND_BODY layout so Google provisions named placeholders
  const r1 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests: [{ createSlide: { objectId: slideId, insertionIndex: 9999, slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' } } }] },
  }, onTokenRefresh);
  if (!r1.ok) throw new Error(`Slides addTextSlide (create) failed: ${r1.status}`);

  // Step 2: fetch the presentation to resolve the placeholder object IDs Google assigned
  const r2 = await slidesRequest(`${SLIDES_BASE}/${presentationId}`, { token }, onTokenRefresh);
  if (!r2.ok) throw new Error(`Slides addTextSlide (get) failed: ${r2.status}`);
  const pres = await r2.json();
  const slide = (pres.slides || []).find(s => s.objectId === slideId);
  if (!slide) throw new Error('Slides addTextSlide: slide not found after creation');

  const ph = (...types) => (slide.pageElements || []).find(
    e => e.shape && e.shape.placeholder && types.includes(e.shape.placeholder.type)
  );
  const titleEl = ph('TITLE', 'CENTERED_TITLE');
  const bodyEl  = ph('BODY', 'SUBTITLE');

  // Step 3: insert text into the layout placeholders
  const textReqs = [
    ...(title && titleEl ? [{ insertText: { objectId: titleEl.objectId, insertionIndex: 0, text: title } }] : []),
    ...(body  && bodyEl  ? [{ insertText: { objectId: bodyEl.objectId,  insertionIndex: 0, text: body  } }] : []),
  ];
  if (textReqs.length === 0) return;

  const r3 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST', body: { requests: textReqs },
  }, onTokenRefresh);
  if (!r3.ok) throw new Error(`Slides addTextSlide (text) failed: ${r3.status}`);
  return r3.json();
}

// Send an arbitrary batchUpdate requests array for advanced modifications.
// See: https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate
async function slidesBatchUpdate({ token, presentationId, requests, onTokenRefresh } = {}) {
  const res = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Slides batchUpdate failed: ${res.status}`);
  return res.json();
}

// -- Move ---------------------------------------------------------------------

// Move a presentation to a different Drive folder (uses Drive API).
async function slidesMoveToFolder({ token, presentationId, newParentId, oldParentId, onTokenRefresh } = {}) {
  let url = `https://www.googleapis.com/drive/v3/files/${presentationId}?addParents=${newParentId}&fields=id,parents`;
  if (oldParentId) url += `&removeParents=${oldParentId}`;
  const doFetch = (t) => fetch(url, { method: 'PATCH', headers: { Authorization: `Bearer ${t}` } });
  let res = await doFetch(token);
  if (res.status === 401 && onTokenRefresh) {
    const newToken = await onTokenRefresh();
    if (newToken) res = await doFetch(newToken);
  }
  if (!res.ok) throw new Error(`Slides move failed: ${res.status}`);
  return res.json();
}

export {
  slidesGetPresentation,
  slidesCreatePresentation,
  slidesAddTextSlide, slidesBatchUpdate,
  slidesMoveToFolder,
};
