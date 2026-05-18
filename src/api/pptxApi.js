// PowerPoint generation + Drive upload
// Uses PptxGenJS to build a .pptx in the browser, then uploads via Drive multipart API.
// No Google Slides API involved — only Drive write access is required.

import PptxGenJS from 'pptxgenjs';
import { driveUploadFile } from './driveApi.js';

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// ── Template registry ─────────────────────────────────────────────────────────
//
// Each template exposes two functions:
//   addCover(pptx, title, subtitle) — cover/title slide (slides[0])
//   addContent(pptx, title, body)  — content slides (slides[1..n])
//
// Available templates: dark-slate (default), clean-white, corporate-blue, slate-grey
//
// Slide canvas: LAYOUT_WIDE = 10" × 5.625" (16:9)

const TEMPLATES = {

  // ── Dark Slate ──────────────────────────────────────────────────────────────
  // Navy cover with blue accent rule; near-white content slides with dark title bar.
  'dark-slate': {
    addCover(pptx, title, subtitle) {
      const s = pptx.addSlide();
      s.background = { color: '1E2235' };
      s.addText(title || '', {
        x: 0.6, y: 1.1, w: 8.8, h: 1.8,
        fontSize: 34, bold: true, color: 'FFFFFF',
        fontFace: 'Calibri', wrap: true, valign: 'bottom', align: 'left',
      });
      // Accent rule
      s.addText('', {
        x: 0.6, y: 3.05, w: 8.8, h: 0.06,
        fill: { color: '4A6FA5' }, line: { color: '4A6FA5', width: 0 },
      });
      if (subtitle) {
        s.addText(subtitle, {
          x: 0.6, y: 3.2, w: 8.8, h: 2.0,
          fontSize: 14, color: 'B8C1CC',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
    addContent(pptx, title, body) {
      const s = pptx.addSlide();
      s.background = { color: 'F4F5F7' };
      s.addText(title || '', {
        x: 0, y: 0, w: 10, h: 1.25,
        fill: { color: '2D3142' }, line: { color: '2D3142', width: 0 },
        fontSize: 22, bold: true, color: 'FFFFFF',
        fontFace: 'Calibri', wrap: true, valign: 'middle', margin: 0.3, align: 'left',
      });
      if (body) {
        s.addText(body, {
          x: 0.5, y: 1.45, w: 9.0, h: 3.8,
          fontSize: 13, color: '2D3142',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
  },

  // ── Clean White ─────────────────────────────────────────────────────────────
  // All-white slides with a bright-blue top strip and minimal accent lines.
  // Professional and modern; works well for data-heavy or text-light decks.
  'clean-white': {
    addCover(pptx, title, subtitle) {
      const s = pptx.addSlide();
      s.background = { color: 'FFFFFF' };
      // Blue top strip
      s.addText('', {
        x: 0, y: 0, w: 10, h: 0.18,
        fill: { color: '2563EB' }, line: { color: '2563EB', width: 0 },
      });
      s.addText(title || '', {
        x: 0.7, y: 1.1, w: 8.6, h: 1.8,
        fontSize: 36, bold: true, color: '111827',
        fontFace: 'Calibri', wrap: true, valign: 'bottom', align: 'left',
      });
      // Short accent rule under title
      s.addText('', {
        x: 0.7, y: 3.05, w: 2.8, h: 0.06,
        fill: { color: '2563EB' }, line: { color: '2563EB', width: 0 },
      });
      if (subtitle) {
        s.addText(subtitle, {
          x: 0.7, y: 3.25, w: 8.6, h: 2.0,
          fontSize: 14, color: '6B7280',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
    addContent(pptx, title, body) {
      const s = pptx.addSlide();
      s.background = { color: 'FFFFFF' };
      // Blue top strip
      s.addText('', {
        x: 0, y: 0, w: 10, h: 0.12,
        fill: { color: '2563EB' }, line: { color: '2563EB', width: 0 },
      });
      s.addText(title || '', {
        x: 0.5, y: 0.22, w: 9.0, h: 0.85,
        fontSize: 24, bold: true, color: '111827',
        fontFace: 'Calibri', wrap: true, valign: 'middle', align: 'left',
      });
      // Hairline divider under title
      s.addText('', {
        x: 0.5, y: 1.12, w: 9.0, h: 0.04,
        fill: { color: 'E5E7EB' }, line: { color: 'E5E7EB', width: 0 },
      });
      if (body) {
        s.addText(body, {
          x: 0.5, y: 1.28, w: 9.0, h: 4.0,
          fontSize: 13, color: '374151',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
  },

  // ── Corporate Blue ──────────────────────────────────────────────────────────
  // Deep navy cover with a gold accent; white content slides with navy title bar
  // and a gold accent stripe beneath it. Classic enterprise look.
  'corporate-blue': {
    addCover(pptx, title, subtitle) {
      const s = pptx.addSlide();
      s.background = { color: '0A2D6E' };
      // Gold top stripe
      s.addText('', {
        x: 0, y: 0, w: 10, h: 0.14,
        fill: { color: 'C9A84C' }, line: { color: 'C9A84C', width: 0 },
      });
      s.addText(title || '', {
        x: 0.7, y: 1.1, w: 8.6, h: 1.8,
        fontSize: 34, bold: true, color: 'FFFFFF',
        fontFace: 'Calibri', wrap: true, valign: 'bottom', align: 'left',
      });
      // Gold accent rule under title
      s.addText('', {
        x: 0.7, y: 3.05, w: 3.2, h: 0.06,
        fill: { color: 'C9A84C' }, line: { color: 'C9A84C', width: 0 },
      });
      if (subtitle) {
        s.addText(subtitle, {
          x: 0.7, y: 3.25, w: 8.6, h: 2.0,
          fontSize: 14, color: 'B8CCE4',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
    addContent(pptx, title, body) {
      const s = pptx.addSlide();
      s.background = { color: 'FFFFFF' };
      // Navy title bar
      s.addText(title || '', {
        x: 0, y: 0, w: 10, h: 1.2,
        fill: { color: '0A2D6E' }, line: { color: '0A2D6E', width: 0 },
        fontSize: 22, bold: true, color: 'FFFFFF',
        fontFace: 'Calibri', wrap: true, valign: 'middle', margin: 0.35, align: 'left',
      });
      // Gold accent stripe beneath title bar
      s.addText('', {
        x: 0, y: 1.2, w: 10, h: 0.07,
        fill: { color: 'C9A84C' }, line: { color: 'C9A84C', width: 0 },
      });
      if (body) {
        s.addText(body, {
          x: 0.5, y: 1.42, w: 9.0, h: 3.85,
          fontSize: 13, color: '1F2937',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
  },

  // ── Slate Grey ──────────────────────────────────────────────────────────────
  // Charcoal cover with a cool-grey accent; very light grey content slides with
  // a mid-grey title bar. Neutral and clean; suits internal or technical decks.
  'slate-grey': {
    addCover(pptx, title, subtitle) {
      const s = pptx.addSlide();
      s.background = { color: '2C2C2C' };
      // Grey top strip
      s.addText('', {
        x: 0, y: 0, w: 10, h: 0.14,
        fill: { color: '9CA3AF' }, line: { color: '9CA3AF', width: 0 },
      });
      s.addText(title || '', {
        x: 0.7, y: 1.1, w: 8.6, h: 1.8,
        fontSize: 34, bold: true, color: 'FFFFFF',
        fontFace: 'Calibri', wrap: true, valign: 'bottom', align: 'left',
      });
      // Mid-grey accent rule
      s.addText('', {
        x: 0.7, y: 3.05, w: 8.6, h: 0.05,
        fill: { color: '6B7280' }, line: { color: '6B7280', width: 0 },
      });
      if (subtitle) {
        s.addText(subtitle, {
          x: 0.7, y: 3.25, w: 8.6, h: 2.0,
          fontSize: 14, color: 'D1D5DB',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
    addContent(pptx, title, body) {
      const s = pptx.addSlide();
      s.background = { color: 'F3F4F6' };
      s.addText(title || '', {
        x: 0, y: 0, w: 10, h: 1.25,
        fill: { color: '374151' }, line: { color: '374151', width: 0 },
        fontSize: 22, bold: true, color: 'FFFFFF',
        fontFace: 'Calibri', wrap: true, valign: 'middle', margin: 0.3, align: 'left',
      });
      if (body) {
        s.addText(body, {
          x: 0.5, y: 1.45, w: 9.0, h: 3.8,
          fontSize: 13, color: '1F2937',
          fontFace: 'Calibri', wrap: true, valign: 'top', align: 'left',
        });
      }
    },
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

// Build and upload a PowerPoint presentation to Google Drive.
//
// slides: Array<{ title: string, body?: string }>
//   slides[0] is rendered as the cover slide.
//   slides[1..n] are content slides.
// theme: one of 'dark-slate' (default), 'clean-white', 'corporate-blue', 'slate-grey'
// Returns { fileId, fileName, webViewLink, mimeType }
export async function createAndUploadPptx({
  token,
  title = 'Presentation',
  slides = [],
  folderId,
  theme = 'dark-slate',
  onTokenRefresh,
} = {}) {
  const tmpl = TEMPLATES[theme] || TEMPLATES['dark-slate'];
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 16:9, 10" x 5.625"

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (i === 0) {
      tmpl.addCover(pptx, slide.title || title, slide.body || '');
    } else {
      tmpl.addContent(pptx, slide.title, slide.body);
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
