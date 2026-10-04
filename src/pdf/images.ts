import { pdfLib } from './lib'

export type Paper = 'a4' | 'letter' | 'fit'
export type Orientation = 'auto' | 'portrait' | 'landscape'
export type Margin = 'none' | 'small' | 'large'

export interface LayoutOptions {
  paper: Paper
  orientation: Orientation
  margin: Margin
}

/** Sizes in PDF points (1/72 inch). */
const PAPER = { a4: [595.28, 841.89], letter: [612, 792] } as const
const MARGIN = { none: 0, small: 28.35, large: 56.7 } as const // 0, 1 cm, 2 cm
/** "Same as image" pages treat pixels as 150 dpi, so a phone photo is a sensible size. */
const FIT_DPI = 150

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Where an image goes: the page size and the image's box on it, scaled to fit
 * inside the margins and centred. Auto orientation follows the image, so a
 * landscape photo gets a landscape page.
 */
export function layout(image: { width: number; height: number }, options: LayoutOptions): { page: [number, number]; box: Box } {
  const margin = MARGIN[options.margin]
  if (options.paper === 'fit') {
    const width = (image.width * 72) / FIT_DPI
    const height = (image.height * 72) / FIT_DPI
    return { page: [width + 2 * margin, height + 2 * margin], box: { x: margin, y: margin, width, height } }
  }
  const [short, long] = PAPER[options.paper]
  const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && image.width > image.height)
  const page: [number, number] = landscape ? [long, short] : [short, long]
  const room = { width: page[0] - 2 * margin, height: page[1] - 2 * margin }
  const scale = Math.min(room.width / image.width, room.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  return { page, box: { x: (page[0] - width) / 2, y: (page[1] - height) / 2, width, height } }
}

export interface PreparedImage {
  bytes: Uint8Array
  type: 'jpg' | 'png'
  width: number
  height: number
}

/** One page per image, in the given order. */
export async function imagesToPdf(images: PreparedImage[], options: LayoutOptions): Promise<Uint8Array> {
  const { PDFDocument } = await pdfLib()
  const doc = await PDFDocument.create()
  for (const image of images) {
    const embedded = image.type === 'png' ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes)
    const { page, box } = layout(image, options)
    doc.addPage(page).drawImage(embedded, box)
  }
  return doc.save()
}

/** Longest side kept: A4 at 300 dpi. Bigger photos only make the file heavier. */
export const MAX_SIDE = 3508

/**
 * Reads a photo the way it looks on the phone — EXIF rotation applied by
 * createImageBitmap — and re-encodes it no bigger than MAX_SIDE. PNG stays PNG
 * to keep transparency; everything else becomes JPEG.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')!
  const png = file.type === 'image/png'
  if (!png) {
    // JPEG has no transparency: put see-through parts of a WebP or GIF on white, not black.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await canvas.convertToBlob(png ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.9 })
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: png ? 'png' : 'jpg', width, height }
}
