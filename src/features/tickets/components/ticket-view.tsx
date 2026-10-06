'use client'

import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FileQuestion, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/states'
import { PriorityBadge, StatusBadge } from '@/components/ticket-badges'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api-client'
import { formatAbsolute } from '@/lib/format'
import { projectHref as lastProjectHref } from '@/lib/last-project-view'
import { invalidate, queryKeys } from '@/lib/query-keys'
import { useDelayedFlag } from '@/lib/use-delayed-flag'
import { TimeAgo } from '@/components/time-ago'
import { useTicket } from '../hooks'
import { DeleteTicketDialog } from './delete-ticket-dialog'
import { TicketEditor } from './ticket-editor'

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}

export function TicketView({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [deleted, setDeleted] = useState(false)
  const query = useTicket(ticketId, !deleted)
  const showSkeleton = useDelayedFlag(query.isPending)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const title = query.data?.title
  useEffect(() => {
    if (title) document.title = `${title} · RovorAI Tickets`
  }, [title])

  if (query.error instanceof ApiError && query.error.status === 404) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Ticket not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button asChild>
            <Link href="/">Back to projects</Link>
          </Button>
        }
      />
    )
  }
  if (query.isError) {
    return (
      <ErrorState
        title="Couldn’t load this ticket"
        error={query.error}
        onRetry={() => query.refetch()}
      />
    )
  }
  if (!query.data) {
    return (
      <div aria-busy="true" aria-label="Loading ticket" className="space-y-6">
        {showSkeleton && (
          <>
            <div className="space-y-2">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-7 w-1/2 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <div className="h-9 animate-pulse rounded bg-muted" />
                <div className="h-28 animate-pulse rounded bg-muted" />
                <div className="h-9 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            </div>
          </>
        )}
      </div>
    )
  }

  const ticket = query.data
  // Back links restore the project's last filters, the same as browser Back.
  const projectHref = lastProjectHref(ticket.projectId)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <Link
            href={projectHref}
            className="inline-flex max-w-full items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{ticket.project.name}</span>
          </Link>
        }
        title={
          // Clamped: the full title is right below in the Title field (and on hover).
          <span className="line-clamp-3" title={ticket.title}>
            {ticket.title}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="text-xs">
              <TimeAgo iso={ticket.updatedAt} prefix="Updated" />
            </span>
          </span>
        }
        actions={
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 /> Delete ticket
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-label="Edit ticket" className="rounded-xl border bg-card p-5">
          <TicketEditor key={ticket.version} ticket={ticket} />
        </section>
        <aside aria-label="Ticket details" className="rounded-xl border bg-card px-5 py-3">
          <dl className="divide-y">
            <Detail label="Project">
              <Link href={projectHref} className="break-words text-primary hover:underline">
                {ticket.project.name}
              </Link>
            </Detail>
            <Detail label="Created">
              <span title={formatAbsolute(ticket.createdAt)}>
                {formatAbsolute(ticket.createdAt)}
              </span>
            </Detail>
            <Detail label="Updated">
              <span title={formatAbsolute(ticket.updatedAt)}>
                {formatAbsolute(ticket.updatedAt)}
              </span>
            </Detail>
            <Detail label="Ticket ID">
              <span className="font-mono text-xs break-all">{ticket.id.slice(0, 8)}</span>
            </Detail>
          </dl>
        </aside>
      </div>

      <DeleteTicketDialog
        ticket={ticket}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          setDeleted(true)
          router.replace(projectHref) // replace: Back shouldn't return to a deleted ticket
          qc.removeQueries({ queryKey: queryKeys.ticket(ticket.id) })
          void invalidate.afterTicketChange(qc, ticket.projectId)
        }}
      />
    </div>
  )
}
