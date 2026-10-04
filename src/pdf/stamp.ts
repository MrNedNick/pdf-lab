import { BlendMode, degrees, LineCapStyle, rgb, StandardFonts, type PDFFont } from '@cantoo/pdf-lib'
import { LINE_HEIGHT, type Family, type Mark } from './marks'
import { loadForWriting } from './write'

/** How a page's view space (top-left, rotation applied) maps onto the file. */
export interface PageSpace {
  toPdf: (x: number, y: number) => [number, number]
  /** The page's own /Rotate, so text stays upright as seen. */
  rotation: number
}

const STANDARD: Record<Family, StandardFonts> = {
  sans: StandardFonts.Helvetica,
  serif: StandardFonts.TimesRoman,
  mono: StandardFonts.Courier,
}

function color(hex: string) {
  const value = parseInt(hex.slice(1), 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

/** Characters of WinAnsi above Latin-1's printable range, the only ones the standard fonts carry. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

/**
 * True when the standard PDF fonts can write it; Cyrillic, Greek and the rest
 * need an embedded font. Checked by hand: the library quietly writes "?" for
 * anything it cannot encode instead of failing.
 */
export function standardCanWrite(text: string) {
  for (const char of text) {
    const code = char.codePointAt(0)!
    if (char === '\n' || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(char)) continue
    return false
  }
  return true
}

/**
 * Draws the marks into the file. Text in the standard fonts stays real text;
 * text they cannot write switches to Noto Sans, embedded as a subset.
 */
export async function stamp(
  bytes: Uint8Array,
  password: string | undefined,
  marks: Mark[],
  spaceOf: (page: number) => PageSpace,
  loadUnicodeFont: () => Promise<ArrayBuffer | Uint8Array>,
): Promise<Uint8Array> {
  const doc = await loadForWriting(bytes, password)
  const fonts = new Map<string, PDFFont>()
  const fontFor = async (family: Family, text: string) => {
    const standard = fonts.get(family) ?? (await doc.embedFont(STANDARD[family]))
    fonts.set(family, standard)
    if (standardCanWrite(text)) return standard
    let unicode = fonts.get('unicode')
    if (!unicode) {
      // Big, and only needed for text the standard fonts cannot write: loaded on demand.
      doc.registerFontkit((await import('@cantoo/fontkit')).default)
      unicode = await doc.embedFont(await loadUnicodeFont(), { subset: true })
      fonts.set('unicode', unicode)
    }
    return unicode
  }

  const pages = doc.getPages()
  for (const mark of marks) {
    const page = pages[mark.page - 1]
    if (!page) continue
    const space = spaceOf(mark.page)
    const box = (x: number, y: number, width: number, height: number) => {
      const [x1, y1] = space.toPdf(x, y)
      const [x2, y2] = space.toPdf(x + width, y + height)
      return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
    }
    switch (mark.kind) {
      case 'text': {
        const font = await fontFor(mark.family, mark.text)
        mark.text.split('\n').forEach((line, index) => {
          if (!line) return
          const [x, y] = space.toPdf(mark.x, mark.baseline + index * mark.size * LINE_HEIGHT)
          page.drawText(line, { x, y, size: mark.size, font, color: color(mark.color), rotate: degrees(space.rotation) })
        })
        break
      }
      case 'cover':
        page.drawRectangle({ ...box(mark.x, mark.y, mark.width, mark.height), color: color(mark.color) })
        break
      case 'highlight':
        page.drawRectangle({
          ...box(mark.x, mark.y, mark.width, mark.height),
          color: color(mark.color),
          opacity: 0.4,
          blendMode: BlendMode.Multiply,
        })
        break
      case 'rect':
        page.drawRectangle({ ...box(mark.x, mark.y, mark.width, mark.height), borderColor: color(mark.color), borderWidth: 2 })
        break
      case 'ellipse': {
        const { x, y, width, height } = box(mark.x, mark.y, mark.width, mark.height)
        page.drawEllipse({
          x: x + width / 2,
          y: y + height / 2,
          xScale: width / 2,
          yScale: height / 2,
          borderColor: color(mark.color),
          borderWidth: 2,
        })
        break
      }
      case 'line':
      case 'ink': {
        // drawSvgPath flips y, so the path is written with y negated.
        const path = mark.points
          .map(([x, y], index) => {
            const [px, py] = space.toPdf(x, y)
            return `${index ? 'L' : 'M'}${px.toFixed(2)},${(-py).toFixed(2)}`
          })
          .join(' ')
        page.drawSvgPath(path, {
          x: 0,
          y: 0,
          borderColor: color(mark.color),
          borderWidth: mark.width,
          borderLineCap: LineCapStyle.Round,
        })
        break
      }
    }
  }
  return doc.save()
}

