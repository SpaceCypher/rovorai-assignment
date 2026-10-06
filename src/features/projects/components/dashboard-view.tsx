'use client'

import { FolderKanban, Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { CreateTicketDialog } from '@/features/tickets/components/create-ticket-dialog'
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

  const count = projects.data?.length
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
        description={count === undefined ? ' ' : `${count} ${count === 1 ? 'project' : 'projects'}`}
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
        <div className="grid gap-4 md:grid-cols-2">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} onCreateTicket={openTicketDialog} />
          ))}
        </div>
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
