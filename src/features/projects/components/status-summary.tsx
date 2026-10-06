import { StatusIcon } from '@/components/ticket-badges'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from '@/shared/domain'
import type { TicketCounts } from '@/shared/schemas/api'

// Text tones are the AA-checked "-fg" tokens.
const TONE: Record<TicketStatus, { text: string; active: string }> = {
  todo: { text: 'text-status-todo-fg', active: 'bg-status-todo-bg' },
  in_progress: { text: 'text-status-progress-fg', active: 'bg-status-progress-bg' },
  done: { text: 'text-status-done-fg', active: 'bg-status-done-bg' },
}

interface StatusSummaryProps {
  counts: TicketCounts
  selected: readonly TicketStatus[]
  /** Segment = "show only this status"; the caller toggles it off on a second click. */
  onSelect: (status: TicketStatus) => void
}

/** Project-page summary: one card, a segment per status (each a filter toggle). */
export function StatusSummary({ counts, selected, onSelect }: StatusSummaryProps) {
  return (
    <div className="@container overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-3 divide-x">
        {TICKET_STATUSES.map((status) => {
          const pressed = selected.includes(status)
          const { text, active } = TONE[status]
          return (
            <button
              key={status}
              type="button"
              aria-pressed={pressed}
              aria-label={`Show only ${STATUS_LABELS[status]} tickets (${formatNumber(counts[status])})`}
              onClick={() => onSelect(status)}
              className={cn(
                // Label over number when the card is narrow; side by side once it has room (container query).
                'flex min-w-0 flex-col items-start gap-1 px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset @xl:flex-row @xl:items-center @xl:justify-between @xl:px-5 @xl:py-4',
                pressed && active,
              )}
            >
              <span className={cn('flex min-w-0 items-center gap-2 text-sm font-medium', text)}>
                <StatusIcon status={status} className="text-current" />
                <span className="truncate">{STATUS_LABELS[status]}</span>
              </span>
              <span data-count className={cn('tabular text-2xl font-semibold @xl:text-3xl', text)}>
                {formatNumber(counts[status])}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
