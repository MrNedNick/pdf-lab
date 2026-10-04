import { useRef, useState, type DragEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'

interface Props {
  onFiles: (files: File[]) => void
  /** Several files at once — for tools that combine them. */
  multiple?: boolean
  /** What it takes: PDFs, images, or either. */
  kind?: 'pdf' | 'images' | 'any'
  error?: string
}

/** A big target for PDFs: click to choose, or drop them anywhere on the box. */
export function FileDrop({ onFiles, multiple = false, kind = 'pdf', error }: Props) {
  const noun = { pdf: multiple ? 'PDFs' : 'a PDF', images: multiple ? 'images' : 'an image', any: 'PDFs or photos' }[kind]
  const pick = (list: FileList | null | undefined) => {
    const files = [...(list ?? [])]
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    pick(event.dataTransfer.files)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors',
        over ? 'border-accent bg-accent/5' : 'border-border',
      )}
    >
      <p className="text-base font-semibold">Drop {noun} here</p>
      <p className="text-sm text-text-muted">or</p>
      <Button onClick={() => input.current?.click()}>Choose {noun}</Button>
      <p className="text-xs text-text-muted">{multiple ? 'The files stay' : 'The file stays'} on this device — nothing is uploaded.</p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={{ pdf: 'application/pdf,.pdf', images: 'image/*', any: 'application/pdf,.pdf,image/*' }[kind]}
        className="sr-only"
        aria-label={`Choose ${noun}`}
        multiple={multiple}
        tabIndex={-1}
        onChange={(event) => {
          pick(event.target.files)
          event.target.value = ''
        }}
      />
    </div>
  )
}
