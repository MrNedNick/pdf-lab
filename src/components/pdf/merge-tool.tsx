import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import { FAILURE_TEXT, OpenError, openPdf } from '../../pdf/open'
import { download, merge } from '../../pdf/write'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'
import { FileDrop } from './file-drop'
import { PageCanvas } from './page-canvas'

interface Item {
  id: number
  name: string
  bytes: Uint8Array
  password?: string
  doc?: PDFDocumentProxy
  /** First page, for the thumbnail. */
  cover?: PageSize
  /** Set when the file needs a password or cannot be read. */
  problem?: 'password' | 'wrong-password' | 'broken'
}

let nextId = 1

/** Several PDFs in a list: drag or use the arrows to order them, then one file comes out. */
export function MergeTool() {
  const [items, setItems] = useState<Item[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [passwords, setPasswords] = useState<Record<number, string>>({})
  const latest = useRef(items)
  useEffect(() => {
    latest.current = items
  }, [items])
  useEffect(() => () => latest.current.forEach((item) => void item.doc?.loadingTask.destroy()), [])

  const open = async (item: Item) => {
    try {
      const doc = await openPdf(item.bytes, item.password)
      const { width, height } = (await doc.getPage(1)).getViewport({ scale: 1 })
      setItems((current) =>
        current.map((it) => (it.id === item.id ? { ...it, doc, cover: { width, height }, problem: undefined } : it)),
      )
    } catch (error) {
      const problem = error instanceof OpenError ? error.reason : 'broken'
      setItems((current) => current.map((it) => (it.id === item.id ? { ...it, problem } : it)))
    }
  }

  const add = async (files: File[]) => {
    const added: Item[] = []
    for (const file of files) added.push({ id: nextId++, name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })
    setItems((current) => [...current, ...added])
    added.forEach((item) => void open(item))
    setStatus(`${added.length} ${added.length === 1 ? 'file' : 'files'} added`)
  }

  const moveItem = (from: number, to: number) =>
    setItems((current) => {
      if (to < 0 || to >= current.length) return current
      const next = current.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
      return next
    })

  const removeItem = (id: number) =>
    setItems((current) => {
      current.find((item) => item.id === id)?.doc?.loadingTask.destroy()
      return current.filter((item) => item.id !== id)
    })

  const unlock = (item: Item) => {
    const updated = { ...item, password: passwords[item.id] ?? '' }
    setPasswords({ ...passwords, [item.id]: '' })
    setItems((current) => current.map((it) => (it.id === item.id ? updated : it)))
    void open(updated)
  }

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
      moveItem(dragging, target)
      setDragging(target)
    }
  }

  const ready = items.length >= 2 && items.every((item) => item.doc)
  const run = async () => {
    setBusy(true)
    try {
      download(await merge(items.map(({ bytes, password }) => ({ bytes, password }))), 'merged.pdf')
      setStatus(`Merged ${items.length} files`)
    } catch {
      setStatus('The files could not be merged. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Merge" className="mt-6 space-y-5">
      <FileDrop onFiles={(files) => void add(files)} multiple />
      {items.length > 0 && (
        <ol aria-label="Files in order" className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
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
              <div className="w-10 shrink-0 sm:w-12">
                {item.doc && item.cover && (
                  <PageCanvas doc={item.doc} number={1} size={item.cover} width={40} margin="200px" label="" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-text-muted">
                  {item.doc
                    ? `${item.doc.numPages} ${item.doc.numPages === 1 ? 'page' : 'pages'}`
                    : item.problem === 'broken'
                      ? 'Cannot be read'
                      : item.problem
                        ? 'Locked'
                        : 'Opening…'}
                </p>
              </div>
              <div className="flex shrink-0">
                <Button size="sm" variant="ghost" aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => moveItem(index, index - 1)}>
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Move ${item.name} down`}
                  disabled={index === items.length - 1}
                  onClick={() => moveItem(index, index + 1)}
                >
                  ↓
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}>
                  ✕
                </Button>
              </div>
              {item.problem === 'broken' && (
                <p role="alert" className="basis-full pl-8 text-xs text-danger">
                  {FAILURE_TEXT.broken} Remove it to continue.
                </p>
              )}
              {(item.problem === 'password' || item.problem === 'wrong-password') && (
                <form
                  className="flex basis-full flex-wrap items-center gap-2 pl-8"
                  onSubmit={(event) => {
                    event.preventDefault()
                    unlock(item)
                  }}
                >
                  <input
                    type="password"
                    aria-label={`Password for ${item.name}`}
                    placeholder="Password"
                    value={passwords[item.id] ?? ''}
                    onChange={(event) => setPasswords({ ...passwords, [item.id]: event.target.value })}
                    className="w-full max-w-56 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                  />
                  <Button size="sm" variant="outline" type="submit">
                    Unlock
                  </Button>
                  {item.problem === 'wrong-password' && (
                    <span role="alert" className="basis-full text-xs text-danger">
                      {FAILURE_TEXT['wrong-password']}
                    </span>
                  )}
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={!ready || busy} onClick={() => void run()}>
          {items.length < 2 ? 'Add at least two PDFs' : `Merge ${items.length} files`}
        </Button>
        <p role="status" className="text-sm text-text-muted">
          {items.some((item) => item.problem) ? 'Unlock or remove the marked files first.' : status}
        </p>
      </div>
    </section>
  )
}
