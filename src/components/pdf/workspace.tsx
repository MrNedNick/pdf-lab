import { useState, type FormEvent } from 'react'
import { useDocument } from '../../pdf/use-document'
import { Button } from '../button/button'
import { Modal } from '../modal/modal'
import { FileDrop } from './file-drop'
import { Viewer } from './viewer'
import { OrganizeTool } from './organize-tool'
import { SplitTool } from './split-tool'
import { MergeTool } from './merge-tool'

/** The open PDF of a tool page: choose a file, unlock it if needed, look at it. */
export function Workspace({ tool }: { tool: string }) {
  const { state, openFile, unlock, close } = useDocument()
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    unlock(password)
    setPassword('')
  }

  // Merge takes several files and never has one open document.
  if (tool === 'merge') return <MergeTool />

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
