import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import { filledCount, fillForm, initialValues, readFields, type FieldValue, type FormField } from '../../pdf/form'
import { notoSans } from '../../pdf/lib'
import { derivedName, download } from '../../pdf/write'
import { href } from '../../lib/router'
import { Button } from '../button/button'
import { PageCanvas } from './page-canvas'

interface Props {
  doc: PDFDocumentProxy
  sizes: PageSize[]
  bytes: Uint8Array
  name: string
  password?: string
}

/** Real inputs over the form's own fields; the values go into the file on Download. */
export function FormTool({ doc, sizes, bytes, name, password }: Props) {
  const [fields, setFields] = useState<FormField[] | null>(null)
  const [values, setValues] = useState<Record<string, FieldValue>>({})
  const [start, setStart] = useState<Record<string, FieldValue>>({})
  const [flatten, setFlatten] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [width, setWidth] = useState(800)
  const column = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    readFields(doc).then(
      (found) => {
        if (!alive) return
        setFields(found)
        setValues(initialValues(found))
        setStart(initialValues(found))
      },
      () => alive && setFields([]),
    )
    return () => {
      alive = false
    }
  }, [doc])

  useEffect(() => {
    const element = column.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.min(900, entry!.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [fields])

  const set = (field: string, value: FieldValue) => setValues((current) => ({ ...current, [field]: value }))

  const save = async () => {
    setBusy(true)
    try {
      download(await fillForm(bytes, password, values, flatten, notoSans), derivedName(name, 'filled'))
      setStatus(flatten ? 'Saved as a finished document — the fields are now part of the page.' : 'Saved. The fields can still be changed in any PDF reader.')
    } catch {
      setStatus('The form could not be written. Try again, or save without making it final.')
    } finally {
      setBusy(false)
    }
  }

  if (!fields) return <p role="status" className="mt-6 text-sm text-text-muted">Looking for form fields…</p>

  if (!fields.length)
    return (
      <div className="mt-6 space-y-3 rounded-lg border border-border p-6 text-center">
        <p className="font-semibold">This PDF has no fields to fill in.</p>
        <p className="text-sm text-text-muted">
          Forms printed on paper and scanned have only a picture of the boxes. You can still type over them with{' '}
          <a className="text-accent underline" href={href('edit')}>
            Add text and marks
          </a>
          .
        </p>
      </div>
    )

  const names = new Set(fields.map((field) => field.name))
  const changed = Object.keys(values).some((key) => JSON.stringify(values[key]) !== JSON.stringify(start[key]))
  return (
    <section aria-label="Form" className="mt-6 space-y-3">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/95 p-2 backdrop-blur">
        <span className="mr-auto px-1 text-sm text-text-muted">
          {filledCount(values)} of {names.size} fields filled
        </span>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={flatten} onChange={(event) => setFlatten(event.target.checked)} />
          Make it final (fields can no longer be changed)
        </label>
        <Button size="sm" variant="ghost" disabled={!changed} onClick={() => setValues(start)}>
          Reset
        </Button>
        <Button size="sm" loading={busy} disabled={busy} onClick={() => void save()}>
          Download PDF
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm text-text-muted">
        {status}
      </p>
      <div ref={column} className="space-y-6">
        {sizes.map((size, index) => {
          const page = index + 1
          const scale = width / size.width
          return (
            <div key={page} className="relative mx-auto" style={{ width }}>
              <PageCanvas doc={doc} number={page} size={size} width={width} label={`Page ${page}`} withoutFields />
              <div className="absolute top-0 left-0 origin-top-left" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
                {fields
                  .filter((field) => field.page === page)
                  .map((field) => (
                    <Input key={field.id} field={field} value={values[field.name]} onChange={(value) => set(field.name, value)} />
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Input({ field, value, onChange }: { field: FormField; value: FieldValue | undefined; onChange: (value: FieldValue) => void }) {
  const box: CSSProperties = { left: field.x, top: field.y, width: field.width, height: field.height }
  // Text sized to the box, as a PDF reader would draw it, but never tiny.
  const fontSize = field.multiline ? 10 : Math.max(8, Math.min(14, field.height * 0.65))
  const common = {
    'aria-label': field.label,
    title: field.label,
    disabled: field.readOnly,
    className:
      'absolute rounded-[2px] border border-accent/40 bg-accent/10 text-[#111] outline-accent focus:bg-white focus:outline-2 disabled:opacity-60',
  }
  switch (field.kind) {
    case 'checkbox':
      return <input {...common} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} style={{ ...box, margin: 0 }} />
    case 'radio':
      return (
        <input
          {...common}
          aria-label={`${field.label}: ${field.choice}`}
          type="radio"
          name={field.name}
          checked={value === field.choice}
          onChange={() => onChange(field.choice!)}
          style={{ ...box, margin: 0 }}
        />
      )
    case 'select':
    case 'list':
      return (
        <select
          {...common}
          multiple={field.multiple}
          size={field.kind === 'list' ? Math.max(2, Math.floor(field.height / (fontSize * 1.3))) : undefined}
          value={field.multiple ? (Array.isArray(value) ? value : []) : typeof value === 'string' ? value : ''}
          onChange={(event) =>
            onChange(field.multiple ? [...event.target.selectedOptions].map((option) => option.value) : event.target.value)
          }
          style={{ ...box, fontSize, padding: 0 }}
        >
          {!field.multiple && field.kind === 'select' && <option value="">—</option>}
          {field.options!.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    default:
      return field.multiline ? (
        <textarea
          {...common}
          value={typeof value === 'string' ? value : ''}
          maxLength={field.maxLength}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...box, fontSize, padding: 2, resize: 'none', lineHeight: 1.2 }}
        />
      ) : (
        <input
          {...common}
          type="text"
          value={typeof value === 'string' ? value : ''}
          maxLength={field.maxLength}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...box, fontSize, padding: '0 2px' }}
        />
      )
  }
}
