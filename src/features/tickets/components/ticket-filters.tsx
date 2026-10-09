'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PriorityBadge, StatusBadge } from '@/components/ticket-badges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  LIMITS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@/shared/domain'
import type { TicketFilters as Filters } from '@/shared/schemas/filters'

const SEARCH_DEBOUNCE_MS = 200 // decision L14

interface TicketFiltersProps {
  filters: Filters
  onChange: (next: Partial<Filters>) => void
  onClear: () => void
  hasFilters: boolean
}

function Chip({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        pressed
          ? 'border-primary bg-primary/10 font-medium'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted hover:shadow-sm',
      )}
    >
      {children}
    </button>
  )
}

// Same AA-checked text tones as the project summary card.
const STATUS_TEXT: Record<TicketStatus, string> = {
  todo: 'text-foreground',
  in_progress: 'text-status-progress-fg',
  done: 'text-status-done-fg',
}

const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

export function TicketFilters({ filters, onChange, onClear, hasFilters }: TicketFiltersProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(filters.q ?? '')

  // Adopt the URL's query only when it changed for another reason (Clear filters, Back),
  // never because of our own debounced write, which would drop characters typed meanwhile.
  const [lastPushed, setLastPushed] = useState(filters.q)
  const [seenQ, setSeenQ] = useState(filters.q)
  if (filters.q !== seenQ) {
    setSeenQ(filters.q)
    if (filters.q !== lastPushed) setText(filters.q ?? '')
  }

  useEffect(() => {
    const q = text.trim() || undefined
    if (q === filters.q) return
    const timer = setTimeout(() => {
      setLastPushed(q)
      onChange({ q })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, filters.q, onChange])

  // "/" focuses search from anywhere on the page (decision L13), unless the user is typing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      const typing =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    // One row: search grows, chips sit beside it, wrapping as a unit on narrow screens.
    // Container query: one row when there's room (full-width page); otherwise search gets its own
    // row and the chips sit together below it, instead of wrapping mid-group.
    <div className="@container">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full @4xl:w-auto @4xl:min-w-56 @4xl:flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            aria-label="Search tickets"
            placeholder="Search title and description"
            value={text}
            maxLength={LIMITS.searchQuery}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && text) {
                e.preventDefault()
                setText('')
              }
            }}
            className="h-9 pr-10 pl-9"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground sm:block">
            /
          </kbd>
        </div>

        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {TICKET_STATUSES.map((status: TicketStatus) => (
            <Chip
              key={status}
              pressed={filters.status.includes(status)}
              onToggle={() => onChange({ status: toggle(filters.status, status) })}
            >
              <StatusBadge status={status} className={STATUS_TEXT[status]} />
            </Chip>
          ))}
        </div>
        {/* Only where all chips fit on one line; otherwise it would strand at a wrap. */}
        <span className="hidden h-6 w-px bg-border @xl:block" aria-hidden />
        <div role="group" aria-label="Filter by priority" className="flex flex-wrap gap-1.5">
          {TICKET_PRIORITIES.map((priority: TicketPriority) => (
            <Chip
              key={priority}
              pressed={filters.priority.includes(priority)}
              onToggle={() => onChange({ priority: toggle(filters.priority, priority) })}
            >
              <PriorityBadge priority={priority} />
            </Chip>
          ))}
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  )
}
