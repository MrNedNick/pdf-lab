import { describe, expect, it } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { derivedName, rebuild } from './write'

/** Pages of different widths, so their order can be read back without text extraction. */
async function sample(widths: number[]) {
  const doc = await PDFDocument.create()
  for (const width of widths) doc.addPage([width, 800])
  return doc.save()
}

describe('rebuilding a document', () => {
  it('keeps the chosen pages in the chosen order', async () => {
    const out = await PDFDocument.load(
      await rebuild(await sample([300, 400, 500]), [
        { source: 2, rotation: 0 },
        { source: 0, rotation: 0 },
      ]),
    )
    expect(out.getPages().map((page) => page.getWidth())).toEqual([500, 300])
  })

  it('adds rotation on top of what the page already had', async () => {
    const first = await rebuild(await sample([300]), [{ source: 0, rotation: 90 }])
    const second = await rebuild(first, [{ source: 0, rotation: 270 }])
    expect((await PDFDocument.load(first)).getPage(0).getRotation().angle).toBe(90)
    expect((await PDFDocument.load(second)).getPage(0).getRotation().angle).toBe(0)
  })

  it('names the result after the original', () => {
    expect(derivedName('Report.PDF', 'organized')).toBe('Report-organized.pdf')
  })
})
