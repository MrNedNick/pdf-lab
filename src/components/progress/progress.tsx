import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** Omit for an indeterminate bar. 0-100 otherwise. */
  value?: number
}

/** Linear progress bar. Indeterminate when `value` is omitted. */
export function Progress({ value, className, ...rest }: ProgressProps) {
  const determinate = typeof value === 'number'
  const clamped = determinate ? Math.min(100, Math.max(0, value)) : undefined

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-raised', className)}
      {...rest}
    >
      <div
        className={cn(
          'h-full rounded-full bg-accent transition-[width] duration-200',
          !determinate && 'w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite]',
        )}
        style={determinate ? { width: `${clamped}%` } : undefined}
      />
    </div>
  )
}

export interface ProgressRingProps extends HTMLAttributes<HTMLSpanElement> {
  /** Omit for an indeterminate spinner. 0-100 otherwise. */
  value?: number
  size?: number
  strokeWidth?: number
}

/** Ring progress. Indeterminate spin when `value` is omitted. */
export function ProgressRing({
  value,
  size = 32,
  strokeWidth = 3,
  className,
  ...rest
}: ProgressRingProps) {
  const determinate = typeof value === 'number'
  const clamped = determinate ? Math.min(100, Math.max(0, value)) : undefined
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = determinate ? circumference * (1 - clamped! / 100) : circumference * 0.75

  return (
    <span
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuemax={determinate ? 100 : undefined}
      className={cn('inline-block', !determinate && 'animate-spin', className)}
      {...rest}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent transition-[stroke-dashoffset] duration-200"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </span>
  )
}
