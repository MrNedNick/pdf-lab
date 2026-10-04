import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Download } from '@playwright/test'

/** Text and rotation of every page of a downloaded PDF, read with pdf.js in Node. */
export async function readPdf(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk))
  const doc = await getDocument({ data: new Uint8Array(Buffer.concat(chunks)) }).promise
  const pages = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const text = (await page.getTextContent()).items.map((item) => ('str' in item ? item.str : '')).join(' ').trim()
    pages.push({ text, rotation: page.rotate })
  }
  return pages
}
