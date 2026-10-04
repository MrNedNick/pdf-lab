import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { heightFor, renderPage } from '../../pdf/render'
import type { PageSize } from '../../pdf/use-document'

interface Props {
  doc: PDFDocumentProxy
  /** 1-based, as people count pages. */
  number: number
  size: PageSize
  width: number
  /** How far outside the scroll area to start drawing. */
  margin?: string
  label: string
  /** Extra clockwise turn on top of the page's own rotation. */
  rotation?: number
}

/**
 * A page that holds its exact place from the start and only draws when it is
 * near the screen — 200 pages cost 200 empty boxes until someone scrolls.
 */
export function PageCanvas({ doc, number, size, width, margin = '800px 0px', label, rotation = 0 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: margin })
    observer.observe(element)
    return () => observer.disconnect()
  }, [margin])

  useEffect(() => {
    if (!near || !canvas.current) return
    let task: RenderTask | null = null
    let alive = true
    void doc.getPage(number).then((page) => {
      if (!alive || !canvas.current) return
      task = renderPage(page, canvas.current, width, rotation)
      task.promise.then(
        () => alive && setDrawn(true),
        () => {}, // cancelled because it scrolled away or the zoom changed
      )
    })
    return () => {
      alive = false
      task?.cancel()
    }
  }, [near, doc, number, width, rotation])

  return (
    <div
      ref={box}
      // Without a label the page is decoration next to text that already names it.
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className="relative overflow-hidden rounded-sm bg-white shadow-card"
      style={{ width, height: heightFor(rotation % 180 ? { width: size.height, height: size.width } : size, width) }}
    >
      <canvas ref={canvas} className="block" aria-hidden="true" />
      {!drawn && <div className="absolute inset-0 animate-pulse bg-surface-raised" aria-hidden="true" />}
    </div>
  )
}
