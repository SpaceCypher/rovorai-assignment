'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileQuestion,
  FolderGit,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { GithubIcon } from '@/components/github-icon'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useProject, useTicketList } from '../hooks'
import { DeleteProjectDialog } from './delete-project-dialog'
import { ProjectFormDialog } from './project-form-dialog'
import { StatusCounts } from './status-counts'

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={backLink}
        title={p.name}
        description={
          <>
            <span className="block">
              {p.description || <span className="italic">No description</span>}
            </span>
            {/* Same "repo line" as the dashboard card: a link when connected, a quiet way to connect otherwise. */}
            <span className="mt-1 flex items-center gap-1.5 text-xs">
              {p.githubRepo ? (
                <GithubIcon className="size-3.5 shrink-0" />
              ) : (
                <FolderGit className="size-3.5 shrink-0" aria-hidden />
              )}
              {p.githubRepo ? (
                <a
                  href={`https://github.com/${p.githubRepo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono hover:text-foreground hover:underline"
                >
                  {p.githubRepo}
                  <span className="sr-only"> (opens GitHub in a new tab)</span>
                </a>
              ) : (
                <>
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
          </>
        }
        actions={
          <>
            {/* Non-modal: a modal menu aria-hides the page while it stays focusable (axe). */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Project actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openEdit(false)}>
                  <Pencil /> Edit project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setTicketOpen(true)}>
              <Plus /> New ticket
            </Button>
          </>
        }
      />

      <section aria-label="Ticket counts for the whole project">
        <StatusCounts counts={p.ticketCounts} className="max-w-xl" />
      </section>

      {/* The insights column exists only when there is a repo: no reserved dead space otherwise. */}
      <div
        className={
          p.githubRepo
            ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'
            : 'grid items-start gap-6'
        }
      >
        <section aria-labelledby="tickets-heading" className="min-w-0 space-y-4">
          <div className="flex items-center gap-2">
            <h2 id="tickets-heading" className="font-semibold">
              Tickets
            </h2>
            {refreshing && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            )}
            <p className="tabular ml-auto text-xs text-muted-foreground" aria-live="polite">
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
            showListSkeleton ? (
              <TicketListSkeleton />
            ) : null
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
                <TicketList tickets={tickets} />
                {meta?.truncated && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Showing the {formatNumber(meta.limit)} most recently updated. Refine your search
                    to see others.
                  </p>
                )}
              </div>
            )
          )}
        </section>

        {p.githubRepo && (
          <aside className="min-w-0 lg:sticky lg:top-6">
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
