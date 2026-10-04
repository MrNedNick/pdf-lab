import { useEffect, useState, type FormEvent } from 'react'
import { pdfLib } from '../../pdf/lib'
import { useDocument } from '../../pdf/use-document'
import { Button } from '../button/button'
import { Modal } from '../modal/modal'
import { FileDrop } from './file-drop'
import { Viewer } from './viewer'
import { OrganizeTool } from './organize-tool'
import { SplitTool } from './split-tool'
import { MergeTool } from './merge-tool'
import { ImagesTool } from './images-tool'
import { PdfToImages } from './pdf-to-images'
import { EditTool } from './edit-tool'
import { FormTool } from './form-tool'
import { CompressTool } from './compress-tool'

/** The open PDF of a tool page: choose a file, unlock it if needed, look at it. */
export function Workspace({ tool }: { tool: string }) {
  const { state, openFile, unlock, close } = useDocument()
  const [password, setPassword] = useState('')

  // Every tool but the plain viewer writes a file; fetch the writer while the user is still choosing.
  const writes = tool !== 'pdf-to-images' && tool !== 'view' && (tool === 'merge' || tool === 'images' || state.status === 'ready')
  useEffect(() => {
    if (!writes) return
    const warm = () => void pdfLib().catch(() => {})
    if ('requestIdleCallback' in window) {
      const handle = requestIdleCallback(warm, { timeout: 4000 })
      return () => cancelIdleCallback(handle)
    }
    const handle = setTimeout(warm, 1500)
    return () => clearTimeout(handle)
  }, [writes])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    unlock(password)
    setPassword('')
  }

  // Merge takes several files and never has one open document.
  if (tool === 'merge') return <MergeTool />
  // Images has two directions; only "PDF → images" opens a PDF, through a nested workspace.
  if (tool === 'images') return <ImagesTool pdfSide={<Workspace tool="pdf-to-images" />} />

  if (state.status === 'ready') {
    const opened = { doc: state.doc, sizes: state.sizes, bytes: state.bytes, name: state.name, password: state.password }
    return (
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="mr-auto truncate text-sm">
            <span className="font-medium">{state.name}</span>{' '}
            <span className="text-text-muted">
              · {state.doc.numPages} {state.doc.numPages === 1 ? 'page' : 'pages'}
            </span>
          </p>
          <Button size="sm" variant="outline" onClick={close}>
            Open another PDF
          </Button>
        </div>
        {tool === 'organize' ? (
          <OrganizeTool {...opened} />
        ) : tool === 'split' ? (
          <SplitTool {...opened} />
        ) : tool === 'compress' ? (
          <CompressTool {...opened} />
        ) : tool === 'fill' ? (
          <FormTool {...opened} />
        ) : tool === 'edit' || tool === 'sign' ? (
          <EditTool mode={tool} {...opened} />
        ) : tool === 'pdf-to-images' ? (
          <PdfToImages {...opened} />
        ) : (
          <Viewer doc={state.doc} sizes={state.sizes} />
        )}
      </div>
    )
  }

  return (
    <div className="mt-6">
      {state.status === 'loading' ? (
        <p role="status" className="rounded-lg border border-border px-6 py-14 text-center text-text-muted">
          Opening {state.name}…
        </p>
      ) : (
        <FileDrop onFiles={([file]) => openFile(file!)} error={state.status === 'error' ? `${state.name}: ${state.message}` : undefined} />
      )}
      <Modal
        open={state.status === 'password'}
        onClose={close}
        title="This PDF is protected"
        actions={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" form="unlock">
              Open
            </Button>
          </>
        }
      >
        <form id="unlock" onSubmit={submit} className="space-y-2">
          <label htmlFor="pdf-password" className="block text-sm">
            Password for {state.status === 'password' ? state.name : 'the file'}
          </label>
          <input
            id="pdf-password"
            type="password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2"
          />
          {state.status === 'password' && state.wrong && (
            <p role="alert" className="text-sm text-danger">
              That password did not open the file. Try again.
            </p>
          )}
        </form>
      </Modal>
    </div>
  )
}
