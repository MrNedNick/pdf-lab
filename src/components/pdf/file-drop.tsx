import { useRef, useState, type DragEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'

/** A big target for a PDF: click to choose, or drop it anywhere on the box. */
export function FileDrop({ onFile, error }: { onFile: (file: File) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const drop = (event: DragEvent) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files[0]
    if (file) onFile(file)
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
      <p className="text-base font-semibold">Drop a PDF here</p>
      <p className="text-sm text-text-muted">or</p>
      <Button onClick={() => input.current?.click()}>Choose a PDF</Button>
      <p className="text-xs text-text-muted">The file stays on this device — nothing is uploaded.</p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Choose a PDF"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}
