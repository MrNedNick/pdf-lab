import { AnnotationMode, type PDFPageProxy, type RenderTask } from 'pdfjs-dist'

/**
 * Draws a page into a canvas at the given CSS width, sharp on high-density
 * screens. Returns the task so a page scrolled out of view can be cancelled.
 */
/**
 * `withoutFields` leaves form fields off the canvas, for a page where real
 * inputs are laid over them instead.
 */
export function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement, cssWidth: number, rotation = 0, withoutFields = false): RenderTask {
  const base = page.getViewport({ scale: 1, rotation: page.rotate + rotation })
  const scale = cssWidth / base.width
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const viewport = page.getViewport({ scale: scale * ratio, rotation: page.rotate + rotation })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${Math.floor(viewport.width / ratio)}px`
  canvas.style.height = `${Math.floor(viewport.height / ratio)}px`
  return page.render({ canvas, viewport, annotationMode: withoutFields ? AnnotationMode.ENABLE_FORMS : AnnotationMode.ENABLE })
}

/** Height for a given width, from the page's own proportions. */
export function heightFor(page: { width: number; height: number }, width: number): number {
  return Math.round((page.height / page.width) * width)
}
