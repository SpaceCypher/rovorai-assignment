import Link from 'next/link'
import { PriorityBadge, StatusBadge } from '@/components/ticket-badges'
import { TimeAgo } from '@/components/time-ago'
import type { Ticket } from '@/shared/schemas/api'

const COLUMNS = 'md:grid md:grid-cols-[minmax(0,1fr)_8rem_6rem_7rem] md:items-center md:gap-4'

/** Rows are real links: middle-click and "open in new tab" work (skill §6). */
export function TicketList({ tickets }: { tickets: Ticket[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div
        aria-hidden
        className={`hidden border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground ${COLUMNS}`}
      >
        <span>Title</span>
        <span>Status</span>
        <span>Priority</span>
        <span className="text-right">Updated</span>
      </div>
      <ul className="divide-y" data-testid="ticket-list">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={`/tickets/${ticket.id}`}
              className={`block px-4 py-3 hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset ${COLUMNS}`}
            >
              <span className="block min-w-0">
                <span className="block truncate font-medium" title={ticket.title}>
                  {ticket.title}
                </span>
                {ticket.description && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {ticket.description}
                  </span>
                )}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:contents md:text-sm">
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-muted-foreground md:text-right md:text-xs">
                  <TimeAgo iso={ticket.updatedAt} />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Same row geometry as TicketList, so content replaces it without layout shift. */
export function TicketListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card" aria-hidden>
      <div className="hidden h-8 border-b bg-muted md:block" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 border-b px-4 py-3 last:border-0">
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
