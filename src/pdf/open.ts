import { GlobalWorkerOptions, getDocument, InvalidPDFException, PasswordException, PasswordResponses } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Parsing happens in pdf.js's own worker; the page stays responsive on big files.
GlobalWorkerOptions.workerSrc = workerUrl

export type OpenFailure = 'password' | 'wrong-password' | 'broken'

export class OpenError extends Error {
  readonly reason: OpenFailure
  constructor(reason: OpenFailure) {
    super(reason)
    this.reason = reason
  }
}

/** Plain words for each way a file can fail to open. */
export const FAILURE_TEXT: Record<OpenFailure, string> = {
  password: 'This PDF is protected with a password.',
  'wrong-password': 'That password did not open the file.',
  broken: 'This file is not a PDF, or it is damaged.',
}

/**
 * Opens a PDF for viewing. The bytes are copied first: pdf.js moves its buffer
 * into the worker, and the tools still need the original to write a new file.
 */
export async function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  const task = getDocument({ data: bytes.slice(), password })
  try {
    return await task.promise
  } catch (error) {
    await task.destroy().catch(() => {})
    if (error instanceof PasswordException)
      throw new OpenError(error.code === PasswordResponses.INCORRECT_PASSWORD ? 'wrong-password' : 'password')
    if (error instanceof InvalidPDFException) throw new OpenError('broken')
    // Anything else pdf.js could not make sense of is, for the person, a damaged file.
    throw new OpenError('broken')
  }
}
