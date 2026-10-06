import { StatusIcon, statusSurface } from '@/components/ticket-badges'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from '@/shared/domain'
import type { TicketCounts } from '@/shared/schemas/api'

interface StatusCountsProps {
  counts: TicketCounts
  className?: string
  /** Makes each tile a filter toggle (project page). Omitted on dashboard cards. */
  onSelect?: (status: TicketStatus) => void
  selected?: readonly TicketStatus[]
}

/** Ticket counts per status as a definition list, so labels and numbers are read together. */
export function StatusCounts({ counts, className, onSelect, selected = [] }: StatusCountsProps) {
  return (
    <dl className={cn('grid grid-cols-3 gap-2', className)}>
      {TICKET_STATUSES.map((status) => {
        const pressed = selected.includes(status)
        return (
          // Column + justify-between keeps the numbers aligned when a label wraps on mobile.
          <div
            key={status}
            // Faint per-status tint (decision L18); number and label stay in neutral text colors.
            className={cn(
              'relative flex flex-col justify-between gap-1 rounded-md px-2.5 py-2 transition-shadow sm:px-3',
              statusSurface(status),
              onSelect && 'hover:ring-2 hover:ring-border',
              pressed && 'ring-2 ring-ring hover:ring-ring',
            )}
          >
            <dt className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <StatusIcon status={status} className="mt-px" />
              {STATUS_LABELS[status]}
            </dt>
            <dd className="tabular text-lg font-semibold">
              {formatNumber(counts[status])}
              {onSelect && (
                // Inside the <dd> (a dl group may only hold dt/dd; axe), positioned against the
                // tile so the whole tile is the click target.
                <button
                  type="button"
                  aria-pressed={pressed}
                  aria-label={`Show only ${STATUS_LABELS[status]} tickets (${formatNumber(counts[status])})`}
                  onClick={() => onSelect(status)}
                  className="absolute inset-0 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                />
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
