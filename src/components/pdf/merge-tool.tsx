import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import { FAILURE_TEXT, OpenError, openPdf } from '../../pdf/open'
import { download, merge } from '../../pdf/write'
import { move } from '../../pdf/organize'
import { onArrival } from '../../lib/handoff'
import { Button } from '../button/button'
import { FileDrop } from './file-drop'
import { PageCanvas } from './page-canvas'
import { OrderList } from './order-list'

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

/** Several PDFs in a list, in the order the user picks; one file comes out. */
export function MergeTool() {
  const [items, setItems] = useState<Item[]>([])
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

  // Files dropped on the home page, taken once on arrival; later renders find the handoff empty.
  useEffect(() => onArrival((files) => void add(files)), [])

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
        <OrderList
          items={items}
          label="Files in order"
          keyOf={(item) => item.id}
          nameOf={(item) => item.name}
          onMove={(from, to) => setItems((current) => move(current, from, to))}
          onRemove={(item) => removeItem(item.id)}
          thumb={(item) =>
            item.doc && item.cover ? (
              <PageCanvas doc={item.doc} number={1} size={item.cover} width={40} margin="200px" label="" />
            ) : null
          }
          meta={(item) =>
            item.doc
              ? `${item.doc.numPages} ${item.doc.numPages === 1 ? 'page' : 'pages'}`
              : item.problem === 'broken'
                ? 'Cannot be read'
                : item.problem
                  ? 'Locked'
                  : 'Opening…'
          }
          extra={(item) =>
            item.problem === 'broken' ? (
              <p role="alert" className="text-xs text-danger">
                {FAILURE_TEXT.broken} Remove it to continue.
              </p>
            ) : item.problem ? (
              <form
                className="flex flex-wrap items-center gap-2"
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
            ) : null
          }
        />
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
