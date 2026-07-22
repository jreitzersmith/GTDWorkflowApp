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

async function slidesGetPresentation({ token, presentationId, onTokenRefresh } = {}) {
  const res = await slidesRequest(`${SLIDES_BASE}/${presentationId}`, { token }, onTokenRefresh);
  if (!res.ok) throw new Error(`Slides get failed: ${res.status}`);
  return res.json();
}

// -- Create -------------------------------------------------------------------

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
// createShape and insertText are in SEPARATE batchUpdate calls — the Slides API
// requires the shape to be fully committed before text can be inserted.
// AffineTransform requires all 7 fields including shearX/shearY.
// Slide dimensions: 9144000 x 6858000 EMU (10" x 7.5").
// insertionIndex is omitted so the API always appends to the end (avoids
// out-of-range errors on presentations with few slides).
// The objectIds returned by the createShape reply are used for insertText
// rather than the requested IDs, in case the API remaps them.
async function slidesAddTextSlide({
  token,
  presentationId,
  title = '',
  body  = '',
  onTokenRefresh,
} = {}) {
  const rnd = () => Math.random().toString(36).slice(2, 10);
  const slideId   = `sl${rnd()}`;
  const reqTitleId = title ? `ti${rnd()}` : null;
  const reqBodyId  = body  ? `bo${rnd()}` : null;

  // Step 1: create a blank slide — no insertionIndex means append to end
  const r1 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests: [{ createSlide: { objectId: slideId } }] },
  }, onTokenRefresh);
  if (!r1.ok) {
    const t = await r1.text().catch(() => '(no body)');
    throw new Error(`Slides createSlide ${r1.status}: ${t}`);
  }

  if (!reqTitleId && !reqBodyId) return;

  // Step 2: create TEXT_BOX shapes — separate call from text insertion
  const shapeRequests = [];
  if (reqTitleId) {
    shapeRequests.push({
      createShape: {
        objectId: reqTitleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 8229600, unit: 'EMU' }, height: { magnitude: 1143000, unit: 'EMU' } },
          transform: { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: 457200, translateY: 457200, unit: 'EMU' },
        },
      },
    });
  }
  if (reqBodyId) {
    shapeRequests.push({
      createShape: {
        objectId: reqBodyId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 8229600, unit: 'EMU' }, height: { magnitude: 4114800, unit: 'EMU' } },
          transform: { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: 457200, translateY: 1828800, unit: 'EMU' },
        },
      },
    });
  }

  const r2 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST', body: { requests: shapeRequests },
  }, onTokenRefresh);
  if (!r2.ok) {
    const t = await r2.text().catch(() => '(no body)');
    throw new Error(`Slides createShapes ${r2.status}: ${t}`);
  }

  // Use objectIds from the API response — in case they differ from requested
  const r2data = await r2.json();
  const replies = r2data.replies || [];
  let ri = 0;
  const titleId = reqTitleId ? (replies[ri++]?.createShape?.objectId || reqTitleId) : null;
  const bodyId  = reqBodyId  ? (replies[ri++]?.createShape?.objectId || reqBodyId)  : null;

  // Step 3: insert text into the committed shapes — separate batchUpdate
  const textRequests = [];
  if (titleId && title) textRequests.push({ insertText: { objectId: titleId, insertionIndex: 0, text: title } });
  if (bodyId  && body)  textRequests.push({ insertText: { objectId: bodyId,  insertionIndex: 0, text: body  } });

  if (textRequests.length === 0) return;

  const r3 = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST', body: { requests: textRequests },
  }, onTokenRefresh);
  if (!r3.ok) {
    const t = await r3.text().catch(() => '(no body)');
    throw new Error(`Slides insertText ${r3.status}: ${t}`);
  }
  return r3.json();
}

// Send an arbitrary batchUpdate requests array for advanced modifications.
async function slidesBatchUpdate({ token, presentationId, requests, onTokenRefresh } = {}) {
  const res = await slidesRequest(`${SLIDES_BASE}/${presentationId}:batchUpdate`, {
    token, method: 'POST',
    body: { requests },
  }, onTokenRefresh);
  if (!res.ok) throw new Error(`Slides batchUpdate failed: ${res.status}`);
  return res.json();
}

// -- Move ---------------------------------------------------------------------

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
