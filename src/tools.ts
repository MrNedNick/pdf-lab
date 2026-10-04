/**
 * Every tool has its own address, so a link opens straight into the job.
 * The build copies index.html into a folder per slug for GitHub Pages, with
 * the tool's own title and description in it.
 */
export interface Tool {
  slug: string
  title: string
  /** One line for the home page and the tool's header. */
  summary: string
  /** For search results and link previews. */
  description: string
  /** Takes images instead of a PDF from the home page drop zone. */
  images?: boolean
}

export const TOOLS = [
  {
    slug: 'sign',
    title: 'Sign',
    summary: 'Draw or type a signature and place it on the page.',
    description: 'Sign a PDF in your browser: draw, type or upload a signature, place it on the page and download. Free, no sign-up, the file never leaves your device.',
  },
  {
    slug: 'edit',
    title: 'Add text and marks',
    summary: 'Write on a page, cover a line, highlight or draw.',
    description: 'Edit a PDF in your browser: retype a line, add text, highlight, draw, cover something with white. Free, no sign-up, nothing uploaded.',
  },
  {
    slug: 'merge',
    title: 'Merge PDFs',
    summary: 'Put several PDFs together in the order you choose.',
    description: 'Merge PDF files in your browser: drop them in, drag into order, download one PDF. Locked files ask for their password. Nothing is uploaded.',
  },
  {
    slug: 'split',
    title: 'Split a PDF',
    summary: 'Cut a PDF into parts or take out the pages you need.',
    description: 'Split a PDF by page ranges like 1-3, 5, 8- or into single pages, downloaded as a ZIP. Runs in your browser; the file stays on your device.',
  },
  {
    slug: 'compress',
    title: 'Compress',
    summary: 'Make a PDF with photos small enough to send.',
    description: 'Compress a scanned or photo-heavy PDF in your browser and see before and after sizes. Text-only files get an honest answer instead of a fake win.',
  },
  {
    slug: 'images',
    title: 'Convert images and PDF',
    summary: 'Turn photos into a PDF, or pages into images.',
    description: 'Turn phone photos into a tidy A4 PDF, or save PDF pages as PNG or JPEG at the resolution you choose. In your browser, nothing uploaded.',
    images: true,
  },
  {
    slug: 'organize',
    title: 'Organize pages',
    summary: 'Reorder, rotate and delete pages.',
    description: 'Reorder, rotate, delete and extract PDF pages by dragging thumbnails or from the keyboard. Free and private — it all happens in your browser.',
  },
  {
    slug: 'fill',
    title: 'Fill a form',
    summary: 'Type into the fields of a PDF form and save it.',
    description: 'Fill in a PDF form in your browser — text, checkboxes, lists — and save it, optionally made final. No sign-up, nothing uploaded.',
  },
  {
    slug: 'view',
    title: 'Read a PDF',
    summary: 'Open even a 500-page PDF and page through it, with thumbnails and zoom.',
    description: 'Open a long PDF in your browser and read it with thumbnails, zoom and a page counter. The first page shows in about a tenth of a second.',
  },
] as const satisfies readonly Tool[]

export type ToolSlug = (typeof TOOLS)[number]['slug']

/** The six jobs people come for, as big tiles; the rest are listed under them. */
export const TASKS: readonly ToolSlug[] = ['sign', 'edit', 'merge', 'split', 'compress', 'images']
export const MORE: readonly ToolSlug[] = ['organize', 'fill', 'view']

export const SLUGS: readonly string[] = TOOLS.map((tool) => tool.slug)

export const SITE_TITLE = 'PDF Lab — free PDF tools in your browser'
export const SITE_DESCRIPTION =
  'Free PDF tools that run in your browser: sign, edit, merge, split, compress, convert, fill forms. No sign-up, and your files are never uploaded.'

export function toolFor(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}

export const titleFor = (tool?: Tool) => (tool ? `${tool.title} — PDF Lab` : SITE_TITLE)
