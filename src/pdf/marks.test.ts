// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from '@cantoo/pdf-lib'
import { familyFor, joinRuns, history, emptyHistory, lineAt, replaceLine, thin, type Mark, type TextLine } from './marks'
import { stamp, standardCanWrite, type PageSpace } from './stamp'

const line: TextLine = { text: 'Date: 1 March 2026', x: 72, baseline: 100, width: 140, size: 12, family: 'serif' }

describe('lines', () => {
  it('reads the family from a PDF font name', () => {
    expect(familyFor('ABCDEF+TimesNewRomanPSMT')).toBe('serif')
    expect(familyFor('Helvetica-Bold')).toBe('sans')
    expect(familyFor('NotoSans-Regular')).toBe('sans')
    expect(familyFor('CourierNewPSMT')).toBe('mono')
  })

  it('finds the line under a click, not one far below', () => {
    expect(lineAt([line], 100, 96)).toBe(line)
    expect(lineAt([line], 100, 130)).toBeUndefined()
  })

  it('"edit line" covers the old text and puts the same text on the same baseline', () => {
    let id = 0
    const [cover, text] = replaceLine(line, 3, () => ++id)
    expect(cover).toMatchObject({ kind: 'cover', page: 3, color: '#ffffff' })
    expect(cover.x).toBeLessThan(line.x)
    expect(cover.x + cover.width).toBeGreaterThan(line.x + line.width)
    expect(text).toMatchObject({ kind: 'text', baseline: 100, size: 12, family: 'serif', text: line.text })
  })
})

it('joins pieces of one line and keeps separate lines apart', () => {
  const run = (text: string, x: number, baseline: number, width: number) => ({ text, x, baseline, width, size: 12, family: 'sans' as const })
  const lines = joinRuns([run('2026', 140, 100, 28), run('Date: 1 March', 72, 100, 64), run('Total', 72, 130, 30), run('far right', 400, 100, 50)])
  expect(lines.map((line) => line.text)).toEqual(['Date: 1 March 2026', 'far right', 'Total'])
  expect(lines[0]!.width).toBe(96)
})

describe('history', () => {
  const a: Mark[] = []
  const b: Mark[] = [{ id: 1, page: 1, kind: 'cover', color: '#ffffff', x: 0, y: 0, width: 1, height: 1 }]

  it('undoes and redoes, and a new change drops the redo branch', () => {
    let state = history(emptyHistory, { type: 'commit', marks: b })
    state = history(state, { type: 'undo' })
    expect(state.present).toEqual(a)
    state = history(state, { type: 'redo' })
    expect(state.present).toBe(b)
    state = history(history(state, { type: 'undo' }), { type: 'commit', marks: [] })
    expect(state.future).toEqual([])
  })

  it('does nothing past either end', () => {
    expect(history(emptyHistory, { type: 'undo' })).toBe(emptyHistory)
    expect(history(emptyHistory, { type: 'redo' })).toBe(emptyHistory)
  })
})

it('thins a stroke but keeps its ends', () => {
  const points: [number, number][] = [[0, 0], [0.2, 0], [0.4, 0], [5, 0], [5.1, 0]]
  expect(thin(points)).toEqual([[0, 0], [5, 0], [5.1, 0]])
})

describe('stamp', () => {
  it('knows which text the standard fonts can write', () => {
    expect(standardCanWrite('Café — 2 March, “ok” €5')).toBe(true)
    expect(standardCanWrite('Дата')).toBe(false)
    expect(standardCanWrite('日本')).toBe(false)
  })

  const flat = (height: number): PageSpace => ({ toPdf: (x, y) => [x, height - y], rotation: 0 })
  const noto = () => Promise.resolve(new Uint8Array(readFileSync(new URL('../../public/fonts/NotoSans-Regular.ttf', import.meta.url))))

  it('writes text in a standard font, and Cyrillic with the embedded one', async () => {
    const blank = await PDFDocument.create()
    blank.addPage([595.28, 841.89])
    const marks: Mark[] = [
      { id: 1, page: 1, kind: 'text', color: '#111111', x: 72, baseline: 100, size: 14, family: 'serif', text: 'Signed on 2 March' },
      { id: 2, page: 1, kind: 'text', color: '#111111', x: 72, baseline: 140, size: 14, family: 'sans', text: 'Дата: 2 березня' },
      { id: 3, page: 1, kind: 'ink', color: '#1d4ed8', width: 2, points: [[10, 10], [50, 60], [90, 20]] },
      { id: 4, page: 1, kind: 'highlight', color: '#facc15', x: 70, y: 86, width: 120, height: 18 },
    ]
    const out = await PDFDocument.load(await stamp(await blank.save(), undefined, marks, () => flat(841.89), noto))
    const fonts = out.context.enumerateIndirectObjects().map(([, object]) => String(object)).filter((text) => text.includes('/BaseFont'))
    expect(fonts.join()).toMatch(/Times-Roman/)
    expect(fonts.join()).toMatch(/NotoSans/)
  })
})
