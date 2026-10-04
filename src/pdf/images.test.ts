// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { imagesToPdf, layout } from './images'
import { pixelSize } from './rasterize'
import { crc32 } from '../lib/zip'

/** A solid-colour PNG, built by hand so the test needs no image library. */
async function png(width: number, height: number): Promise<Uint8Array> {
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array([...new TextEncoder().encode(type), ...data])
    const out = new Uint8Array(12 + data.length)
    const view = new DataView(out.buffer)
    view.setUint32(0, data.length)
    out.set(body, 4)
    view.setUint32(8 + data.length, crc32(body))
    return out
  }
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  const rows = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y++) rows.fill(200, y * (1 + width * 3) + 1, (y + 1) * (1 + width * 3))
  const deflated = new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
  return new Uint8Array([
    ...[137, 80, 78, 71, 13, 10, 26, 10],
    ...chunk('IHDR', header),
    ...chunk('IDAT', deflated),
    ...chunk('IEND', new Uint8Array()),
  ])
}

describe('layout', () => {
  const a4 = { paper: 'a4', orientation: 'auto', margin: 'small' } as const

  it('fits a tall phone photo inside A4 margins, centred', () => {
    const { page, box } = layout({ width: 3000, height: 4000 }, a4)
    expect(page).toEqual([595.28, 841.89])
    expect(box.width).toBeCloseTo(595.28 - 2 * 28.35)
    expect(box.y).toBeCloseTo((841.89 - box.height) / 2)
  })

  it('turns the page for a landscape photo unless told otherwise', () => {
    expect(layout({ width: 4000, height: 3000 }, a4).page).toEqual([841.89, 595.28])
    expect(layout({ width: 4000, height: 3000 }, { ...a4, orientation: 'portrait' }).page).toEqual([595.28, 841.89])
  })

  it('"same as image" makes the page the photo at 150 dpi plus margins', () => {
    const { page } = layout({ width: 1500, height: 3000 }, { paper: 'fit', orientation: 'auto', margin: 'none' })
    expect(page).toEqual([720, 1440])
  })
})

describe('imagesToPdf', () => {
  it('makes one page per image in order', async () => {
    const bytes = await imagesToPdf(
      [
        { bytes: await png(40, 30), type: 'png', width: 40, height: 30 },
        { bytes: await png(30, 40), type: 'png', width: 30, height: 40 },
      ],
      { paper: 'a4', orientation: 'auto', margin: 'none' },
    )
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPages().map((page) => Math.round(page.getWidth()))).toEqual([842, 595])
  })
})

describe('pixelSize', () => {
  it('draws A4 at 150 dpi as about 1240 × 1754 pixels', () => {
    expect(pixelSize({ width: 595.28, height: 841.89 }, 150)).toMatchObject({ width: 1240, height: 1753, reduced: false })
  })

  it('shrinks a poster that would not fit in a canvas', () => {
    const size = pixelSize({ width: 2384, height: 3370 }, 300) // A0
    expect(size.reduced).toBe(true)
    expect(size.width * size.height).toBeLessThanOrEqual(36_000_000)
  })
})
