import { describe, expect, it } from 'vitest'
import { everyPage, parseRanges, rangeLabel } from './ranges'

describe('page ranges', () => {
  it('reads single pages, closed and open ranges', () => {
    expect(parseRanges('1-3, 5, 8-', 10)).toEqual({
      ok: true,
      ranges: [
        { from: 1, to: 3 },
        { from: 5, to: 5 },
        { from: 8, to: 10 },
      ],
    })
    expect(parseRanges('-2; 9 – 10', 10)).toEqual({ ok: true, ranges: [{ from: 1, to: 2 }, { from: 9, to: 10 }] })
  })

  it('names the piece that is wrong', () => {
    expect(parseRanges('1-3, abc', 10)).toMatchObject({ ok: false, token: 'abc' })
    expect(parseRanges('2, 12', 10)).toMatchObject({ ok: false, token: '12', error: 'This PDF has 10 pages' })
    expect(parseRanges('7-3', 10)).toMatchObject({ ok: false, token: '7-3', error: expect.stringContaining('3-7') })
    expect(parseRanges('0', 10)).toMatchObject({ ok: false, error: 'Pages start at 1' })
    expect(parseRanges('  ', 10)).toMatchObject({ ok: false })
  })

  it('labels ranges and lists every page', () => {
    expect(rangeLabel({ from: 4, to: 4 })).toBe('4')
    expect(rangeLabel({ from: 1, to: 3 })).toBe('1-3')
    expect(everyPage(3)).toEqual([{ from: 1, to: 1 }, { from: 2, to: 2 }, { from: 3, to: 3 }])
  })
})
