import type { PDFDict, PDFNumber as Num, PDFRawStream } from '@cantoo/pdf-lib'
import { pdfLib } from './lib'
import { loadForWriting } from './write'

export type Level = 'light' | 'balanced' | 'strong'

/** Longest side kept and JPEG quality. Balanced keeps an A4 scan near 170 dpi — still crisp to read and print. */
export const LEVELS: Record<Level, { maxSide: number; quality: number; label: string }> = {
  light: { maxSide: 3000, quality: 0.85, label: 'Light — best quality' },
  balanced: { maxSide: 2000, quality: 0.72, label: 'Balanced' },
  strong: { maxSide: 1400, quality: 0.6, label: 'Strong — smallest file' },
}

/** What a picture in the file is, as far as deciding whether it can be re-encoded. */
export interface ImageInfo {
  filters: string[]
  bitsPerComponent?: number
  colorComponents?: number
  imageMask?: boolean
  hasDecode?: boolean
  hasColorKeyMask?: boolean
}

/**
 * Only pictures this can decode and write back faithfully: plain JPEGs, and
 * uncompressed or zipped 8-bit RGB / grey pixels. CMYK, palettes, masks and
 * inverted images stay exactly as they are.
 */
export function canRecompress(info: ImageInfo): 'jpeg' | 'pixels' | null {
  if (info.imageMask || info.hasDecode || info.hasColorKeyMask) return null
  if (info.colorComponents !== 1 && info.colorComponents !== 3) return null
  if (info.filters.length === 1 && info.filters[0] === 'DCTDecode') return 'jpeg'
  if (info.bitsPerComponent === 8 && (info.filters.length === 0 || (info.filters.length === 1 && info.filters[0] === 'FlateDecode'))) return 'pixels'
  return null
}

/** The new size, never bigger than the old one. */
export function targetSize(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export interface CompressResult {
  bytes: Uint8Array
  before: number
  after: number
  /** Pictures found, and how many of them got smaller. */
  images: number
  replaced: number
}

/**
 * Re-encodes the pictures inside the PDF at a lower resolution and quality.
 * Text, fonts and vector drawings are left alone — there is nothing honest to
 * gain there — so a text-only document stays about the same size.
 */
export async function compress(
  bytes: Uint8Array,
  password: string | undefined,
  level: Level,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<CompressResult> {
  const { PDFArray, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream } = await pdfLib()
  const { maxSide, quality } = LEVELS[level]
  const doc = await loadForWriting(bytes, password)
  const context = doc.context

  const name = (dict: PDFDict, key: string) => dict.lookup(PDFName.of(key))
  const components = (space: unknown): number | undefined => {
    if (space instanceof PDFName) return { '/DeviceRGB': 3, '/DeviceGray': 1, '/CalRGB': 3, '/CalGray': 1 }[space.asString()]
    if (space instanceof PDFArray) {
      const kind = space.lookup(0)
      if (kind instanceof PDFName && kind.asString() === '/ICCBased') {
        const profile = space.lookup(1)
        const n = profile instanceof PDFRawStream ? profile.dict.lookup(PDFName.of('N')) : undefined
        return n instanceof PDFNumber ? n.asNumber() : undefined
      }
      if (kind instanceof PDFName) return components(kind)
    }
    return undefined
  }

  const pictures: [ReturnType<typeof context.enumerateIndirectObjects>[number][0], PDFRawStream, 'jpeg' | 'pixels'][] = []
  let images = 0
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue
    const dict = object.dict
    if (name(dict, 'Subtype') !== PDFName.of('Image')) continue
    images++
    const filter = name(dict, 'Filter')
    const filters = filter instanceof PDFName ? [filter.asString().slice(1)] : filter instanceof PDFArray ? filter.asArray().map((item) => String(item).slice(1)) : []
    const bpc = name(dict, 'BitsPerComponent')
    const mask = name(dict, 'Mask')
    const kind = canRecompress({
      filters,
      bitsPerComponent: bpc instanceof PDFNumber ? bpc.asNumber() : undefined,
      colorComponents: components(name(dict, 'ColorSpace')),
      imageMask: String(name(dict, 'ImageMask')) === 'true',
      hasDecode: name(dict, 'Decode') !== undefined,
      hasColorKeyMask: mask instanceof PDFArray,
    })
    if (kind) pictures.push([ref, object, kind])
  }

  let replaced = 0
  for (const [index, [ref, stream, kind]] of pictures.entries()) {
    onProgress(index, pictures.length)
    const dict = stream.dict
    const width = (name(dict, 'Width') as Num).asNumber()
    const height = (name(dict, 'Height') as Num).asNumber()
    let source: ImageBitmap
    try {
      if (kind === 'jpeg') source = await createImageBitmap(new Blob([stream.contents as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }))
      else {
        const raw = decodePDFRawStream(stream).decode()
        const gray = components(name(dict, 'ColorSpace')) === 1
        const rgba = new Uint8ClampedArray(width * height * 4)
        for (let p = 0, s = 0; p < rgba.length; p += 4) {
          rgba[p] = raw[s]!
          rgba[p + 1] = gray ? raw[s]! : raw[s + 1]!
          rgba[p + 2] = gray ? raw[s]! : raw[s + 2]!
          rgba[p + 3] = 255
          s += gray ? 1 : 3
        }
        source = await createImageBitmap(new ImageData(rgba, width, height))
      }
    } catch {
      continue // a picture the browser cannot decode stays as it was
    }
    const size = targetSize(source.width, source.height, maxSide)
    const canvas = new OffscreenCanvas(size.width, size.height)
    canvas.getContext('2d')!.drawImage(source, 0, 0, size.width, size.height)
    source.close()
    const jpeg = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality })).arrayBuffer())
    // Keep the original unless the new one is clearly smaller.
    if (jpeg.length > stream.contents.length * 0.9) continue
    const next = dict.clone(context)
    next.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
    next.set(PDFName.of('Width'), PDFNumber.of(size.width))
    next.set(PDFName.of('Height'), PDFNumber.of(size.height))
    next.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
    next.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
    next.delete(PDFName.of('DecodeParms'))
    next.delete(PDFName.of('Length'))
    context.assign(ref, PDFRawStream.of(next, jpeg))
    replaced++
  }
  onProgress(pictures.length, pictures.length)

  const out = await doc.save({ useObjectStreams: true })
  return { bytes: out, before: bytes.length, after: out.length, images, replaced }
}

/**
 * Whether the result is worth a new file, and if not, why — in plain words.
 * Under 10 % saved is not: the user gets an honest answer instead of a copy that is barely smaller.
 */
export function verdictFor(result: Pick<CompressResult, 'before' | 'after' | 'images' | 'replaced'>, level: Level): { worthIt: true } | { worthIt: false; reason: string } {
  if (1 - result.after / result.before >= 0.1) return { worthIt: true }
  if (result.images === 0)
    return { worthIt: false, reason: 'This PDF has no pictures to shrink — it is text and drawings, which are already stored compactly. There is nothing honest to gain here; keep the original.' }
  if (result.replaced === 0)
    return { worthIt: false, reason: 'The pictures in this PDF are already compressed about as far as they go, or are of a kind that is safer to leave alone. Keep the original.' }
  return { worthIt: false, reason: `Only a little could be saved — not enough to be worth a new file. Keep the original${level === 'strong' ? '.' : ', or try Strong.'}` }
}

/** 1 234 567 → "1.2 MB", for the before → after line. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
