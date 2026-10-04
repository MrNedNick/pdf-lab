import type { MouseEvent } from 'react'
import { TOOLS, toolFor } from './tools'
import { href, navigate, useRoute } from './lib/router'
import { ThemeToggle } from './components/layout/theme-toggle'
import { EmptyState } from './components/empty-state/empty-state'

/** Plain links that switch pages without a reload; modified clicks still open a tab. */
function link(route: string) {
  return {
    href: href(route),
    onClick: (event: MouseEvent) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
      event.preventDefault()
      navigate(route)
    },
  }
}

export default function App() {
  const route = useRoute()
  const tool = toolFor(route)

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <a {...link('')} className="mr-auto font-semibold tracking-tight">
            PDF Lab
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {tool ? (
          <section aria-labelledby="tool-title">
            <p className="text-sm">
              <a {...link('')} className="text-text-muted hover:text-accent">
                ← All tools
              </a>
            </p>
            <h1 id="tool-title" className="mt-3 text-2xl font-semibold tracking-tight">
              {tool.title}
            </h1>
            <p className="mt-1 text-text-muted">{tool.summary}</p>
            <EmptyState className="mt-6" title="Drop a PDF here" description="It stays on this device." />
          </section>
        ) : (
          <section>
            <h1 className="text-3xl font-semibold tracking-tight">PDF Lab</h1>
            <p className="mt-2 text-text-muted">Free PDF tools that run in your browser.</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {TOOLS.map((item) => (
                <li key={item.slug}>
                  <a
                    {...link(item.slug)}
                    className="block rounded-lg border border-border bg-surface-raised p-4 transition-colors hover:border-accent"
                  >
                    <span className="font-semibold">{item.title}</span>
                    <span className="mt-1 block text-sm text-text-muted">{item.summary}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  )
}
