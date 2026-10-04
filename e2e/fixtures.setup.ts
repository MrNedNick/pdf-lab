import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'

/** Test files are generated, not committed: a long document, a locked one, a broken one and two small ones to merge. */
export const FIXTURES = new URL('../test-results/fixtures/', import.meta.url).pathname

async function numbered(pages: number, size: [number, number] = [595, 842], prefix = 'Page') {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let n = 1; n <= pages; n++) {
    const page = doc.addPage(size)
    page.drawRectangle({ x: 40, y: 40, width: size[0] - 80, height: size[1] - 80, borderColor: rgb(0.2, 0.4, 0.9), borderWidth: 2 })
    page.drawText(`${prefix} ${n}`, { x: 60, y: size[1] - 100, size: 36, font, color: rgb(0.1, 0.1, 0.15) })
  }
  return doc
}

export default async function setup() {
  if (existsSync(FIXTURES + 'beta.pdf')) return
  mkdirSync(FIXTURES, { recursive: true })
  writeFileSync(FIXTURES + 'long-200.pdf', await (await numbered(200)).save())
  writeFileSync(FIXTURES + 'three.pdf', await (await numbered(3)).save())
  const locked = await numbered(2)
  locked.encrypt({ userPassword: 'open sesame', ownerPassword: 'owner' })
  writeFileSync(FIXTURES + 'locked.pdf', await locked.save())
  writeFileSync(FIXTURES + 'alpha.pdf', await (await numbered(2, [595, 842], 'Alpha')).save())
  writeFileSync(FIXTURES + 'beta.pdf', await (await numbered(1, [842, 595], 'Beta')).save())
  writeFileSync(FIXTURES + 'broken.pdf', 'This is a text file pretending to be a PDF.')
}
