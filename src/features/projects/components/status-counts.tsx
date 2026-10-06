import { StatusIcon } from '@/components/ticket-badges'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { STATUS_LABELS, TICKET_STATUSES } from '@/shared/domain'
import type { TicketCounts } from '@/shared/schemas/api'

/** Ticket counts per status as a definition list, so labels and numbers are read together. */
export function StatusCounts({ counts, className }: { counts: TicketCounts; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-3 gap-2', className)}>
      {TICKET_STATUSES.map((status) => (
        // Column + justify-between keeps the numbers aligned when a label wraps on mobile.
        <div
          key={status}
          className="flex flex-col justify-between gap-1 rounded-md bg-muted px-2.5 py-2 sm:px-3"
        >
          <dt className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <StatusIcon status={status} className="mt-px" />
            {STATUS_LABELS[status]}
          </dt>
          <dd className="tabular text-lg font-semibold">{formatNumber(counts[status])}</dd>
        </div>
      ))}
    </dl>
  )
}
