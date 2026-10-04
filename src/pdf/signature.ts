/** A signature ready to place: a PNG with transparent paper, trimmed to the ink. */
export interface Signature {
  src: string
  width: number
  height: number
}

interface Pixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** The smallest box around everything that is not transparent, or null for an empty pad. */
export function inkBounds({ data, width, height }: Pixels) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]! > 16) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
  return right < 0 ? null : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

/**
 * A photo of a signature on paper: light pixels become transparent, darker
 * ones keep their colour with opacity growing with darkness, so the edges of
 * the strokes stay smooth instead of jagged.
 */
export function knockOutPaper({ data }: Pixels, paper = 200, ink = 120) {
  for (let i = 0; i < data.length; i += 4) {
    const light = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
    const alpha = light >= paper ? 0 : light <= ink ? 1 : (paper - light) / (paper - ink)
    data[i + 3] = Math.round(data[i + 3]! * alpha)
  }
}

/** Trims a canvas to its ink with a little margin; null if nothing is drawn. */
export function fromCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): Signature | null {
  const context = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  const box = inkBounds(pixels)
  if (!box) return null
  const pad = 4
  const out = document.createElement('canvas')
  out.width = box.width + 2 * pad
  out.height = box.height + 2 * pad
  out.getContext('2d')!.drawImage(canvas, box.x, box.y, box.width, box.height, pad, pad, box.width, box.height)
  return { src: out.toDataURL('image/png'), width: out.width, height: out.height }
}

let handwriting: Promise<FontFace> | undefined

/** A name written in a handwriting font that ships with the app, so it looks the same everywhere. */
export async function typed(name: string, color: string): Promise<Signature | null> {
  handwriting ??= new FontFace('Caveat', `url(${import.meta.env.BASE_URL}fonts/Caveat.woff2)`).load().then((face) => {
    document.fonts.add(face)
    return face
  })
  await handwriting
  const size = 96
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  context.font = `${size}px Caveat`
  canvas.width = Math.ceil(context.measureText(name).width) + size
  canvas.height = Math.ceil(size * 1.6)
  context.font = `${size}px Caveat`
  context.fillStyle = color
  context.textBaseline = 'middle'
  context.fillText(name, size / 2, canvas.height / 2)
  return fromCanvas(canvas)
}

/** A photo or scan of a signature: shrunk, paper removed, trimmed. */
export async function fromImage(file: File): Promise<Signature | null> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, 1200 / bitmap.width, 600 / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d', { willReadFrequently: true })!
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  knockOutPaper(pixels)
  context.putImageData(pixels, 0, 0)
  return fromCanvas(canvas)
}

const KEY = 'pdf-lab-signature'

/** The signature kept on this device, if the user chose to keep it. Storage can be off; then there is none. */
export function remembered(): Signature | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Signature | null
    return value && typeof value.src === 'string' && value.src.startsWith('data:image/png') ? value : null
  } catch {
    return null
  }
}

export function remember(signature: Signature) {
  try {
    localStorage.setItem(KEY, JSON.stringify(signature))
  } catch {
    // Private mode or full storage: the signature still works for this file.
  }
}

export function forget() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing kept, nothing to forget.
  }
}
