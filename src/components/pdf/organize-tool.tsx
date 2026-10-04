import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import { changed, move, remove, rotate, selectRange, tilesFor, type Tile } from '../../pdf/organize'
import { derivedName, download, rebuild } from '../../pdf/write'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'
import { PageCanvas } from './page-canvas'

interface Props {
  doc: PDFDocumentProxy
  sizes: PageSize[]
  bytes: Uint8Array
  name: string
  password?: string
}

/**
 * Every page as a tile: drag to reorder (mouse or finger), arrows to move
 * focus, Alt+arrows to move the page, R to rotate, Delete to remove.
 * Nothing touches the file until Download.
 */
export function OrganizeTool({ doc, sizes, bytes, name, password }: Props) {
  const [tiles, setTiles] = useState<Tile[]>(() => tilesFor(doc.numPages))
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [anchor, setAnchor] = useState<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const grid = useRef<HTMLOListElement>(null)

  const focusTile = (index: number) =>
    requestAnimationFrame(() => grid.current?.querySelectorAll<HTMLElement>('[data-tile]')[index]?.focus())

  const click = (tile: Tile, shift: boolean, toggle: boolean) => {
    if (shift && anchor !== null) setSelected(selectRange(tiles, anchor, tile.key))
    else if (toggle) {
      const next = new Set(selected)
      if (next.has(tile.key)) next.delete(tile.key)
      else next.add(tile.key)
      setSelected(next)
      setAnchor(tile.key)
    } else {
      setSelected(new Set([tile.key]))
      setAnchor(tile.key)
    }
  }

  const keys = (tile: Tile) => (selected.has(tile.key) ? selected : new Set([tile.key]))

  const onKey = (event: KeyboardEvent, index: number, tile: Tile) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key]
    if (step && event.altKey) {
      event.preventDefault()
      setTiles(move(tiles, index, index + step))
      setStatus(`Page moved to position ${Math.max(1, Math.min(tiles.length, index + 1 + step))}`)
      focusTile(Math.max(0, Math.min(tiles.length - 1, index + step)))
    } else if (step) {
      event.preventDefault()
      focusTile(Math.max(0, Math.min(tiles.length - 1, index + step)))
    } else if (event.key === ' ') {
      event.preventDefault()
      click(tile, event.shiftKey, true)
    } else if (event.key.toLowerCase() === 'r') {
      setTiles(rotate(tiles, keys(tile), event.shiftKey ? -90 : 90))
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      deleteKeys(keys(tile))
      focusTile(Math.min(index, tiles.length - 2))
    }
  }

  const deleteKeys = (gone: Set<number>) => {
    if (gone.size >= tiles.length) return setStatus('A PDF needs at least one page.')
    setTiles(remove(tiles, gone))
    setSelected(new Set())
    setStatus(`${gone.size} ${gone.size === 1 ? 'page' : 'pages'} removed`)
  }

  // Dragging with pointer events works the same for a mouse and a finger.
  const startDrag = (event: PointerEvent, index: number) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(index)
  }
  const drag = (event: PointerEvent) => {
    if (dragging === null) return
    const over = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => element instanceof HTMLElement && element.dataset.index !== undefined) as HTMLElement | undefined
    const target = over ? Number(over.dataset.index) : null
    if (target !== null && target !== dragging) {
      setTiles((current) => move(current, dragging, target))
      setDragging(target)
    }
  }

  const save = async (only?: Set<number>) => {
    setBusy(true)
    try {
      const plan = tiles.filter((tile) => !only || only.has(tile.key)).map(({ source, rotation }) => ({ source, rotation }))
      download(await rebuild(bytes, plan, password), derivedName(name, only ? 'pages' : 'organized'))
      setStatus(only ? `${plan.length} selected pages saved as a new PDF` : 'Saved')
    } catch {
      setStatus('The file could not be written. Try again, or open it in another tool and save a copy first.')
    } finally {
      setBusy(false)
    }
  }

  const selection = [...selected]
  return (
    <section aria-label="Pages" className="mt-6 space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/95 p-2 backdrop-blur">
        <span className="mr-auto px-1 text-sm text-text-muted">
          {selection.length ? `${selection.length} selected` : `${tiles.length} pages`}
        </span>
        <Button size="sm" variant="outline" disabled={!selection.length} onClick={() => setTiles(rotate(tiles, selected, -90))}>
          Rotate left
        </Button>
        <Button size="sm" variant="outline" disabled={!selection.length} onClick={() => setTiles(rotate(tiles, selected, 90))}>
          Rotate right
        </Button>
        <Button size="sm" variant="outline" disabled={!selection.length} onClick={() => deleteKeys(selected)}>
          Delete
        </Button>
        <Button size="sm" variant="outline" disabled={!selection.length || busy} onClick={() => void save(selected)}>
          Extract selected
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!changed(tiles, doc.numPages)}
          onClick={() => {
            setTiles(tilesFor(doc.numPages))
            setSelected(new Set())
          }}
        >
          Reset
        </Button>
        <Button size="sm" loading={busy} disabled={busy} onClick={() => void save()}>
          Download PDF
        </Button>
      </div>
      <p className="text-xs text-text-muted">
        Drag pages to reorder. Click to select, Shift-click for a range. Keyboard: arrows move between pages, Alt+arrows
        move the page, Space selects, R rotates, Delete removes.
      </p>
      <p role="status" className="sr-only">
        {status}
      </p>
      {status && <p className="text-sm text-text-muted">{status}</p>}
      <ol ref={grid} className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
        {tiles.map((tile, index) => (
          <li key={tile.key} data-index={index} className="flex flex-col items-center gap-1.5">
            <div
              data-tile
              data-index={index}
              role="checkbox"
              aria-checked={selected.has(tile.key)}
              aria-label={`Page ${tile.source + 1}${tile.rotation ? `, turned ${tile.rotation}°` : ''}, position ${index + 1}`}
              tabIndex={0}
              onClick={(event) => click(tile, event.shiftKey, event.metaKey || event.ctrlKey)}
              onKeyDown={(event) => onKey(event, index, tile)}
              onPointerDown={(event) => startDrag(event, index)}
              onPointerMove={drag}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              className={cn(
                'cursor-grab touch-none rounded-md p-1.5 outline-offset-2 transition-shadow select-none',
                selected.has(tile.key) && 'bg-accent/10 ring-2 ring-accent',
                dragging === index && 'cursor-grabbing opacity-70',
              )}
            >
              <PageCanvas
                doc={doc}
                number={tile.source + 1}
                size={sizes[tile.source]!}
                width={120}
                rotation={tile.rotation}
                margin="400px 0px"
                label=""
              />
            </div>
            <span className="text-xs tabular-nums text-text-muted">{tile.source + 1}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
