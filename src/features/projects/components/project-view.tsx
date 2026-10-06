'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileQuestion,
  FolderGit,
  GitBranch,
  Inbox,
  Loader2,
  Pencil,
  Plus,
  SearchX,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { RepositoryInsights } from '@/features/repository/components/repository-insights'
import { CreateTicketDialog } from '@/features/tickets/components/create-ticket-dialog'
import { TicketFilters } from '@/features/tickets/components/ticket-filters'
import { TicketList, TicketListSkeleton } from '@/features/tickets/components/ticket-list'
import { ApiError } from '@/lib/api-client'
import { formatNumber } from '@/lib/format'
import { invalidate } from '@/lib/query-keys'
import { useUrlFilters } from '@/lib/url-filters'
import { rememberProjectQuery } from '@/lib/last-project-view'
import { filtersToSearchParams } from '@/shared/schemas/filters'
import { useDelayedFlag } from '@/lib/use-delayed-flag'
import type { TicketStatus } from '@/shared/domain'
import { useProject, useTicketList } from '../hooks'
import { DeleteProjectDialog } from './delete-project-dialog'
import { ProjectFormDialog } from './project-form-dialog'
import { StatusSummary } from './status-summary'

const backLink = (
  <Link
    href="/"
    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="size-4" aria-hidden /> Projects
  </Link>
)

export function ProjectView({ projectId }: { projectId: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  // After a delete, stop all queries for this project before navigating away (no 404 refetch).
  const [deleted, setDeleted] = useState(false)
  const project = useProject(projectId, !deleted)
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters()
  const list = useTicketList(projectId, filters, !deleted)
  const showListSkeleton = useDelayedFlag(list.isPending)
  const showHeaderSkeleton = useDelayedFlag(project.isPending)

  const [ticketOpen, setTicketOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editFocusRepo, setEditFocusRepo] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const openEdit = (focusRepo: boolean) => {
    setEditFocusRepo(focusRepo)
    setEditOpen(true)
  }

  const search = filtersToSearchParams(filters).toString()
  useEffect(() => rememberProjectQuery(projectId, search), [projectId, search])

  const name = project.data?.name
  useEffect(() => {
    if (name) document.title = `${name} · RovorAI Tickets`
  }, [name])

  if (project.error instanceof ApiError && project.error.status === 404) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Project not found"
        description="It may have been deleted, or the link is wrong."
        action={
          <Button asChild>
            <Link href="/">Back to projects</Link>
          </Button>
        }
      />
    )
  }

  if (project.isError) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorState
          title="Couldn’t load this project"
          error={project.error}
          onRetry={() => project.refetch()}
        />
      </div>
    )
  }

  if (!project.data) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading project">
        {showHeaderSkeleton && (
          <>
            <div className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-7 w-1/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
            <TicketListSkeleton />
          </>
        )}
      </div>
    )
  }

  const p = project.data
  const total = p.ticketCounts.total
  const tickets = list.data?.tickets
  const meta = list.data?.meta
  const refreshing = list.isFetching && !list.isPending

  const selectStatus = (status: TicketStatus) =>
    // Segment = "show only this status"; clicking the active one again clears it.
    setFilters({
      status: filters.status.length === 1 && filters.status[0] === status ? [] : [status],
    })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={backLink}
        size="lg"
        title={p.name}
        description={
          // Description and repo share one line (wrapping on narrow screens).
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{p.description || <span className="italic">No description</span>}</span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {p.githubRepo ? (
                <>
                  <GitBranch className="size-3.5 shrink-0" aria-hidden />
                  <a
                    href={`https://github.com/${p.githubRepo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate font-mono text-sm hover:text-foreground hover:underline"
                  >
                    {p.githubRepo}
                    <span className="sr-only"> (opens GitHub in a new tab)</span>
                  </a>
                </>
              ) : (
                <>
                  <FolderGit className="size-3.5 shrink-0" aria-hidden />
                  <span className="italic">No repository</span>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    onClick={() => openEdit(true)}
                    className="rounded-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Connect
                  </button>
                </>
              )}
            </span>
          </span>
        }
        actions={
          <>
            {/* Visible actions, not a ⋯ menu: people shouldn't have to guess where edit/delete live.
                Delete sits apart from the primary action and reads as destructive. */}
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> Delete project
            </Button>
            <Button variant="outline" onClick={() => openEdit(false)}>
              <Pencil /> Edit project
            </Button>
            <Button onClick={() => setTicketOpen(true)}>
              <Plus /> New ticket
            </Button>
          </>
        }
      />

      {/* Insights sit beside the summary + tickets column, only when there is a repo (L17). */}
      <div
        className={
          p.githubRepo
            ? 'grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_16rem] xl:grid-cols-[minmax(0,1fr)_20rem]'
            : 'grid items-start gap-6'
        }
      >
        <div className="min-w-0 space-y-6">
          <section aria-label="Ticket counts for the whole project">
            <StatusSummary
              counts={p.ticketCounts}
              selected={filters.status}
              onSelect={selectStatus}
            />
          </section>

          <section aria-labelledby="tickets-heading" className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 id="tickets-heading" className="text-lg font-semibold">
                Tickets
              </h2>
              {refreshing && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              )}
              <p className="tabular ml-auto text-sm text-muted-foreground" aria-live="polite">
                {meta &&
                  (hasFilters
                    ? `${formatNumber(meta.count)} of ${formatNumber(total)} match`
                    : `${formatNumber(meta.count)} ${meta.count === 1 ? 'ticket' : 'tickets'}`)}
              </p>
            </div>

            {(total > 0 || hasFilters) && (
              <TicketFilters
                filters={filters}
                onChange={setFilters}
                onClear={clearFilters}
                hasFilters={hasFilters}
              />
            )}

            {list.isPending ? (
              // Space is reserved immediately (no layout shift for the insights panel below it on
              // mobile, Lighthouse CLS); the skeleton only becomes visible after 200 ms, so fast
              // loads never flash it.
              <TicketListSkeleton className={showListSkeleton ? undefined : 'invisible'} />
            ) : list.isError ? (
              <ErrorState
                title="Couldn’t load tickets"
                error={list.error}
                onRetry={() => list.refetch()}
              />
            ) : tickets && tickets.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={SearchX}
                  title="No tickets match these filters"
                  description={
                    filters.q
                      ? `Nothing matches “${filters.q}” with the selected filters.`
                      : 'Try other statuses or priorities.'
                  }
                  action={
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="No tickets yet"
                  description="Tickets track work in this project. Create the first one."
                  action={
                    <Button onClick={() => setTicketOpen(true)}>
                      <Plus /> New ticket
                    </Button>
                  }
                />
              )
            ) : (
              tickets && (
                // Previous results stay fully visible while new ones load (skill §4). No dimming:
                // 60% opacity pushed secondary text below AA contrast (axe, Phase 6 review).
                <div aria-busy={refreshing}>
                  <TicketList
                    tickets={tickets}
                    // A short, unfiltered list invites the next ticket instead of ending abruptly.
                    footer={
                      !hasFilters && total < 3 ? (
                        <button
                          type="button"
                          onClick={() => setTicketOpen(true)}
                          className="flex w-full items-center justify-center gap-2 border-t border-dashed px-4 py-3 font-medium text-primary hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                        >
                          <Plus className="size-4" aria-hidden /> Add another ticket
                        </button>
                      ) : undefined
                    }
                  />
                  {meta?.truncated && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing the {formatNumber(meta.limit)} most recently updated. Refine your
                      search to see others.
                    </p>
                  )}
                </div>
              )
            )}
          </section>
        </div>

        {p.githubRepo && (
          <aside className="min-w-0 md:sticky md:top-6">
            <RepositoryInsights projectId={projectId} />
          </aside>
        )}
      </div>

      <CreateTicketDialog
        projectId={p.id}
        projectName={p.name}
        open={ticketOpen}
        onOpenChange={setTicketOpen}
      />
      <ProjectFormDialog
        // Remount per saved version (fresh values) and per entry point (which field gets focus).
        key={`${p.version}-${editFocusRepo}`}
        project={p}
        open={editOpen}
        onOpenChange={setEditOpen}
        focusRepo={editFocusRepo}
      />
      <DeleteProjectDialog
        project={p}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          setDeleted(true)
          router.replace('/') // replace: Back shouldn't return to a deleted project
          void invalidate.afterProjectDelete(qc, projectId)
        }}
      />
    </div>
  )
}
