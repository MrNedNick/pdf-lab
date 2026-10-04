import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import { Button } from '../button/button'
import { PageCanvas } from './page-canvas'

interface Props {
  doc: PDFDocumentProxy
  sizes: PageSize[]
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

/**
 * Thumbnails on the left, pages on the right, zoom relative to "fit width".
 * Everything is drawn lazily, so the size of the document does not matter.
 */
export function Viewer({ doc, sizes }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(720)
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(1)

  // "Fit width" follows the reading area, on a phone and on a wide screen.
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setFit(Math.max(240, Math.min(900, entry.contentRect.width - 32))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // The page counter follows whichever page fills the middle of the view.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.page))
      },
      { root, rootMargin: '-45% 0px -45% 0px' },
    )
    root.querySelectorAll('[data-page]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [sizes.length])

  const goTo = (page: number) =>
    scroller.current?.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: 'start' })
  const width = Math.round(fit * zoom)
  const step = (direction: 1 | -1) => {
    const index = ZOOMS.indexOf(zoom)
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, index + direction))]!)
  }

  return (
    <div className="flex h-[min(80vh,900px)] min-h-[420px] overflow-hidden rounded-lg border border-border">
      <nav aria-label="Pages" className="hidden w-36 shrink-0 overflow-y-auto border-r border-border bg-surface-raised p-3 md:block">
        <ol className="space-y-3">
          {sizes.map((size, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-current={current === index + 1 ? 'page' : undefined}
                aria-label={`Go to page ${index + 1}`}
                className="block w-full rounded-sm p-1 outline-offset-2 aria-[current=page]:ring-2 aria-[current=page]:ring-accent"
              >
                <PageCanvas doc={doc} number={index + 1} size={size} width={100} margin="300px 0px" label="" />
                <span className="mt-1 block text-center text-xs text-text-muted">{index + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm">
          <span aria-live="polite" className="mr-auto tabular-nums text-text-muted">
            Page {current} of {sizes.length}
          </span>
          <Button size="sm" variant="outline" onClick={() => step(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out">
            −
          </Button>
          <span className="w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="outline" onClick={() => step(1)} disabled={zoom === ZOOMS.at(-1)} aria-label="Zoom in">
            +
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setZoom(1)} disabled={zoom === 1}>
            Fit width
          </Button>
        </div>
        <div ref={scroller} className="flex-1 overflow-auto bg-surface-raised p-4">
          <div className="mx-auto flex w-max flex-col items-center gap-4">
            {sizes.map((size, index) => (
              <div key={index} data-page={index + 1}>
                <PageCanvas doc={doc} number={index + 1} size={size} width={width} label={`Page ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
