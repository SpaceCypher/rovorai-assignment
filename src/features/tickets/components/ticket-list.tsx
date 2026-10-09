import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PriorityBadge, StatusPill } from '@/components/ticket-badges'
import { TimeAgo } from '@/components/time-ago'
import { cn } from '@/lib/utils'
import type { Ticket } from '@/shared/schemas/api'

// Container queries, not viewport breakpoints: the list sits beside the insights panel on some
// pages and full width on others, so it switches to columns based on its own width.
const COLUMNS =
  '@xl:grid @xl:grid-cols-[minmax(0,1fr)_7.5rem_5.5rem_6.5rem_2.25rem] @4xl:grid-cols-[minmax(0,1fr)_7.5rem_5.5rem_6.5rem_4.5rem] @xl:items-center @xl:gap-4'

/**
 * Each row: the title is a real link stretched over the whole row (click anywhere, middle-click,
 * open in new tab all work; skill §6), plus an explicit Edit button for people who don't think to
 * click the row. A link can't contain another link, hence the stretched-link pattern.
 */
export function TicketList({ tickets, footer }: { tickets: Ticket[]; footer?: ReactNode }) {
  return (
    <div className="@container overflow-hidden rounded-lg border bg-card">
      <div
        aria-hidden
        className={`hidden border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground ${COLUMNS}`}
      >
        <span>Title</span>
        <span>Status</span>
        <span>Priority</span>
        <span className="text-right">Updated</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="divide-y" data-testid="ticket-list">
        {tickets.map((ticket) => {
          const href = `/tickets/${ticket.id}`
          return (
            <li
              key={ticket.id}
              data-testid="ticket-row"
              className={`group/row relative px-4 py-3 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:origin-top before:scale-y-0 before:bg-primary before:transition-transform before:duration-200 has-[a:hover]:bg-muted has-[a:hover]:before:scale-y-100 has-[a:focus-visible]:bg-muted ${COLUMNS}`}
            >
              <span className="block min-w-0">
                <Link
                  href={href}
                  title={ticket.title}
                  className="block truncate font-medium transition-colors group-has-[a:hover]/row:text-primary after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:ring-3 after:focus-visible:ring-ring/50 after:focus-visible:ring-inset"
                >
                  {ticket.title}
                </Link>
                {ticket.description && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {ticket.description}
                  </span>
                )}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs @xl:contents @xl:text-sm">
                <StatusPill status={ticket.status} className="w-fit" />
                <PriorityBadge priority={ticket.priority} />
                <span className="text-muted-foreground @xl:text-right @xl:text-xs">
                  <TimeAgo iso={ticket.updatedAt} />
                </span>
                {/* Above the stretched link (relative z-10) so it receives its own clicks. */}
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="relative z-10 ml-auto @xl:ml-0 @xl:justify-self-end"
                >
                  <Link href={href} aria-label={`Edit ${ticket.title}`}>
                    {/* Icon-only beside the insights panel (titles need the room); labelled when
                        wide, and on narrow screens where it sits on its own line. */}
                    <Pencil />
                    <span className="@xl:hidden @4xl:inline">Edit</span>
                  </Link>
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
      {footer}
    </div>
  )
}

/** Same row geometry as TicketList, so content replaces it without layout shift. */
export function TicketListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      className={cn('@container overflow-hidden rounded-lg border bg-card', className)}
      aria-hidden
    >
      <div className="hidden h-8 border-b bg-muted @xl:block" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 border-b px-4 py-3 last:border-0">
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
