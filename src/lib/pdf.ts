// Client-side PDF text extraction for official DECA roleplay PDFs.
//
// Uses pdf.js entirely in the browser: the PDF never leaves the user's machine —
// only the extracted TEXT is sent to /api/generate-scenario for structuring.
// This module is heavy (~300 kB), so it is only ever loaded via dynamic
// `import()` from the landing page when the user actually picks a file.

import * as pdfjs from 'pdfjs-dist'

// Vite resolves this to a hashed asset URL and bundles the worker.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

/** Thrown when the file can't be read as a usable roleplay document. */
export class PdfReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfReadError'
  }
}

// Official roleplays are 2-4 pages; anything beyond this is not a roleplay.
const MAX_PAGES = 12
// Server-side cap is 24k chars; trim client-side so the request stays small.
export const MAX_SOURCE_CHARS = 24_000

/**
 * Extract the plain text of a PDF file, page by page, reading order preserved
 * well enough for an LLM to re-structure it.
 *
 * @throws PdfReadError with a display-ready message on any failure.
 */
export const extractPdfText = async (file: File): Promise<string> => {
  let task: ReturnType<typeof pdfjs.getDocument>
  let doc: pdfjs.PDFDocumentProxy
  try {
    const data = await file.arrayBuffer()
    task = pdfjs.getDocument({ data })
    doc = await task.promise
  } catch {
    throw new PdfReadError(
      "Couldn't read that file as a PDF. Make sure it's the event PDF itself, not a scan inside a zip."
    )
  }

  try {
    const pages = Math.min(doc.numPages, MAX_PAGES)
    const chunks: string[] = []
    for (let i = 1; i <= pages; i += 1) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      chunks.push(text)
    }
    const combined = chunks.join('\n\n').replace(/\s+/g, ' ').trim()
    if (combined.length < 200) {
      throw new PdfReadError(
        'That PDF has almost no selectable text — it may be a scanned image. Try the digital event PDF.'
      )
    }
    return combined.slice(0, MAX_SOURCE_CHARS)
  } finally {
    void task.destroy()
  }
}
