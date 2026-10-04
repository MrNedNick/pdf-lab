import { useId, useMemo, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { everyPage, parseRanges } from '../../pdf/ranges'
import { pageToImage, pixelSize, type ImageFormat } from '../../pdf/rasterize'
import type { PageSize } from '../../pdf/use-document'
import { derivedName, download } from '../../pdf/write'
import { zip } from '../../lib/zip'
import { Button } from '../button/button'
import { Progress } from '../progress/progress'

interface Props {
  doc: PDFDocumentProxy
  sizes: PageSize[]
  name: string
}

const DPI = [
  [72, 'Screen · 72 dpi'],
  [150, 'Standard · 150 dpi'],
  [300, 'Print · 300 dpi'],
] as const

/** Pages drawn as PNG or JPEG at a chosen resolution; several come as a ZIP. */
export function PdfToImages({ doc, sizes, name }: Props) {
  const pages = doc.numPages
  const [format, setFormat] = useState<ImageFormat>('png')
  const [dpi, setDpi] = useState(150)
  const [which, setWhich] = useState<'all' | 'some'>('all')
  const [input, setInput] = useState('1')
  const [done, setDone] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const inputId = useId()
  const errorId = useId()

  const result = useMemo(
    () => (which === 'all' ? { ok: true as const, ranges: everyPage(pages) } : parseRanges(input, pages)),
    [which, input, pages],
  )
  const numbers = result.ok ? [...new Set(result.ranges.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from + i)))] : []
  const first = pixelSize(sizes[(numbers[0] ?? 1) - 1]!, dpi)
  const extension = format === 'png' ? 'png' : 'jpg'
  const busy = done !== null

  const run = async () => {
    setDone(0)
    setStatus('')
    try {
      const files: { name: string; blob: Blob }[] = []
      for (const number of numbers) {
        const page = await doc.getPage(number)
        files.push({ name: derivedName(name, `page-${number}`, extension), blob: await pageToImage(page, dpi, format) })
        page.cleanup()
        setDone(files.length)
      }
      if (files.length === 1) download(new Uint8Array(await files[0]!.blob.arrayBuffer()), files[0]!.name, files[0]!.blob.type)
      else download(new Uint8Array(await (await zip(files)).arrayBuffer()), derivedName(name, 'images', 'zip'), 'application/zip')
      setStatus(`${files.length} ${files.length === 1 ? 'image' : 'images'} ready`)
    } catch {
      setStatus('The pages could not be turned into images. Try a lower resolution.')
    } finally {
      setDone(null)
    }
  }

  return (
    <section aria-label="PDF to images" className="mt-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Format</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="format" checked={format === 'png'} onChange={() => setFormat('png')} />
            PNG — sharp text
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="format" checked={format === 'jpeg'} onChange={() => setFormat('jpeg')} />
            JPEG — smaller photos
          </label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Resolution</legend>
          {DPI.map(([value, text]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="dpi" checked={dpi === value} onChange={() => setDpi(value)} />
              {text}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Pages</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="which" checked={which === 'all'} onChange={() => setWhich('all')} />
            All {pages}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="which" checked={which === 'some'} onChange={() => setWhich('some')} />
            Only some
          </label>
          {which === 'some' && (
            <div className="space-y-1 pl-6">
              <label htmlFor={inputId} className="block text-xs text-text-muted">
                Pages, like 1-3, 5
              </label>
              <input
                id={inputId}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-invalid={!result.ok}
                aria-describedby={result.ok ? undefined : errorId}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger"
              />
              {!result.ok && (
                <p id={errorId} role="alert" className="text-sm text-danger">
                  {result.error}
                </p>
              )}
            </div>
          )}
        </fieldset>
      </div>
      <p className="text-sm text-text-muted">
        {numbers.length} {numbers.length === 1 ? 'image' : 'images'}, page {numbers[0] ?? 1} comes out at {first.width} ×{' '}
        {first.height} px{first.reduced ? ' (reduced to fit what a browser can draw)' : ''}.
      </p>
      {busy && (
        <div className="space-y-1">
          <Progress value={(done / Math.max(1, numbers.length)) * 100} aria-label="Pages drawn" />
          <p className="text-xs text-text-muted">
            {done} of {numbers.length}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={!result.ok || busy} onClick={() => void run()}>
          {numbers.length > 1 ? `Save ${numbers.length} images (ZIP)` : `Save as ${extension.toUpperCase()}`}
        </Button>
        <p role="status" className="text-sm text-text-muted">
          {status}
        </p>
      </div>
    </section>
  )
}
