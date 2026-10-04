import { useSyncExternalStore } from 'react'

/** The part of the address after the deploy base, without slashes: "" or "merge". */
export function routeFrom(pathname: string, base = import.meta.env.BASE_URL): string {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : pathname
  return rest.replace(/^\/+|\/+$/g, '')
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', notify)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', notify)
  }
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, () => routeFrom(location.pathname))
}

export function href(route: string): string {
  return `${import.meta.env.BASE_URL}${route ? `${route}/` : ''}`
}

/** Client-side navigation for plain links: same page, no reload. */
export function navigate(route: string) {
  history.pushState(null, '', href(route))
  window.scrollTo(0, 0)
  notify()
}

/** Props for a plain link that switches pages without a reload; modified clicks still open a tab. */
export function link(route: string) {
  return {
    href: href(route),
    onClick: (event: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number; preventDefault: () => void }) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
      event.preventDefault()
      navigate(route)
    },
  }
}
