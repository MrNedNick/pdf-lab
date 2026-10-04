import { useState, type ReactNode } from 'react'
import { MORE, TASKS, toolFor, type Tool } from '../../tools'
import { give } from '../../lib/handoff'
import { link, navigate } from '../../lib/router'
import { Button } from '../button/button'
import { FileDrop } from '../pdf/file-drop'

/** Simple line icons, one per task, drawn on a 24-unit grid. */
const ICONS: Record<string, ReactNode> = {
  sign: <path d="M3 17c3-1 4-9 6-9s0 9 2 9 3-5 5-5 1 3 3 3h2M3 21h18" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  merge: <path d="M5 4h6v7H5zM13 13h6v7h-6zM8 11v4h5M16 13V9h-5" />,
  split: <path d="M6 3h12v7H6zM6 14h12v7H6zM3 12h3M18 12h3" />,
  compress: <path d="M12 3v6m0 0-3-3m3 3 3-3M12 21v-6m0 0-3 3m3-3 3 3M4 12h16" />,
  images: <path d="M4 5h11v14H4zM7 15l2.5-3 2 2.5L13 12M17 8h3v11h-8" />,
}

function Icon({ slug }: { slug: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 shrink-0 fill-none stroke-accent" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[slug]}
    </svg>
  )
}

const PDF = /\.pdf$/i

/** What can be done with what was dropped: one PDF, several PDFs, or photos. */
function choicesFor(files: File[]): { tools: Tool[]; problem?: string } {
  const pdfs = files.filter((file) => file.type === 'application/pdf' || PDF.test(file.name))
  const images = files.filter((file) => file.type.startsWith('image/'))
  if (pdfs.length && images.length) return { tools: [], problem: 'Drop either PDFs or photos — not both at once.' }
  if (images.length) return { tools: [toolFor('images')!] }
  if (pdfs.length > 1) return { tools: [toolFor('merge')!] }
  if (pdfs.length === 1) return { tools: (['sign', 'edit', 'split', 'compress', 'organize', 'fill', 'view'] as const).map((slug) => toolFor(slug)!) }
  return { tools: [], problem: 'That is not a PDF or a photo.' }
}

const what = (files: File[]) => (files.length === 1 ? files[0]!.name : `${files.length} files`)

export function Home() {
  const [dropped, setDropped] = useState<File[] | null>(null)
  const choices = dropped ? choicesFor(dropped) : null

  const open = (tool: Tool) => {
    give(dropped!)
    navigate(tool.slug)
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">PDF tools that never upload your files</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        Sign, edit, merge, split, compress and convert — all of it runs in this browser tab. No sign-up, no limits, no
        watermark.
      </p>

      <div className="mt-8">
        {choices && dropped ? (
          <div className="rounded-lg border-2 border-dashed border-accent bg-accent/5 p-6" aria-live="polite">
            <p className="font-semibold">
              {choices.problem ?? (choices.tools.length === 1 ? `Ready: ${what(dropped)}` : `What should happen to ${what(dropped)}?`)}
            </p>
            {!choices.problem && (
              <div className="mt-4 flex flex-wrap gap-2">
                {choices.tools.map((tool, index) => (
                  <Button key={tool.slug} variant={index === 0 ? 'primary' : 'outline'} onClick={() => open(tool)}>
                    {tool.slug === 'merge' ? `Merge ${dropped.length} PDFs` : tool.slug === 'images' ? `Make a PDF from ${dropped.length === 1 ? 'the photo' : `${dropped.length} photos`}` : tool.title}
                  </Button>
                ))}
              </div>
            )}
            <Button className="mt-4" size="sm" variant="ghost" onClick={() => setDropped(null)}>
              Choose other files
            </Button>
          </div>
        ) : (
          <FileDrop kind="any" multiple onFiles={setDropped} />
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Or pick what you need</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TASKS.map((slug) => {
          const tool = toolFor(slug)!
          return (
            <li key={slug}>
              <a
                {...link(slug)}
                className="flex h-full gap-3 rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-accent focus-visible:border-accent"
              >
                <Icon slug={slug} />
                <span>
                  <span className="block font-semibold">{tool.title}</span>
                  <span className="mt-1 block text-sm text-text-muted">{tool.summary}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
      <p className="mt-6 text-sm text-text-muted">
        Also:{' '}
        {MORE.map((slug, index) => (
          <span key={slug}>
            {index > 0 && ' · '}
            <a {...link(slug)} className="text-accent underline-offset-2 hover:underline">
              {toolFor(slug)!.title}
            </a>
          </span>
        ))}
      </p>
    </section>
  )
}
