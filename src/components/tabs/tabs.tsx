import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'

export interface TabsProps {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}

export interface TabProps {
  value: string
  children: ReactNode
  disabled?: boolean
}

export interface TabPanelProps {
  value: string
  children: ReactNode
  className?: string
  /** Keep the content (and its state) alive while another tab is shown. */
  keepMounted?: boolean
}

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
  baseId: string
  registerTab: (value: string, el: HTMLButtonElement | null) => void
  focusAdjacentTab: (from: string, direction: 1 | -1) => void
  focusEdgeTab: (edge: 'first' | 'last') => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <Tabs>`)
  return ctx
}

function tabId(baseId: string, value: string) {
  return `${baseId}-tab-${value}`
}

function panelId(baseId: string, value: string) {
  return `${baseId}-panel-${value}`
}

/**
 * Tab list with roving tabindex: only the active (or, while focus is inside
 * the list, the focused) tab sits in the Tab order, arrow keys move between
 * tabs, Home/End jump to the ends. Panels render only their own content —
 * `TabPanel` handles the `hidden` + ARIA wiring.
 */
export function Tabs({ value, onChange, children, className }: TabsProps) {
  const baseId = useId()
  const tabRefs = useRef(new Map<string, HTMLButtonElement>())

  const orderedValues = () =>
    Array.from(tabRefs.current.keys())

  const registerTab = (tabValue: string, el: HTMLButtonElement | null) => {
    if (el) tabRefs.current.set(tabValue, el)
    else tabRefs.current.delete(tabValue)
  }

  // Disabled tabs are unfocusable, so navigation must skip over them —
  // otherwise arrow keys or Home/End would silently leave focus behind.
  const focusAdjacentTab = (from: string, direction: 1 | -1) => {
    const order = orderedValues()
    const index = order.indexOf(from)
    if (index === -1) return
    for (let step = 1; step <= order.length; step++) {
      const candidate = order[(index + direction * step + order.length) % order.length]
      const el = tabRefs.current.get(candidate)
      if (el && !el.disabled) {
        el.focus()
        onChange(candidate)
        return
      }
    }
  }

  const focusEdgeTab = (edge: 'first' | 'last') => {
    const order = orderedValues()
    const sequence = edge === 'first' ? order : [...order].reverse()
    for (const candidate of sequence) {
      const el = tabRefs.current.get(candidate)
      if (el && !el.disabled) {
        el.focus()
        onChange(candidate)
        return
      }
    }
  }

  return (
    <TabsContext.Provider
      value={{ value, onChange, baseId, registerTab, focusAdjacentTab, focusEdgeTab }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 border-b border-border', className)}
    >
      {children}
    </div>
  )
}

export function Tab({ value, children, disabled }: TabProps) {
  const { value: active, onChange, baseId, registerTab, focusAdjacentTab, focusEdgeTab } =
    useTabsContext('Tab')
  const selected = value === active

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        focusAdjacentTab(value, 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        focusAdjacentTab(value, -1)
        break
      case 'Home':
        event.preventDefault()
        focusEdgeTab('first')
        break
      case 'End':
        event.preventDefault()
        focusEdgeTab('last')
        break
    }
  }

  return (
    <button
      ref={(el) => registerTab(value, el)}
      type="button"
      role="tab"
      id={tabId(baseId, value)}
      aria-controls={panelId(baseId, value)}
      aria-selected={selected}
      disabled={disabled}
      tabIndex={selected ? 0 : -1}
      onClick={() => onChange(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap',
        'transition-colors duration-150 disabled:opacity-45 disabled:cursor-not-allowed',
        selected
          ? 'border-accent text-text'
          : 'border-transparent text-text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({ value, children, className, keepMounted = false }: TabPanelProps) {
  const { value: active, baseId } = useTabsContext('TabPanel')
  const selected = value === active

  return (
    <div
      role="tabpanel"
      id={panelId(baseId, value)}
      aria-labelledby={tabId(baseId, value)}
      hidden={!selected}
      tabIndex={0}
      className={cn('py-4', className)}
    >
      {selected || keepMounted ? children : null}
    </div>
  )
}
