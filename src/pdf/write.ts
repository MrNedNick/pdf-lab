import { degrees, PDFDocument } from '@cantoo/pdf-lib'

/** One page of the result: which page of the source, turned by how much. */
export interface PagePlan {
  /** 0-based index in the source document. */
  source: number
  /** Clockwise, on top of the page's own rotation: 0, 90, 180 or 270. */
  rotation: number
}

export async function loadForWriting(bytes: Uint8Array, password?: string): Promise<PDFDocument> {
  return PDFDocument.load(bytes, password ? { password } : {})
}

/**
 * A new document from pages of an existing one, in a new order and rotation.
 * Pages are copied whole — text, fonts, links and form widgets come along —
 * so nothing is re-drawn or rasterised.
 */
export async function rebuild(bytes: Uint8Array, plan: PagePlan[], password?: string): Promise<Uint8Array> {
  const source = await loadForWriting(bytes, password)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(
    source,
    plan.map((page) => page.source),
  )
  pages.forEach((page, index) => {
    const turned = (page.getRotation().angle + plan[index]!.rotation) % 360
    page.setRotation(degrees((turned + 360) % 360))
    out.addPage(page)
  })
  const title = source.getTitle()
  if (title) out.setTitle(title)
  return out.save()
}

/** Hands a finished file to the browser as a download. */
export function download(bytes: Uint8Array, name: string, type = 'application/pdf') {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** "report.pdf" + "organized" → "report-organized.pdf" */
export function derivedName(name: string, suffix: string, extension = 'pdf'): string {
  return `${name.replace(/\.pdf$/i, '') || 'document'}-${suffix}.${extension}`
}

/** Several documents, one after another, each with all its pages. */
export async function merge(files: { bytes: Uint8Array; password?: string }[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const file of files) {
    const source = await loadForWriting(file.bytes, file.password)
    const pages = await out.copyPages(source, source.getPageIndices())
    pages.forEach((page) => out.addPage(page))
  }
  return out.save()
}

/** One new document per range (1-based, inclusive), from a single load of the source. */
export async function split(
  bytes: Uint8Array,
  ranges: { from: number; to: number }[],
  password?: string,
): Promise<Uint8Array[]> {
  const source = await loadForWriting(bytes, password)
  const parts: Uint8Array[] = []
  for (const range of ranges) {
    const out = await PDFDocument.create()
    const indices = Array.from({ length: range.to - range.from + 1 }, (_, k) => range.from - 1 + k)
    const pages = await out.copyPages(source, indices)
    pages.forEach((page) => out.addPage(page))
    parts.push(await out.save())
  }
  return parts
}
