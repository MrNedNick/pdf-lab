import { describe, expect, it } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { derivedName, merge, rebuild, split } from './write'

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

describe('merging and splitting', () => {
  it('puts documents together in the given order', async () => {
    const out = await PDFDocument.load(
      await merge([{ bytes: await sample([300, 310]) }, { bytes: await sample([400]) }, { bytes: await sample([500]) }]),
    )
    expect(out.getPages().map((page) => page.getWidth())).toEqual([300, 310, 400, 500])
  })

  it('cuts one part per range', async () => {
    const parts = await split(await sample([300, 400, 500, 600]), [
      { from: 1, to: 2 },
      { from: 4, to: 4 },
    ])
    const widths = await Promise.all(
      parts.map(async (part) => (await PDFDocument.load(part)).getPages().map((page) => page.getWidth())),
    )
    expect(widths).toEqual([[300, 400], [600]])
  })
})
