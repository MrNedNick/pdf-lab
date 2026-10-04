/** A part of a document: 1-based, inclusive, as people write page numbers. */
export interface Range {
  from: number
  to: number
}

export type RangeResult =
  | { ok: true; ranges: Range[] }
  | { ok: false; error: string; /** The piece of input that is wrong, to highlight it. */ token: string }

/**
 * Reads "1-3, 5, 8-" against a document of `pages` pages. An open end ("8-")
 * runs to the last page, an open start ("-3") from the first. Every mistake is
 * reported with the exact piece that caused it.
 */
export function parseRanges(input: string, pages: number): RangeResult {
  const tokens = input
    .split(/[,;]/)
    .map((token) => token.trim())
    .filter(Boolean)
  if (!tokens.length) return { ok: false, error: 'Type the pages you want, like 1-3, 5, 8-', token: '' }
  const ranges: Range[] = []
  for (const token of tokens) {
    const match = /^(\d*)\s*[-–—]\s*(\d*)$/.exec(token) ?? /^(\d+)$/.exec(token)
    if (!match) return { ok: false, error: `“${token}” is not a page or a range`, token }
    const single = match.length === 2
    const from = match[1] ? Number(match[1]) : 1
    const to = single ? from : match[2] ? Number(match[2]) : pages
    if (from < 1 || to < 1) return { ok: false, error: 'Pages start at 1', token }
    if (from > pages || to > pages)
      return { ok: false, error: `This PDF has ${pages} ${pages === 1 ? 'page' : 'pages'}`, token }
    if (from > to) return { ok: false, error: `“${token}” runs backwards — try ${to}-${from}`, token }
    ranges.push({ from, to })
  }
  return { ok: true, ranges }
}

/** "1-3" or "5" — for file names and labels. */
export const rangeLabel = (range: Range) => (range.from === range.to ? `${range.from}` : `${range.from}-${range.to}`)

export const everyPage = (pages: number): Range[] => Array.from({ length: pages }, (_, i) => ({ from: i + 1, to: i + 1 }))
