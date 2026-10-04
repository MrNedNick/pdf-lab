import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { FAILURE_TEXT, OpenError, openPdf } from './open'

export interface PageSize {
  width: number
  height: number
}

export type DocumentState =
  | { status: 'empty' }
  | { status: 'loading'; name: string }
  | { status: 'password'; name: string; wrong: boolean }
  | { status: 'error'; name: string; message: string }
  | { status: 'ready'; name: string; bytes: Uint8Array; doc: PDFDocumentProxy; sizes: PageSize[] }

const MAX_BYTES = 200 * 1024 * 1024

/**
 * One open PDF. Page sizes start as copies of the first page and are corrected
 * in small batches in the background, so a 200-page file shows its first page
 * at once instead of after 200 round trips to the worker.
 */
export function useDocument() {
  const [state, setState] = useState<DocumentState>({ status: 'empty' })
  const pending = useRef<{ name: string; bytes: Uint8Array } | null>(null)
  const current = useRef<PDFDocumentProxy | null>(null)
  const generation = useRef(0)

  const close = useCallback(() => {
    generation.current++
    void current.current?.loadingTask.destroy()
    current.current = null
    pending.current = null
    setState({ status: 'empty' })
  }, [])

  const load = useCallback(async (name: string, bytes: Uint8Array, password?: string) => {
    const run = ++generation.current
    void current.current?.loadingTask.destroy()
    current.current = null
    setState({ status: 'loading', name })
    try {
      const doc = await openPdf(bytes, password)
      if (run !== generation.current) return void doc.loadingTask.destroy()
      current.current = doc
      pending.current = null
      const first = (await doc.getPage(1)).getViewport({ scale: 1 })
      const sizes: PageSize[] = Array.from({ length: doc.numPages }, () => ({ width: first.width, height: first.height }))
      setState({ status: 'ready', name, bytes, doc, sizes })
      for (let start = 2; start <= doc.numPages; start += 25) {
        const batch = await Promise.all(
          Array.from({ length: Math.min(25, doc.numPages - start + 1) }, (_, k) =>
            doc.getPage(start + k).then((page) => page.getViewport({ scale: 1 })),
          ),
        )
        if (run !== generation.current) return
        setState((prev) => {
          if (prev.status !== 'ready' || prev.doc !== doc) return prev
          const next = prev.sizes.slice()
          batch.forEach((viewport, k) => (next[start - 1 + k] = { width: viewport.width, height: viewport.height }))
          return { ...prev, sizes: next }
        })
      }
    } catch (error) {
      if (run !== generation.current) return
      if (error instanceof OpenError && error.reason !== 'broken') {
        pending.current = { name, bytes }
        setState({ status: 'password', name, wrong: error.reason === 'wrong-password' })
      } else setState({ status: 'error', name, message: FAILURE_TEXT.broken })
    }
  }, [])

  const openFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setState({ status: 'error', name: file.name, message: 'Choose a PDF smaller than 200 MB.' })
        return
      }
      await load(file.name, new Uint8Array(await file.arrayBuffer()))
    },
    [load],
  )

  const unlock = useCallback(
    (password: string) => {
      if (pending.current) void load(pending.current.name, pending.current.bytes, password)
    },
    [load],
  )

  useEffect(() => () => void current.current?.loadingTask.destroy(), [])

  return { state, openFile, unlock, close }
}
