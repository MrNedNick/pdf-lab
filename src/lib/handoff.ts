/**
 * Files dropped on the home page, waiting for the tool the user picked next.
 * Held in memory only: a reload starts clean, and nothing is ever stored.
 */
let waiting: File[] | null = null

export function give(files: File[]) {
  waiting = files
}

/**
 * Delivers the waiting files to the first tool that asks, right after it has
 * mounted. Returns a cancel for the effect cleanup: a tool that unmounts at
 * once (React's development double mount) leaves them for the next one.
 */
export function onArrival(receive: (files: File[]) => void): () => void {
  let cancelled = false
  queueMicrotask(() => {
    if (cancelled || !waiting) return
    const files = waiting
    waiting = null
    receive(files)
  })
  return () => {
    cancelled = true
  }
}
