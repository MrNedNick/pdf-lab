import { useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'

interface Props<T> {
  items: T[]
  label: string
  keyOf: (item: T) => string | number
  nameOf: (item: T) => string
  onMove: (from: number, to: number) => void
  onRemove: (item: T) => void
  thumb: (item: T) => ReactNode
  meta: (item: T) => ReactNode
  /** A full-width line under the row: a password field, an error. */
  extra?: (item: T) => ReactNode
}

/**
 * Files in an order the user picks: drag by the handle (mouse or finger), or
 * the ↑/↓ buttons from the keyboard.
 */
export function OrderList<T>({ items, label, keyOf, nameOf, onMove, onRemove, thumb, meta, extra }: Props<T>) {
  const [dragging, setDragging] = useState<number | null>(null)

  const startDrag = (event: PointerEvent, index: number) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(index)
  }
  const drag = (event: PointerEvent) => {
    if (dragging === null) return
    const over = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => element instanceof HTMLElement && element.dataset.row !== undefined) as HTMLElement | undefined
    const target = over ? Number(over.dataset.row) : null
    if (target !== null && target !== dragging) {
      onMove(dragging, target)
      setDragging(target)
    }
  }

  return (
    <ol aria-label={label} className="space-y-2">
      {items.map((item, index) => {
        const name = nameOf(item)
        const below = extra?.(item)
        return (
          <li
            key={keyOf(item)}
            data-row={index}
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-2 rounded-lg border border-border bg-surface-raised p-2 sm:gap-x-3',
              dragging === index && 'ring-2 ring-accent',
            )}
          >
            <span
              aria-hidden="true"
              title="Drag to reorder"
              onPointerDown={(event) => startDrag(event, index)}
              onPointerMove={drag}
              onPointerUp={() => setDragging(null)}
              onPointerCancel={() => setDragging(null)}
              className="cursor-grab touch-none px-1 text-lg text-text-muted select-none"
            >
              ⋮⋮
            </span>
            <span className="hidden w-6 text-center text-sm tabular-nums text-text-muted sm:block">{index + 1}</span>
            <div className="flex w-10 shrink-0 justify-center sm:w-12">{thumb(item)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={name}>
                {name}
              </p>
              <p className="text-xs text-text-muted">{meta(item)}</p>
            </div>
            <div className="flex shrink-0">
              <Button size="sm" variant="ghost" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${name} down`}
                disabled={index === items.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                ↓
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Remove ${name}`} onClick={() => onRemove(item)}>
                ✕
              </Button>
            </div>
            {below && <div className="basis-full pl-8">{below}</div>}
          </li>
        )
      })}
    </ol>
  )
}

