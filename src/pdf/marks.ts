/**
 * Marks drawn over pages. Coordinates are PDF points in the page as it is
 * shown (rotation applied), measured from the top-left corner — the same space
 * as a pdf.js viewport at scale 1. They are converted to the file's own space
 * only when saving.
 */
export type Family = 'sans' | 'serif' | 'mono'

interface Base {
  id: number
  /** 1-based. */
  page: number
  color: string
}

export interface TextMark extends Base {
  kind: 'text'
  x: number
  /** First line's baseline, from the top. */
  baseline: number
  size: number
  family: Family
  text: string
}

export interface BoxMark extends Base {
  kind: 'cover' | 'highlight' | 'rect' | 'ellipse'
  x: number
  y: number
  width: number
  height: number
}

export interface LineMark extends Base {
  kind: 'line' | 'ink'
  points: [number, number][]
  width: number
}

/** A signature or other picture, as a PNG data URL. */
export interface ImageMark extends Base {
  kind: 'image'
  x: number
  y: number
  width: number
  height: number
  src: string
}

export type Mark = TextMark | BoxMark | LineMark | ImageMark

/**
 * Where the first baseline sits in a CSS line box of `LINE_HEIGHT`, as a share
 * of the font size, for the fonts the browser shows and the PDF embeds.
 */
export const LINE_HEIGHT = 1.2
export const BASELINE: Record<Family, number> = { sans: 0.947, serif: 0.937, mono: 0.866 }
export const CSS_FONT: Record<Family, string> = {
  sans: 'Helvetica, Arial, "Noto Sans", sans-serif',
  serif: '"Times New Roman", Times, serif',
  mono: '"Courier New", Courier, monospace',
}

/** A PDF's font name, like "ABCDEF+TimesNewRomanPSMT", to the closest family we can write with. */
export function familyFor(fontName: string): Family {
  if (/courier|mono|consol|menlo/i.test(fontName)) return 'mono'
  if (/times|serif|roman|georgia|garamond|cambria|minion|book/i.test(fontName) && !/sans/i.test(fontName)) return 'serif'
  return 'sans'
}

/** A run of text on a page, as pdf.js reports it, in view space. */
export interface TextLine {
  text: string
  x: number
  baseline: number
  width: number
  size: number
  family: Family
}

/** The line under a click, with a little slack around it. */
export function lineAt(lines: TextLine[], x: number, y: number): TextLine | undefined {
  return lines.find((line) => {
    const top = line.baseline - line.size * 0.9
    const bottom = line.baseline + line.size * 0.25
    return x >= line.x - 2 && x <= line.x + line.width + 2 && y >= top - 2 && y <= bottom + 2
  })
}

/**
 * "Edit line": a white box over the old text and new text on the same
 * baseline, at the same size, in the nearest family — ready to retype.
 */
export function replaceLine(line: TextLine, page: number, nextId: () => number): [BoxMark, TextMark] {
  const pad = line.size * 0.15
  return [
    {
      id: nextId(),
      page,
      kind: 'cover',
      color: '#ffffff',
      x: line.x - pad,
      y: line.baseline - line.size * 0.95,
      width: line.width + 2 * pad,
      height: line.size * 1.25,
    },
    {
      id: nextId(),
      page,
      kind: 'text',
      color: '#111111',
      x: line.x,
      baseline: line.baseline,
      size: line.size,
      family: line.family,
      text: line.text,
    },
  ]
}

/** Undo and redo over whole states: every change is one step back. */
export interface History {
  past: Mark[][]
  present: Mark[]
  future: Mark[][]
}

export const emptyHistory: History = { past: [], present: [], future: [] }

export type HistoryAction =
  | { type: 'commit'; marks: Mark[] }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' }

export function history(state: History, action: HistoryAction): History {
  switch (action.type) {
    case 'commit':
      if (action.marks === state.present) return state
      return { past: [...state.past, state.present].slice(-100), present: action.marks, future: [] }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: [...state.past, state.present], present: next, future: rest }
    }
    case 'reset':
      return emptyHistory
  }
}

/** Two corners of a drag to a box with a positive size. */
export function boxFrom([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
}

/** Fewer points for a hand-drawn stroke: drops those closer than `min` to the last kept one. */
export function thin(points: [number, number][], min = 1.5): [number, number][] {
  const kept: [number, number][] = []
  for (const point of points) {
    const last = kept.at(-1)
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= min) kept.push(point)
  }
  const end = points.at(-1)
  if (end && kept.at(-1) !== end) kept.push(end)
  return kept
}

/** A piece of text as pdf.js reports it, already moved into view space. */
export type TextRun = TextLine

/**
 * pdf.js hands out text in pieces — a word, half a line. Pieces on the same
 * baseline with only a small gap between them are one line to a person.
 */
export function joinRuns(runs: TextRun[]): TextLine[] {
  const sorted = runs.filter((run) => run.text.trim()).sort((a, b) => a.baseline - b.baseline || a.x - b.x)
  const lines: TextLine[] = []
  for (const run of sorted) {
    const last = lines.at(-1)
    const gap = last ? run.x - (last.x + last.width) : Infinity
    if (last && Math.abs(run.baseline - last.baseline) < last.size * 0.3 && gap > -last.size && gap < last.size * 1.5) {
      last.text += (gap > last.size * 0.15 && !last.text.endsWith(' ') && !run.text.startsWith(' ') ? ' ' : '') + run.text
      last.width = run.x + run.width - last.x
    } else lines.push({ ...run })
  }
  return lines
}
