/**
 * Every tool has its own address, so a link opens straight into the job.
 * The build copies index.html into a folder per slug for GitHub Pages.
 */
export interface Tool {
  slug: string
  title: string
  /** One line for the home page and the tool's header. */
  summary: string
}

export const TOOLS = [
  { slug: 'merge', title: 'Merge PDFs', summary: 'Put several PDFs together in the order you choose.' },
  { slug: 'split', title: 'Split a PDF', summary: 'Cut a PDF into parts or take out the pages you need.' },
  { slug: 'organize', title: 'Organize pages', summary: 'Reorder, rotate and delete pages.' },
  { slug: 'images', title: 'Images ↔ PDF', summary: 'Turn photos into a PDF, or pages into images.' },
  { slug: 'edit', title: 'Add text and marks', summary: 'Write on a page, cover a line, highlight or draw.' },
  { slug: 'sign', title: 'Sign', summary: 'Draw or type a signature and place it on the page.' },
  { slug: 'fill', title: 'Fill a form', summary: 'Type into the fields of a PDF form and save it.' },
  { slug: 'compress', title: 'Compress', summary: 'Make a PDF with photos small enough to send.' },
] as const satisfies readonly Tool[]

export type ToolSlug = (typeof TOOLS)[number]['slug']

export const SLUGS: readonly string[] = TOOLS.map((tool) => tool.slug)

export function toolFor(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug)
}
