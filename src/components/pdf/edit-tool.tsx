import { useEffect, useReducer, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PageSize } from '../../pdf/use-document'
import {
  BASELINE,
  boxFrom,
  CSS_FONT,
  emptyHistory,
  familyFor,
  history,
  joinRuns,
  LINE_HEIGHT,
  lineAt,
  replaceLine,
  thin,
  type BoxMark,
  type Mark,
  type TextLine,
} from '../../pdf/marks'
import { stamp, type PageSpace } from '../../pdf/stamp'
import { notoSans } from '../../pdf/lib'
import { derivedName, download } from '../../pdf/write'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'
import { PageCanvas } from './page-canvas'
import { SignaturePanel } from './signature-panel'
import { remembered, type Signature } from '../../pdf/signature'

type Tool = 'sign' | 'select' | 'text' | 'line-edit' | 'cover' | 'highlight' | 'draw' | 'rect' | 'ellipse' | 'line'

const SIGN_TOOLS: [Tool, string, string][] = [
  ['sign', 'Place signature', 'Click the page where the signature goes; drag it to move, its corner to resize.'],
  ['select', 'Select', 'Click a mark to move it; Delete removes it, arrows nudge it, + and − resize a signature.'],
  ['text', 'Text', 'Click where the text should start — a date, initials — then type.'],
]

const EDIT_TOOLS: [Tool, string, string][] = [
  ['select', 'Select', 'Click a mark to move it; Delete removes it, arrows nudge it.'],
  ['line-edit', 'Edit a line', 'Click a line of the document: it is covered and retyped in a similar font, ready to change.'],
  ['text', 'Text', 'Click where the text should start, then type.'],
  ['cover', 'Cover', 'Drag a white box over something. It hides it on the page; the text underneath stays in the file, so this is not for secrets.'],
  ['highlight', 'Highlight', 'Drag over the words to mark.'],
  ['draw', 'Draw', 'Draw freely with a mouse, a finger or a pen.'],
  ['rect', 'Box', 'Drag to draw a box.'],
  ['ellipse', 'Circle', 'Drag to draw a circle round something.'],
  ['line', 'Line', 'Drag to draw a straight line.'],
]
const PENS = ['#111111', '#1d4ed8', '#dc2626', '#15803d']
const MARKERS = ['#facc15', '#4ade80', '#f472b6']
const SIZES = [10, 12, 14, 18, 24, 32]

let lastId = 0
const nextId = () => ++lastId

interface Props {
  /** Signing shows a signature maker and fewer tools over the same pages. */
  mode?: 'edit' | 'sign'
  doc: PDFDocumentProxy
  sizes: PageSize[]
  bytes: Uint8Array
  name: string
  password?: string
}

/** Text, highlights, drawings and white-outs over the pages; written into the file on Download. */
export function EditTool({ mode = 'edit', doc, sizes, bytes, name, password }: Props) {
  const tools = mode === 'sign' ? SIGN_TOOLS : EDIT_TOOLS
  const [signature, setSignature] = useState<Signature | null>(() => (mode === 'sign' ? remembered() : null))
  const [state, dispatch] = useReducer(history, emptyHistory)
  const marks = state.present
  const [tool, setTool] = useState<Tool>(mode === 'sign' ? 'sign' : 'line-edit')
  const [pen, setPen] = useState(PENS[0]!)
  const [marker, setMarker] = useState(MARKERS[0]!)
  const [textSize, setTextSize] = useState(14)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Mark | null>(null)
  /** A text box just opened: it joins the history only once something is written in it. */
  const [pending, setPending] = useState<Mark[]>([])
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [width, setWidth] = useState(800)
  const column = useRef<HTMLDivElement>(null)
  const lines = useRef(new Map<number, Promise<TextLine[]>>())

  useEffect(() => {
    const element = column.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.min(900, entry!.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const commit = (next: Mark[]) => dispatch({ type: 'commit', marks: next })
  const update = (id: number, change: Partial<Mark>) =>
    commit(marks.map((mark) => (mark.id === id ? ({ ...mark, ...change } as Mark) : mark)))
  const removeMark = (id: number) => {
    commit(marks.filter((mark) => mark.id !== id))
    setSelected(null)
  }

  // Undo / redo from anywhere on the page, except while typing into a mark.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (editing !== null || !(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z' || key === 'y') {
        event.preventDefault()
        dispatch({ type: key === 'y' || event.shiftKey ? 'redo' : 'undo' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  /** The page's text as lines, read once per page when "Edit a line" first needs it. */
  const linesOf = (number: number) => {
    let found = lines.current.get(number)
    if (!found) {
      found = (async () => {
        const page = await doc.getPage(number)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        const runs: TextLine[] = []
        for (const item of content.items) {
          if (!('str' in item) || !item.str) continue
          const [x, baseline] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]) as [number, number]
          const size = Math.hypot(item.transform[2], item.transform[3])
          const style = content.styles[item.fontName]
          runs.push({ text: item.str, x, baseline, width: item.width, size, family: familyFor(`${style?.fontFamily ?? ''} ${item.fontName}`) })
        }
        return joinRuns(runs)
      })()
      lines.current.set(number, found)
    }
    return found
  }

  const pointIn = (event: PointerEvent | MouseEvent, page: number): [number, number] => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const size = sizes[page - 1]!
    return [((event.clientX - rect.left) / rect.width) * size.width, ((event.clientY - rect.top) / rect.height) * size.height]
  }

  const drag = useRef<{ page: number; start: [number, number]; points: [number, number][] } | null>(null)

  const down = (event: PointerEvent, page: number) => {
    if (event.button !== 0 || editing !== null) return
    const point = pointIn(event, page)
    if (tool === 'select') return setSelected(null)
    // Text opens on click instead: by then the click has moved focus, and cannot take it from the new box.
    if (tool === 'text' || tool === 'line-edit') return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { page, start: point, points: [point] }
  }

  const click = async (event: MouseEvent, page: number) => {
    if (grabbed.current) return void (grabbed.current = false)
    if (editing !== null || (tool !== 'text' && tool !== 'line-edit' && tool !== 'sign')) return
    const point = pointIn(event, page)
    if (tool === 'sign') {
      if (!signature) return setStatus('Make your signature first — draw, type or upload it above.')
      // About the size of a real signature on paper: 150 pt wide, but never wider than a third of the page.
      const width = Math.min(150, sizes[page - 1]!.width / 3)
      const height = (width * signature.height) / signature.width
      const mark: Mark = { id: nextId(), page, kind: 'image', color: '', src: signature.src, x: point[0] - width / 2, y: point[1] - height / 2, width, height }
      commit([...marks, mark])
      setSelected(mark.id)
      setStatus(`Signature placed on page ${page}. Drag it to move, its corner to resize, or download.`)
      return
    }
    if (tool === 'text') {
      const mark: Mark = { id: nextId(), page, kind: 'text', color: pen, x: point[0], baseline: point[1] + textSize * 0.35, size: textSize, family: 'sans', text: '' }
      setPending([mark])
      setEditing(mark.id)
      return
    }
    if (tool === 'line-edit') {
      const line = lineAt(await linesOf(page), ...point)
      if (!line) return setStatus('No text there. Click right on a line of the document — scanned pages have no text to pick.')
      const [cover, text] = replaceLine(line, page, nextId)
      setPending([cover, text])
      setEditing(text.id)
      setStatus('')
    }
  }

  const shapeFor = (page: number, start: [number, number], end: [number, number], points: [number, number][]): Mark => {
    const id = draft?.id ?? nextId()
    if (tool === 'draw') return { id, page, kind: 'ink', color: pen, width: 2, points }
    if (tool === 'line') return { id, page, kind: 'line', color: pen, width: 2, points: [start, end] }
    const kind = tool as BoxMark['kind']
    return { id, page, kind, color: kind === 'cover' ? '#ffffff' : kind === 'highlight' ? marker : pen, ...boxFrom(start, end) }
  }

  const move = (event: PointerEvent, page: number) => {
    if (!drag.current) return
    const point = pointIn(event, page)
    drag.current.points.push(point)
    setDraft(shapeFor(page, drag.current.start, point, drag.current.points.slice()))
  }

  const up = (event: PointerEvent, page: number) => {
    const current = drag.current
    drag.current = null
    if (!current) return
    const end = pointIn(event, page)
    const shape = shapeFor(page, current.start, end, thin(current.points))
    setDraft(null)
    const tiny =
      'width' in shape && 'height' in shape ? shape.width < 3 || shape.height < 3 : Math.hypot(end[0] - current.start[0], end[1] - current.start[1]) < 3 && tool !== 'draw'
    if (!tiny) commit([...marks, shape])
  }

  // Dragging a mark in Select mode, or a signature while placing them; `resize` drags its corner.
  const moving = useRef<{ id: number; from: [number, number]; original: Mark; page: number; resize?: boolean } | null>(null)
  /** A press on a mark also ends in a click on the page under it; that click must not place anything. */
  const grabbed = useRef(false)
  const canMove = (mark: Mark) => tool === 'select' || (tool === 'sign' && mark.kind === 'image')
  const grab = (event: PointerEvent, mark: Mark, resize = false) => {
    if (mark.kind === 'text' && (tool === 'text' || tool === 'line-edit') && editing === null) {
      // Clicking text you already wrote opens it again instead of starting a new one.
      event.stopPropagation()
      event.preventDefault()
      return setEditing(mark.id)
    }
    if (!canMove(mark)) return
    event.stopPropagation()
    grabbed.current = true
    setSelected(mark.id)
    const overlay = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-overlay]')!
    const rect = overlay.getBoundingClientRect()
    const size = sizes[mark.page - 1]!
    const at: [number, number] = [((event.clientX - rect.left) / rect.width) * size.width, ((event.clientY - rect.top) / rect.height) * size.height]
    moving.current = { id: mark.id, from: at, original: mark, page: mark.page, resize }
    overlay.setPointerCapture(event.pointerId)
  }
  const shift = (mark: Mark, dx: number, dy: number): Mark =>
    mark.kind === 'text'
      ? { ...mark, x: mark.x + dx, baseline: mark.baseline + dy }
      : 'points' in mark
        ? { ...mark, points: mark.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) }
        : { ...mark, x: mark.x + dx, y: mark.y + dy }

  const overlayMove = (event: PointerEvent, page: number) => {
    const current = moving.current
    if (!current) return move(event, page)
    const [x, y] = pointIn(event, page)
    const original = current.original
    if (current.resize && original.kind === 'image') {
      const width = Math.max(24, original.width + x - current.from[0])
      return setDraft({ ...original, width, height: (width * original.height) / original.width })
    }
    setDraft(shift(original, x - current.from[0], y - current.from[1]))
  }
  const overlayUp = (event: PointerEvent, page: number) => {
    const current = moving.current
    if (!current) return up(event, page)
    moving.current = null
    if (draft) update(current.id, draft)
    setDraft(null)
  }

  const markKey = (event: KeyboardEvent, mark: Mark) => {
    const step = event.shiftKey ? 10 : 1
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (delta) {
      event.preventDefault()
      update(mark.id, shift(mark, delta[0]!, delta[1]!))
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeMark(mark.id)
    } else if ((event.key === '+' || event.key === '=' || event.key === '-') && mark.kind === 'image') {
      event.preventDefault()
      const factor = event.key === '-' ? 1 / 1.1 : 1.1
      update(mark.id, { width: mark.width * factor, height: mark.height * factor })
    } else if (event.key === 'Enter' && mark.kind === 'text') {
      event.preventDefault()
      setEditing(mark.id)
    }
  }

  // Blur can arrive from a render older than the latest marks; always finish against the newest.
  const latest = useRef(marks)
  useEffect(() => {
    latest.current = marks
  }, [marks])
  const finishEditing = (id: number, text: string) => {
    setEditing(null)
    const marks = latest.current
    const fresh = pending.find((it) => it.id === id)
    if (fresh?.kind === 'text') {
      setPending([])
      // Nothing written, or a line retyped exactly as it was: leave no trace, not even an undo step.
      if (text.trim() && text !== (pending.length > 1 ? fresh.text : '')) commit([...marks, ...pending.map((it) => (it.id === id ? { ...it, text } : it))])
      return
    }
    const mark = marks.find((it) => it.id === id)
    if (!mark || mark.kind !== 'text') return
    // Emptying a text box removes it, and the white-out made for it along.
    if (!text.trim()) {
      const index = marks.indexOf(mark)
      const before = marks[index - 1]
      const paired = before?.kind === 'cover' && before.page === mark.page && before.id === mark.id - 1
      commit(marks.filter((it) => it !== mark && !(paired && it === before)))
    } else if (text !== mark.text) commit(marks.map((it) => (it.id === id ? { ...it, text } : it)))
  }

  const save = async () => {
    setBusy(true)
    try {
      const spaces = new Map<number, PageSpace>()
      for (const number of new Set(marks.map((mark) => mark.page))) {
        const page = await doc.getPage(number)
        const viewport = page.getViewport({ scale: 1 })
        spaces.set(number, { toPdf: (x, y) => viewport.convertToPdfPoint(x, y) as [number, number], rotation: page.rotate })
      }
      download(await stamp(bytes, password, marks, (number) => spaces.get(number)!, notoSans), derivedName(name, mode === 'sign' ? 'signed' : 'edited'))
      setStatus(`Saved with ${marks.length} ${marks.length === 1 ? 'change' : 'changes'}`)
    } catch {
      setStatus('The file could not be written. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const hint = tools.find(([value]) => value === tool)![2]
  const swatches = tool === 'highlight' ? MARKERS : PENS
  const current = tool === 'highlight' ? marker : pen

  return (
    <section aria-label={mode === 'sign' ? 'Sign' : 'Edit'} className="mt-6 space-y-3">
      {mode === 'sign' && <SignaturePanel value={signature} onChange={setSignature} />}
      <div className="sticky top-0 z-20 space-y-2 rounded-lg border border-border bg-surface/95 p-2 backdrop-blur">
        <div role="toolbar" aria-label="Tools" className="flex flex-wrap gap-1">
          {tools.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={tool === value ? 'primary' : 'ghost'}
              aria-pressed={tool === value}
              onClick={() => {
                setTool(value)
                setSelected(null)
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tool !== 'cover' && tool !== 'select' && tool !== 'line-edit' && tool !== 'sign' && (
            <div role="radiogroup" aria-label="Colour" className="flex gap-1">
              {swatches.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  role="radio"
                  aria-checked={current === swatch}
                  aria-label={`Colour ${swatch}`}
                  onClick={() => (tool === 'highlight' ? setMarker(swatch) : setPen(swatch))}
                  className={cn('size-7 rounded-full border-2', current === swatch ? 'border-accent' : 'border-border')}
                  style={{ background: swatch }}
                />
              ))}
            </div>
          )}
          {tool === 'text' && (
            <label className="flex items-center gap-1 text-sm">
              Size
              <select value={textSize} onChange={(event) => setTextSize(Number(event.target.value))} className="rounded-md border border-border bg-surface px-2 py-1">
                {SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="mr-auto" />
          <Button size="sm" variant="outline" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}>
            Undo
          </Button>
          <Button size="sm" variant="outline" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}>
            Redo
          </Button>
          <Button size="sm" loading={busy} disabled={busy || !marks.length} onClick={() => void save()}>
            Download PDF
          </Button>
        </div>
        <p className="text-xs text-text-muted">{hint}</p>
      </div>
      <p role="status" className="min-h-5 text-sm text-text-muted">
        {status}
      </p>
      <div ref={column} className="space-y-6">
        {sizes.map((size, index) => {
          const page = index + 1
          const scale = width / size.width
          const shown = [...marks, ...pending].filter((mark) => mark.page === page).map((mark) => (draft?.id === mark.id ? draft : mark))
          if (draft && draft.page === page && !shown.some((mark) => mark.id === draft.id)) shown.push(draft)
          return (
            <div key={page} className="relative mx-auto" style={{ width }}>
              <PageCanvas doc={doc} number={page} size={size} width={width} label={`Page ${page}`} />
              <div
                data-overlay
                aria-label={`Marks on page ${page}`}
                className={cn(
                  'absolute inset-0',
                  // A finger scrolls the document unless the tool draws with it.
                  tool === 'select' || tool === 'line-edit' || tool === 'text' || tool === 'sign' ? 'touch-manipulation' : 'touch-none',
                  tool === 'select' ? 'cursor-default' : tool === 'line-edit' || tool === 'text' ? 'cursor-text' : 'cursor-crosshair',
                )}
                onPointerDown={(event) => down(event, page)}
                onClick={(event) => void click(event, page)}
                onPointerMove={(event) => overlayMove(event, page)}
                onPointerUp={(event) => overlayUp(event, page)}
                onPointerCancel={() => {
                  drag.current = moving.current = null
                  setDraft(null)
                }}
              >
                <div className="absolute top-0 left-0 origin-top-left" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}>
                  <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible">
                    {shown.map((mark) => (
                      <Shape
                        key={mark.id}
                        mark={mark}
                        selected={selected === mark.id}
                        onGrab={(event, resize) => grab(event, mark, resize)}
                        onKey={(event) => markKey(event, mark)}
                        selectable={canMove(mark)}
                      />
                    ))}
                  </svg>
                  {shown.map((mark) =>
                    mark.kind !== 'text' ? null : editing === mark.id ? (
                      <TextEditor key={mark.id} mark={mark} onDone={(text) => finishEditing(mark.id, text)} />
                    ) : (
                      <div
                        key={mark.id}
                        role={tool === 'select' ? 'button' : undefined}
                        tabIndex={tool === 'select' ? 0 : undefined}
                        aria-label={tool === 'select' ? `Text: ${mark.text}` : undefined}
                        onPointerDown={(event) => grab(event, mark)}
                        onDoubleClick={() => setEditing(mark.id)}
                        onKeyDown={(event) => markKey(event, mark)}
                        className={cn('absolute whitespace-pre', selected === mark.id && 'outline-2 outline-accent outline-dashed', tool === 'select' && 'cursor-move touch-none')}
                        style={textStyle(mark)}
                      >
                        {mark.text}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function textStyle(mark: Extract<Mark, { kind: 'text' }>) {
  return {
    left: mark.x,
    top: mark.baseline - BASELINE[mark.family] * mark.size,
    fontSize: mark.size,
    lineHeight: LINE_HEIGHT,
    fontFamily: CSS_FONT[mark.family],
    color: mark.color,
  }
}

function TextEditor({ mark, onDone }: { mark: Extract<Mark, { kind: 'text' }>; onDone: (text: string) => void }) {
  const [text, setText] = useState(mark.text)
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    area.current?.focus()
    area.current?.select()
  }, [])
  const rows = text.split('\n')
  return (
    <textarea
      ref={area}
      aria-label="Text on the page"
      value={text}
      rows={rows.length}
      cols={Math.max(4, ...rows.map((row) => row.length + 1))}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => onDone(text)}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
          event.preventDefault()
          area.current?.blur()
        }
      }}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-1 outline-accent outline-dashed"
      style={{ ...textStyle(mark), minWidth: mark.size * 2 }}
    />
  )
}

function Shape({
  mark,
  selected,
  selectable,
  onGrab,
  onKey,
}: {
  mark: Mark
  selected: boolean
  selectable: boolean
  onGrab: (event: PointerEvent, resize?: boolean) => void
  onKey: (event: KeyboardEvent) => void
}) {
  if (mark.kind === 'text') return null
  const common = {
    role: selectable ? 'button' : undefined,
    tabIndex: selectable ? 0 : undefined,
    'aria-label': selectable ? labelFor(mark) : undefined,
    onPointerDown: (event: PointerEvent) => onGrab(event),
    onKeyDown: onKey,
    className: cn(selectable && 'cursor-move touch-none', selected && 'outline-2 outline-accent outline-dashed'),
    style: { pointerEvents: selectable ? ('auto' as const) : ('none' as const) },
  }
  switch (mark.kind) {
    case 'image':
      return (
        <g>
          <image {...common} href={mark.src} x={mark.x} y={mark.y} width={mark.width} height={mark.height} preserveAspectRatio="none" />
          {selected && selectable && (
            // The corner handle: drag to resize, keeping the signature's proportions.
            <rect
              aria-hidden="true"
              x={mark.x + mark.width - 6}
              y={mark.y + mark.height - 6}
              width={12}
              height={12}
              rx={2}
              className="cursor-nwse-resize touch-none fill-accent stroke-white"
              strokeWidth={1.5}
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(event) => onGrab(event, true)}
            />
          )}
        </g>
      )
    case 'cover':
      return <rect {...common} x={mark.x} y={mark.y} width={mark.width} height={mark.height} fill={mark.color} />
    case 'highlight':
      return <rect {...common} x={mark.x} y={mark.y} width={mark.width} height={mark.height} fill={mark.color} opacity={0.4} style={{ ...common.style, mixBlendMode: 'multiply' }} />
    case 'rect':
      return <rect {...common} x={mark.x} y={mark.y} width={mark.width} height={mark.height} fill="none" stroke={mark.color} strokeWidth={2} />
    case 'ellipse':
      return (
        <ellipse {...common} cx={mark.x + mark.width / 2} cy={mark.y + mark.height / 2} rx={mark.width / 2} ry={mark.height / 2} fill="none" stroke={mark.color} strokeWidth={2} />
      )
    default:
      return (
        <polyline
          {...common}
          points={mark.points.map((point) => point.join(',')).join(' ')}
          fill="none"
          stroke={mark.color}
          strokeWidth={mark.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
  }
}

function labelFor(mark: Mark) {
  return { cover: 'White box', highlight: 'Highlight', rect: 'Box', ellipse: 'Circle', line: 'Line', ink: 'Drawing', text: 'Text', image: 'Signature' }[mark.kind]
}
