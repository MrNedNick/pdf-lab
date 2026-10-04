import { lazy, Suspense, useEffect } from 'react'
import { titleFor, toolFor } from './tools'
import { Home } from './components/layout/home'
import { link, useRoute } from './lib/router'
import { ThemeToggle } from './components/layout/theme-toggle'

// pdf.js is large; the home page never needs it, so the tool area loads on demand.
const Workspace = lazy(() => import('./components/pdf/workspace').then((module) => ({ default: module.Workspace })))

export default function App() {
  const route = useRoute()
  const tool = toolFor(route)

  // The static page carries the right title for a direct visit; in-app navigation keeps it in step.
  useEffect(() => {
    document.title = titleFor(tool)
  }, [tool])

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
            <Suspense fallback={<p className="mt-6 text-sm text-text-muted">Loading the PDF tools…</p>}>
              <Workspace key={tool.slug} tool={tool.slug} />
            </Suspense>
          </section>
        ) : (
          <Home />
        )}
      </main>
    </div>
  )
}
