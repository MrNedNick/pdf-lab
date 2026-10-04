import { useId, useMemo, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import { everyPage, parseRanges, rangeLabel } from '../../pdf/ranges'
import { derivedName, download, split } from '../../pdf/write'
import { zip } from '../../lib/zip'
import { Button } from '../button/button'
import { PageCanvas } from './page-canvas'

interface Props {
  doc: PDFDocumentProxy
  sizes: PageSize[]
  bytes: Uint8Array
  name: string
  password?: string
}

/** Cut a document by ranges like "1-3, 5, 8-", or into single pages; several parts come as a ZIP. */
export function SplitTool({ doc, sizes, bytes, name, password }: Props) {
  const pages = doc.numPages
  const [mode, setMode] = useState<'ranges' | 'every'>('ranges')
  const [input, setInput] = useState(pages > 1 ? `1-${Math.ceil(pages / 2)}, ${Math.ceil(pages / 2) + 1}-` : '1')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const inputId = useId()
  const errorId = useId()

  const result = useMemo(
    () => (mode === 'every' ? { ok: true as const, ranges: everyPage(pages) } : parseRanges(input, pages)),
    [mode, input, pages],
  )

  const run = async () => {
    if (!result.ok) return
    setBusy(true)
    try {
      const parts = await split(bytes, result.ranges, password)
      if (parts.length === 1) download(parts[0]!, derivedName(name, `pages-${rangeLabel(result.ranges[0]!)}`))
      else {
        const archive = await zip(
          parts.map((part, index) => ({
            name: derivedName(name, `pages-${rangeLabel(result.ranges[index]!)}`),
            blob: new Blob([part as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
          })),
        )
        download(new Uint8Array(await archive.arrayBuffer()), derivedName(name, 'split', 'zip'), 'application/zip')
      }
      setStatus(`${parts.length} ${parts.length === 1 ? 'file' : 'files'} ready`)
    } catch {
      setStatus('The file could not be split. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Split" className="mt-6 space-y-5">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">How to split</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mode" checked={mode === 'ranges'} onChange={() => setMode('ranges')} />
          By page ranges
        </label>
        {mode === 'ranges' && (
          <div className="ml-6 space-y-1">
            <label htmlFor={inputId} className="block text-xs text-text-muted">
              Pages — for example 1-3, 5, 8- (each range becomes one file)
            </label>
            <input
              id={inputId}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-invalid={!result.ok}
              aria-describedby={result.ok ? undefined : errorId}
              inputMode="text"
              className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger"
            />
            {!result.ok && (
              <p id={errorId} role="alert" className="text-sm text-danger">
                {result.error}
              </p>
            )}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="mode" checked={mode === 'every'} onChange={() => setMode('every')} />
          Every page as its own file
        </label>
      </fieldset>

      {result.ok && (
        <ol aria-label="Files you will get" className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
          {result.ranges.slice(0, 60).map((range, index) => (
            <li key={index} className="flex flex-col items-center gap-1.5">
              <PageCanvas doc={doc} number={range.from} size={sizes[range.from - 1]!} width={110} margin="300px 0px" label="" />
              <span className="text-xs text-text-muted">
                {range.from === range.to ? `Page ${range.from}` : `Pages ${rangeLabel(range)}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      {result.ok && result.ranges.length > 60 && (
        <p className="text-sm text-text-muted">…and {result.ranges.length - 60} more files.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={!result.ok || busy} onClick={() => void run()}>
          {result.ok && result.ranges.length > 1 ? `Split into ${result.ranges.length} files (ZIP)` : 'Download'}
        </Button>
        <p role="status" className="text-sm text-text-muted">
          {status}
        </p>
      </div>
    </section>
  )
}
