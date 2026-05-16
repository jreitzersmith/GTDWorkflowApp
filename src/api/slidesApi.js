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

// Add a new slide with title and body text using TEXT_BOX shapes.
// Uses pre-generated objectIds — no GET needed to resolve placeholder IDs.
// createShape and insertText for each shape are in a single batchUpdate call;
// the API processes requests in order so the shape exists before text is inserted.
// Appends to the end of the presentation.
async function slidesAddTextSlide({
  token,
  presentationId,
  title = '',
  body  = '',
  onTokenRefresh,
} = {}) {
  const rnd = () => Math.random().toString(36).slice(2, 10);
  const slideId = `sl${rnd()}`;

  // Step 1: create a blank slide
  const r1 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests: [{ createSlide: { objectId: slideId, insertionIndex: 9999 } }] },
  }, onTokenRefresh);
  if (!r1.ok) {
    const errText = await r1.text().catch(() => '(no body)');
    throw new Error(`Slides addTextSlide (createSlide) ${r1.status}: ${errText}`);
  }

  // Step 2: create TEXT_BOX shapes and insert text in a single batchUpdate.
  // Slide dimensions: 9144000 x 6858000 EMU (10" x 7.5").
  // Title box: full width at top. Body box: full width below title.
  const requests = [];
  if (title) {
    const titleId = `ti${rnd()}`;
    requests.push({
      createShape: {
        objectId: titleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width:  { magnitude: 8229600, unit: 'EMU' },
            height: { magnitude: 1143000, unit: 'EMU' },
          },
          transform: { scaleX: 1, scaleY: 1, translateX: 457200, translateY: 457200, unit: 'EMU' },
        },
      },
    });
    requests.push({ insertText: { objectId: titleId, insertionIndex: 0, text: title } });
  }
  if (body) {
    const bodyId = `bo${rnd()}`;
    requests.push({
      createShape: {
        objectId: bodyId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width:  { magnitude: 8229600, unit: 'EMU' },
            height: { magnitude: 4114800, unit: 'EMU' },
          },
          transform: { scaleX: 1, scaleY: 1, translateX: 457200, translateY: 1828800, unit: 'EMU' },
        },
      },
    });
    requests.push({ insertText: { objectId: bodyId, insertionIndex: 0, text: body } });
  }

  if (requests.length === 0) return;

  const r2 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST', body: { requests },
  }, onTokenRefresh);
  if (!r2.ok) {
    const errText = await r2.text().catch(() => '(no body)');
    throw new Error(`Slides addTextSlide (shapes+text) ${r2.status}: ${errText}`);
  }
  return r2.json();
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
