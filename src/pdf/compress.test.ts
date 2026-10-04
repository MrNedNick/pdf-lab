import { describe, expect, it } from 'vitest'
import { canRecompress, formatSize, targetSize, verdictFor } from './compress'

describe('canRecompress', () => {
  it('takes JPEGs and 8-bit RGB or grey pixels', () => {
    expect(canRecompress({ filters: ['DCTDecode'], colorComponents: 3 })).toBe('jpeg')
    expect(canRecompress({ filters: ['FlateDecode'], bitsPerComponent: 8, colorComponents: 1 })).toBe('pixels')
  })

  it('leaves CMYK, masks, inverted and 1-bit images alone', () => {
    expect(canRecompress({ filters: ['DCTDecode'], colorComponents: 4 })).toBeNull()
    expect(canRecompress({ filters: ['FlateDecode'], bitsPerComponent: 1, colorComponents: 1 })).toBeNull()
    expect(canRecompress({ filters: ['DCTDecode'], colorComponents: 3, hasDecode: true })).toBeNull()
    expect(canRecompress({ filters: ['CCITTFaxDecode'], colorComponents: 1 })).toBeNull()
    expect(canRecompress({ filters: [], imageMask: true, colorComponents: 1 })).toBeNull()
  })
})

it('shrinks to the longest side and never enlarges', () => {
  expect(targetSize(2480, 3508, 2000)).toEqual({ width: 1414, height: 2000 })
  expect(targetSize(800, 600, 2000)).toEqual({ width: 800, height: 600 })
})

it('writes sizes the way people read them', () => {
  expect([formatSize(900), formatSize(48_000), formatSize(4_800_000)]).toEqual(['900 B', '47 KB', '4.6 MB'])
})

describe('verdictFor', () => {
  it('offers a file only for a real saving, and says why otherwise', () => {
    expect(verdictFor({ before: 100, after: 40, images: 3, replaced: 3 }, 'balanced')).toEqual({ worthIt: true })
    expect(verdictFor({ before: 100, after: 99, images: 0, replaced: 0 }, 'balanced')).toMatchObject({ reason: expect.stringContaining('no pictures') })
    expect(verdictFor({ before: 100, after: 99, images: 2, replaced: 0 }, 'balanced')).toMatchObject({ reason: expect.stringContaining('already compressed') })
  })

  it('suggests Strong only when it is not already the choice', () => {
    const small = { before: 100, after: 93, images: 1, replaced: 1 }
    expect(verdictFor(small, 'balanced')).toMatchObject({ reason: expect.stringContaining('try Strong') })
    expect(verdictFor(small, 'strong')).toMatchObject({ reason: expect.not.stringContaining('Strong') })
  })
})
