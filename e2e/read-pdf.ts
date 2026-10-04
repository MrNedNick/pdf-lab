import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Download } from '@playwright/test'

/** Text, rotation, size in points and image count of every page of a downloaded PDF, read with pdf.js in Node. */
export async function readPdf(download: Download) {
  const chunks: Buffer[] = []
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk))
  const doc = await getDocument({ data: new Uint8Array(Buffer.concat(chunks)) }).promise
  const pages = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const text = (await page.getTextContent()).items.map((item) => ('str' in item ? item.str : '')).join(' ').trim()
    const { width, height } = page.getViewport({ scale: 1, rotation: 0 })
    const images = (await page.getOperatorList()).fnArray.filter((fn) => fn === OPS.paintImageXObject).length
    pages.push({ text, rotation: page.rotate, width: Math.round(width), height: Math.round(height), images })
  }
  return pages
}
