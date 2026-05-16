// PowerPoint generation + Drive upload
// Uses PptxGenJS to build a .pptx in the browser, then uploads via Drive multipart API.
// No Google Slides API involved — only Drive write access is required.

import PptxGenJS from 'pptxgenjs';
import { driveUploadFile } from './driveApi.js';

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// Build and upload a PowerPoint presentation to Google Drive.
//
// slides: Array<{ title: string, body?: string }>
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

  for (const slide of slides) {
    const s = pptx.addSlide();

    if (slide.title) {
      s.addText(slide.title, {
        x: 0.5, y: 0.4, w: 9.0, h: 1.1,
        fontSize: 24, bold: true, color: '363636',
        wrap: true,
      });
    }

    if (slide.body) {
      s.addText(slide.body, {
        x: 0.5, y: 1.65, w: 9.0, h: 3.75,
        fontSize: 13, color: '4a4a4a',
        wrap: true, valign: 'top',
      });
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
