import type { PDFPageProxy } from 'pdfjs-dist'

export type ImageFormat = 'png' | 'jpeg'

/** Browsers give up on canvases far below their documented limits on phones; stay under both. */
const MAX_SIDE = 10_000
const MAX_PIXELS = 36_000_000

/**
 * Pixel size of a page drawn at `dpi` (a PDF point is 1/72 inch), shrunk if it
 * would not fit in a canvas. `scale` is what pdf.js needs for the viewport.
 */
export function pixelSize(page: { width: number; height: number }, dpi: number) {
  let scale = dpi / 72
  scale = Math.min(scale, MAX_SIDE / page.width, MAX_SIDE / page.height)
  scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (page.width * page.height)))
  return { width: Math.floor(page.width * scale), height: Math.floor(page.height * scale), scale, reduced: scale < dpi / 72 }
}

/** One page as an image file, on white so a JPEG has no black background. */
export async function pageToImage(page: PDFPageProxy, dpi: number, format: ImageFormat): Promise<Blob> {
  const base = page.getViewport({ scale: 1 })
  const { scale } = pixelSize(base, dpi)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, viewport, background: '#ffffff' }).promise
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, format === 'png' ? 'image/png' : 'image/jpeg', 0.9),
  )
  // Free the bitmap now rather than whenever the collector gets to it: 200 pages at 300 dpi add up.
  canvas.width = canvas.height = 0
  if (!blob) throw new Error('The page could not be turned into an image.')
  return blob
}
