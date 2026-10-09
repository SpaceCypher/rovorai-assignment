'use client'

import { FolderKanban, Loader2, Plus, Search, SearchX } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CreateTicketDialog } from '@/features/tickets/components/create-ticket-dialog'
import { formatNumber } from '@/lib/format'
import { useDelayedFlag } from '@/lib/use-delayed-flag'
import type { ProjectSummary } from '@/shared/schemas/api'
import { useProjects } from '../hooks'
import { ProjectFormDialog } from './project-form-dialog'
import { ProjectCard, ProjectCardSkeleton } from './project-card'

export function DashboardView() {
  const projects = useProjects()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  // The dialog stays mounted for the last project used, so a draft survives an accidental close.
  const [ticketTarget, setTicketTarget] = useState<ProjectSummary | null>(null)
  const [ticketOpen, setTicketOpen] = useState(false)
  const openTicketDialog = (project: ProjectSummary) => {
    setTicketTarget(project)
    setTicketOpen(true)
  }
  const showSkeleton = useDelayedFlag(projects.isPending)

  const [query, setQuery] = useState('')
  const all = projects.data
  // Client-side on purpose: the dashboard already holds every project (no pagination), so a
  // request per keystroke would add latency for nothing. Ticket search stays server-side (PDF §5).
  const q = query.trim().toLowerCase()
  const visible = q
    ? all?.filter((p) =>
        `${p.name} ${p.description} ${p.githubRepo ?? ''}`.toLowerCase().includes(q),
      )
    : all
  const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`
  const summary = all && [
    plural(all.length, 'project'),
    plural(
      all.reduce((n, p) => n + p.ticketCounts.total, 0),
      'ticket',
    ),
    `${formatNumber(all.reduce((n, p) => n + p.ticketCounts.total - p.ticketCounts.done, 0))} open`,
  ]
  const newProjectButton = (
    <Button onClick={() => setCreateProjectOpen(true)}>
      <Plus /> New project
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Projects
            {projects.isFetching && !projects.isPending && (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-label="Refreshing"
              />
            )}
          </span>
        }
        description={
          summary ? (
            <span className="flex flex-wrap items-center gap-x-2.5">
              {summary.map((part, i) => (
                <span key={part} className="flex items-center gap-2.5">
                  {i > 0 && (
                    <span aria-hidden className="text-muted-foreground/60">
                      •
                    </span>
                  )}
                  {part}
                </span>
              ))}
            </span>
          ) : (
            ' ' // keeps the line's height while loading (no layout shift)
          )
        }
        // One primary action per view: the empty state carries it when there are no projects.
        actions={projects.data?.length === 0 ? undefined : newProjectButton}
      />

      {projects.isPending ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading projects">
          {showSkeleton && [0, 1, 2, 3].map((i) => <ProjectCardSkeleton key={i} />)}
        </div>
      ) : projects.isError ? (
        <ErrorState
          title="Couldn’t load projects"
          error={projects.error}
          onRetry={() => projects.refetch()}
        />
      ) : projects.data.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Projects group your tickets and can show stats from a public GitHub repository."
          action={newProjectButton}
        />
      ) : (
        <>
          <div className="relative max-w-xl">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search projects"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              className="h-10 bg-card pl-9"
            />
          </div>
          {visible && visible.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {visible.map((project) => (
                <ProjectCard key={project.id} project={project} onCreateTicket={openTicketDialog} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title="No projects match"
              description={`Nothing matches “${query.trim()}”.`}
              action={
                <Button variant="outline" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          )}
        </>
      )}

      <ProjectFormDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
      {ticketTarget && (
        <CreateTicketDialog
          key={ticketTarget.id}
          projectId={ticketTarget.id}
          projectName={ticketTarget.name}
          open={ticketOpen}
          onOpenChange={setTicketOpen}
        />
      )}
    </div>
  )
}
