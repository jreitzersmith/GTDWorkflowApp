// Google Slides API v1 — utility functions
// All functions accept { token, onTokenRefresh? } and throw on non-OK responses.
//
// Note: The Slides API batchUpdate uses EMU (English Metric Units) for sizes.
// 1 inch = 914400 EMU. A standard 10" × 7.5" slide = 9144000 × 6858000 EMU.

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

// ── Read ──────────────────────────────────────────────────────────────────────

// Get a presentation's full resource (title, slides, page elements).
async function slidesGetPresentation({ token, presentationId, onTokenRefresh } = {}) {
  const res = await slidesRequest(`${SLIDES_BASE}/${presentationId}`, { token }, onTokenRefresh);
  if (!res.ok) throw new Error(`Slides get failed: ${res.status}`);
  return res.json();
}

// ── Create ────────────────────────────────────────────────────────────────────

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

// ── Modify ────────────────────────────────────────────────────────────────────

// Add a new "Title and Body" slide with text content.
// Appends to the end of the presentation.
// Returns the batchUpdate response (includes updatedObjectIds).
async function slidesAddTextSlide({
  token,
  presentationId,
  title = '',
  body  = '',
  onTokenRefresh,
} = {}) {
  const rnd = () => Math.random().toString(36).slice(2, 8);
  const slideId = `s_${Date.now()}_${rnd()}`;
  const titleId = `t_${Date.now()}_${rnd()}`;
  const bodyId  = `b_${Date.now()}_${rnd()}`;

  const EMU = (inches) => Math.round(inches * 914400);

  // Step 1: create the slide (BLANK — avoid placeholder conflicts with shape creation)
  const createRes = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: {
      requests: [
        {
          createSlide: {
            objectId: slideId,
            insertionIndex: 9999,
            slideLayoutReference: { predefinedLayout: 'BLANK' },
          },
        },
      ],
    },
  }, onTokenRefresh);
  if (!createRes.ok) throw new Error(`Slides addTextSlide (create) failed: ${createRes.status}`);

  // Step 2: add text boxes with content in a separate batchUpdate
  const textRequests = [
    {
      createShape: {
        objectId: titleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width:  { magnitude: EMU(9), unit: 'EMU' },
            height: { magnitude: EMU(1), unit: 'EMU' },
          },
          transform: { scaleX: 1, scaleY: 1, translateX: EMU(0.5), translateY: EMU(0.3), unit: 'EMU' },
        },
      },
    },
    ...(title ? [{ insertText: { objectId: titleId, text: title } }] : []),
    {
      createShape: {
        objectId: bodyId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width:  { magnitude: EMU(9),   unit: 'EMU' },
            height: { magnitude: EMU(5.5), unit: 'EMU' },
          },
          transform: { scaleX: 1, scaleY: 1, translateX: EMU(0.5), translateY: EMU(1.5), unit: 'EMU' },
        },
      },
    },
    ...(body ? [{ insertText: { objectId: bodyId, text: body } }] : []),
  ];

  const textRes = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests: textRequests },
  }, onTokenRefresh);
  if (!textRes.ok) throw new Error(`Slides addTextSlide (text) failed: ${textRes.status}`);
  return textRes.json();
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

// ── Move ──────────────────────────────────────────────────────────────────────

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
