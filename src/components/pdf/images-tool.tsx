import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { imagesToPdf, layout, prepareImage, type LayoutOptions, type PreparedImage } from '../../pdf/images'
import { move } from '../../pdf/organize'
import { onArrival } from '../../lib/handoff'
import { download } from '../../pdf/write'
import { Button } from '../button/button'
import { Tab, TabList, TabPanel, Tabs } from '../tabs/tabs'
import { FileDrop } from './file-drop'
import { OrderList } from './order-list'

/** Two directions on one page: photos into a PDF, and a PDF into images. */
export function ImagesTool({ pdfSide }: { pdfSide: ReactNode }) {
  const [tab, setTab] = useState('to-pdf')
  return (
    <Tabs value={tab} onChange={setTab} className="mt-6">
      <TabList>
        <Tab value="to-pdf">Images → PDF</Tab>
        <Tab value="to-images">PDF → images</Tab>
      </TabList>
      <TabPanel value="to-pdf" keepMounted>
        <ImagesToPdf />
      </TabPanel>
      <TabPanel value="to-images" keepMounted>{pdfSide}</TabPanel>
    </Tabs>
  )
}

interface Item {
  id: number
  name: string
  /** For the preview; the browser applies the photo's own rotation, as the PDF will. */
  url: string
  image?: PreparedImage
  broken?: boolean
}

let nextId = 1

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )
}

/** The page as it will come out: its shape, and where the photo sits on it. */
function PagePreview({ image, url, options }: { image: PreparedImage; url: string; options: LayoutOptions }) {
  const { page, box } = layout(image, options)
  const width = 40
  const scale = width / page[0]
  return (
    <div aria-hidden="true" className="relative bg-white shadow-card" style={{ width, height: page[1] * scale }}>
      <img
        src={url}
        alt=""
        className="absolute max-w-none"
        style={{ left: box.x * scale, bottom: box.y * scale, width: box.width * scale, height: box.height * scale }}
      />
    </div>
  )
}

function ImagesToPdf() {
  const [items, setItems] = useState<Item[]>([])
  const [options, setOptions] = useState<LayoutOptions>({ paper: 'a4', orientation: 'auto', margin: 'small' })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const latest = useRef(items)
  useEffect(() => {
    latest.current = items
  }, [items])
  useEffect(() => () => latest.current.forEach((item) => URL.revokeObjectURL(item.url)), [])

  const add = (files: File[]) => {
    const added = files.map((file) => ({ id: nextId++, name: file.name, url: URL.createObjectURL(file), file }))
    setItems((current) => [...current, ...added.map(({ file: _file, ...item }) => item)])
    setStatus(`${added.length} ${added.length === 1 ? 'image' : 'images'} added`)
    for (const { id, file } of added)
      prepareImage(file).then(
        (image) => setItems((current) => current.map((item) => (item.id === id ? { ...item, image } : item))),
        () => setItems((current) => current.map((item) => (item.id === id ? { ...item, broken: true } : item))),
      )
  }

  // Files dropped on the home page, taken once on arrival; later renders find the handoff empty.
  useEffect(() => onArrival(add), [])

  const remove = (gone: Item) => {
    URL.revokeObjectURL(gone.url)
    setItems((current) => current.filter((item) => item.id !== gone.id))
  }

  const ready = items.length > 0 && items.every((item) => item.image)
  const run = async () => {
    setBusy(true)
    try {
      const bytes = await imagesToPdf(
        items.map((item) => item.image!),
        options,
      )
      const name = items.length === 1 ? `${items[0]!.name.replace(/\.[^.]+$/, '') || 'image'}.pdf` : 'images.pdf'
      download(bytes, name)
      setStatus(`PDF with ${items.length} ${items.length === 1 ? 'page' : 'pages'} ready`)
    } catch {
      setStatus('The PDF could not be made. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Images to PDF" className="mt-5 space-y-5">
      <FileDrop onFiles={add} multiple kind="images" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Choice
          label="Page size"
          value={options.paper}
          onChange={(paper) => setOptions({ ...options, paper })}
          options={[
            ['a4', 'A4'],
            ['letter', 'US Letter'],
            ['fit', 'Same as the image'],
          ]}
        />
        <Choice
          label="Orientation"
          value={options.orientation}
          onChange={(orientation) => setOptions({ ...options, orientation })}
          options={[
            ['auto', 'Follow each image'],
            ['portrait', 'Portrait'],
            ['landscape', 'Landscape'],
          ]}
        />
        <Choice
          label="Margins"
          value={options.margin}
          onChange={(margin) => setOptions({ ...options, margin })}
          options={[
            ['none', 'None'],
            ['small', 'Small (1 cm)'],
            ['large', 'Large (2 cm)'],
          ]}
        />
      </div>
      {items.length > 0 && (
        <OrderList
          items={items}
          label="Images in order"
          keyOf={(item) => item.id}
          nameOf={(item) => item.name}
          onMove={(from, to) => setItems((current) => move(current, from, to))}
          onRemove={remove}
          thumb={(item) => (item.image ? <PagePreview image={item.image} url={item.url} options={options} /> : null)}
          meta={(item) =>
            item.image
              ? `${item.image.width} × ${item.image.height}`
              : item.broken
                ? 'Cannot be read'
                : 'Reading…'
          }
          extra={(item) =>
            item.broken ? (
              <p role="alert" className="text-xs text-danger">
                This browser cannot read this image. Save it as JPEG or PNG and add it again.
              </p>
            ) : null
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={busy} disabled={!ready || busy} onClick={() => void run()}>
          {items.length ? `Make a ${items.length}-page PDF` : 'Add images first'}
        </Button>
        <p role="status" className="text-sm text-text-muted">
          {items.some((item) => item.broken) ? 'Remove the marked images first.' : status}
        </p>
      </div>
    </section>
  )
}
