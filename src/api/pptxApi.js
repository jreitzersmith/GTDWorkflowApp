// PowerPoint generation + Drive upload
// Uses PptxGenJS to build a .pptx in the browser, then uploads via Drive multipart API.
// No Google Slides API involved — only Drive write access is required.

import PptxGenJS from 'pptxgenjs';
import { driveUploadFile } from './driveApi.js';

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// ── Dark slate palette ────────────────────────────────────────────────────────
const DARK_BG    = '1E2235';  // cover slide background (dark navy)
const TITLE_BAR  = '2D3142';  // content slide title bar
const WHITE      = 'FFFFFF';  // text on dark backgrounds
const LIGHT_TEXT = 'B8C1CC';  // secondary text on cover
const BODY_BG    = 'F4F5F7';  // content slide background (near-white)
const BODY_TEXT  = '2D3142';  // body text on light background
const FONT       = 'Calibri';

// ── Slide builders ────────────────────────────────────────────────────────────

// First slide: full dark background, large centered title, optional subtitle.
function addCoverSlide(pptx, title, subtitle) {
  const s = pptx.addSlide();
  s.background = { color: DARK_BG };

  s.addText(title || '', {
    x: 0.6, y: 1.1, w: 8.8, h: 1.6,
    fontSize: 34, bold: true, color: WHITE,
    fontFace: FONT, wrap: true, valign: 'bottom',
    align: 'left',
  });

  // Thin accent rule
  s.addText('', {
    x: 0.6, y: 2.85, w: 8.8, h: 0.05,
    fill: { color: '4A6FA5' },
    line: { color: '4A6FA5', width: 0 },
  });

  if (subtitle) {
    s.addText(subtitle, {
      x: 0.6, y: 3.0, w: 8.8, h: 2.0,
      fontSize: 14, color: LIGHT_TEXT,
      fontFace: FONT, wrap: true, valign: 'top',
      align: 'left',
    });
  }
}

// Subsequent slides: light background, dark title bar at top, body text below.
function addContentSlide(pptx, title, body) {
  const s = pptx.addSlide();
  s.background = { color: BODY_BG };

  // Title bar — filled text box spanning full width
  s.addText(title || '', {
    x: 0, y: 0, w: 10, h: 1.25,
    fill: { color: TITLE_BAR },
    line: { color: TITLE_BAR, width: 0 },
    fontSize: 22, bold: true, color: WHITE,
    fontFace: FONT, wrap: true, valign: 'middle',
    margin: 0.3, align: 'left',
  });

  if (body) {
    s.addText(body, {
      x: 0.5, y: 1.45, w: 9.0, h: 3.8,
      fontSize: 13, color: BODY_TEXT,
      fontFace: FONT, wrap: true, valign: 'top',
      align: 'left',
    });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

// Build and upload a PowerPoint presentation to Google Drive.
//
// slides: Array<{ title: string, body?: string }>
//   slides[0] is rendered as the cover slide (dark full-bleed background).
//   slides[1..n] are content slides (light background + dark title bar).
// Returns { fileId, fileName, webViewLink, mimeType }
export async function createAndUploadPptx({
  token,
  title = 'Presentation',
  slides = [],
  folderId,
  onTokenRefresh,
} = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 16:9, 10" x 5.625"

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (i === 0) {
      addCoverSlide(pptx, slide.title || title, slide.body || '');
    } else {
      addContentSlide(pptx, slide.title, slide.body);
    }
  }

  const buffer = await pptx.write({ outputType: 'arraybuffer' });
  const fileName = title.endsWith('.pptx') ? title : `${title}.pptx`;

  const file = await driveUploadFile({
    token,
    name: fileName,
    mimeType: PPTX_MIME,
    content: buffer,
    parents: folderId ? [folderId] : [],
    onTokenRefresh,
  });

  return {
    fileId: file.id,
    fileName: file.name,
    webViewLink: file.webViewLink,
    mimeType: PPTX_MIME,
  };
}
