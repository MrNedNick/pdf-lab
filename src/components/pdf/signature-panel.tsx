import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { forget, fromCanvas, fromImage, remember, remembered, typed, type Signature } from '../../pdf/signature'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'
import { Tab, TabList, TabPanel, Tabs } from '../tabs/tabs'
import { FileDrop } from './file-drop'

const INKS = [
  ['#111111', 'Black'],
  ['#1d3a8a', 'Blue'],
] as const

/** Draw, type or upload a signature; it can be kept on this device for next time. */
export function SignaturePanel({ value, onChange }: { value: Signature | null; onChange: (signature: Signature | null) => void }) {
  const [making, setMaking] = useState(!value)
  const [keep, setKeep] = useState(true)
  const [kept, setKept] = useState(() => remembered() !== null)
  const [tab, setTab] = useState('draw')
  const [ink, setInk] = useState<string>(INKS[0][0])

  const use = (signature: Signature | null) => {
    if (!signature) return
    if (keep) {
      remember(signature)
      setKept(true)
    }
    onChange(signature)
    setMaking(false)
  }

  if (value && !making)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-raised p-3">
        <div className="rounded-md bg-white px-3 py-2">
          <img src={value.src} alt="Your signature" className="h-12 w-auto" />
        </div>
        <span className="mr-auto text-sm text-text-muted">Click the page where it should go.</span>
        <Button size="sm" variant="outline" onClick={() => setMaking(true)}>
          New signature
        </Button>
        {kept && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              forget()
              setKept(false)
            }}
          >
            Forget on this device
          </Button>
        )}
      </div>
    )

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-3">
      <Tabs value={tab} onChange={setTab}>
        <TabList>
          <Tab value="draw">Draw</Tab>
          <Tab value="type">Type</Tab>
          <Tab value="upload">Upload</Tab>
        </TabList>
        <div role="radiogroup" aria-label="Ink" className="mt-3 flex gap-2">
          {INKS.map(([color, label]) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={ink === color}
              aria-label={`${label} ink`}
              onClick={() => setInk(color)}
              className={cn('size-7 rounded-full border-2', ink === color ? 'border-accent' : 'border-border')}
              style={{ background: color }}
            />
          ))}
        </div>
        <TabPanel value="draw">
          <DrawPad ink={ink} onUse={use} />
        </TabPanel>
        <TabPanel value="type">
          <TypePad ink={ink} onUse={use} />
        </TabPanel>
        <TabPanel value="upload">
          <UploadPad onUse={use} />
        </TabPanel>
      </Tabs>
      <div className="flex flex-wrap items-center gap-3">
        <label className="mr-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} />
          Remember on this device
        </label>
        {value && (
          <Button size="sm" variant="ghost" onClick={() => setMaking(false)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

function DrawPad({ ink, onUse }: { ink: string; onUse: (signature: Signature | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const last = useRef<[number, number] | null>(null)
  const [empty, setEmpty] = useState(true)

  // The pad is drawn at twice its CSS size, so the signature stays sharp when it is scaled on the page.
  useEffect(() => {
    const element = canvas.current!
    const rect = element.getBoundingClientRect()
    element.width = Math.round(rect.width * 2)
    element.height = Math.round(rect.height * 2)
  }, [])

  const at = (event: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect()
    return [((event.clientX - rect.left) / rect.width) * event.currentTarget.width, ((event.clientY - rect.top) / rect.height) * event.currentTarget.height]
  }
  const stroke = (from: [number, number], to: [number, number], pressure: number) => {
    const context = canvas.current!.getContext('2d')!
    context.strokeStyle = ink
    context.lineCap = context.lineJoin = 'round'
    context.lineWidth = 3 + 3 * (pressure || 0.5)
    context.beginPath()
    context.moveTo(...from)
    context.lineTo(...to)
    context.stroke()
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvas}
        aria-label="Signature pad: draw with a mouse, finger or pen"
        className="h-40 w-full touch-none rounded-md border border-dashed border-border bg-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          last.current = at(event)
          stroke(last.current, last.current, event.pressure)
          setEmpty(false)
        }}
        onPointerMove={(event) => {
          if (!last.current) return
          const point = at(event)
          stroke(last.current, point, event.pressure)
          last.current = point
        }}
        onPointerUp={() => (last.current = null)}
        onPointerCancel={() => (last.current = null)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={empty} onClick={() => onUse(fromCanvas(canvas.current!))}>
          Use this signature
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={empty}
          onClick={() => {
            const element = canvas.current!
            element.getContext('2d')!.clearRect(0, 0, element.width, element.height)
            setEmpty(true)
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  )
}

function TypePad({ ink, onUse }: { ink: string; onUse: (signature: Signature | null) => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        onUse(await typed(name.trim(), ink))
        setBusy(false)
      }}
    >
      <label className="block text-sm">
        Your name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          className="mt-1 block w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2"
        />
      </label>
      <p aria-hidden="true" className="min-h-14 rounded-md bg-white px-3 text-5xl leading-[3.5rem]" style={{ fontFamily: 'Caveat, cursive', color: ink }}>
        {name}
      </p>
      <Button size="sm" type="submit" loading={busy} disabled={!name.trim() || busy}>
        Use this signature
      </Button>
    </form>
  )
}

function UploadPad({ onUse }: { onUse: (signature: Signature | null) => void }) {
  const [error, setError] = useState('')
  return (
    <div className="space-y-2">
      <p className="text-sm text-text-muted">A photo or scan of your signature on white paper. The paper is removed.</p>
      <FileDrop
        kind="images"
        error={error || undefined}
        onFiles={async ([file]) => {
          setError('')
          try {
            const signature = await fromImage(file!)
            if (signature) onUse(signature)
            else setError('No signature found in that picture — it looks blank.')
          } catch {
            setError('This browser cannot read that image. Try a JPEG or PNG.')
          }
        }}
      />
    </div>
  )
}
