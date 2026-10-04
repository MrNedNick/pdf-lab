import { useState } from 'react'
import { compress, formatSize, LEVELS, verdictFor, type CompressResult, type Level } from '../../pdf/compress'
import { derivedName, download } from '../../pdf/write'
import { Button } from '../button/button'
import { Progress } from '../progress/progress'

interface Props {
  bytes: Uint8Array
  name: string
  password?: string
}

/** Shrinks the pictures inside a PDF and says plainly how much that saved — or that it could not. */
export function CompressTool({ bytes, name, password }: Props) {
  const [level, setLevel] = useState<Level>('balanced')
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [result, setResult] = useState<CompressResult | null>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setResult(null)
    setError('')
    setProgress([0, 0])
    try {
      setResult(await compress(bytes, password, level, (done, total) => setProgress([done, total])))
    } catch {
      setError('This file could not be compressed. It may use a feature the compressor does not handle; the original is unchanged.')
    } finally {
      setProgress(null)
    }
  }

  const saved = result ? 1 - result.after / result.before : 0
  const verdict = result ? verdictFor(result, level) : null

  return (
    <section aria-label="Compress" className="mt-6 space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">How much</legend>
        {(Object.keys(LEVELS) as Level[]).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="level"
              checked={level === value}
              onChange={() => {
                setLevel(value)
                setResult(null)
              }}
            />
            {LEVELS[value].label}
          </label>
        ))}
        <p className="text-xs text-text-muted">
          Photos and scanned pages inside the PDF are saved again, smaller. Real text and drawings are not touched, so they stay sharp.
        </p>
      </fieldset>

      {progress && (
        <div className="space-y-1">
          <Progress value={progress[1] ? (progress[0] / progress[1]) * 100 : undefined} aria-label="Pictures compressed" />
          <p className="text-xs text-text-muted">{progress[1] ? `Picture ${Math.min(progress[0] + 1, progress[1])} of ${progress[1]}` : 'Reading the file…'}</p>
        </div>
      )}

      <Button loading={progress !== null} disabled={progress !== null} onClick={() => void run()}>
        Compress — {formatSize(bytes.length)} now
      </Button>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div role="status">
        {result && (
          <div className="space-y-3 rounded-lg border border-border bg-surface-raised p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {formatSize(result.before)} → {formatSize(result.after)}
              {saved > 0 && <span className="ml-2 text-base font-medium text-text-muted">−{Math.round(saved * 100)}%</span>}
            </p>
            {verdict?.worthIt ? (
              <>
                <p className="text-sm text-text-muted">
                  {result.replaced} of {result.images} {result.images === 1 ? 'picture' : 'pictures'} made smaller.
                </p>
                <Button onClick={() => download(result.bytes, derivedName(name, 'compressed'))}>Download smaller PDF</Button>
              </>
            ) : (
              <p className="text-sm">{verdict?.reason}</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
