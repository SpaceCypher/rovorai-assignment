'use client'

import { ArrowRight, FolderGit, Plus } from 'lucide-react'
import Link from 'next/link'
import { GithubIcon } from '@/components/github-icon'
import { PriorityBadge, StatusIcon } from '@/components/ticket-badges'
import { TimeAgo } from '@/components/time-ago'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProjectSummary } from '@/shared/schemas/api'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatusCounts } from './status-counts'

interface ProjectCardProps {
  project: ProjectSummary
  onCreateTicket: (project: ProjectSummary) => void
}

export function ProjectCard({ project, onCreateTicket }: ProjectCardProps) {
  const href = `/projects/${project.id}`
  return (
    <Card
      className="flex flex-col gap-0 py-0"
      data-testid="project-card"
      aria-labelledby={`project-${project.id}`}
    >
      <CardHeader className="gap-1 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`project-${project.id}`} className="min-w-0 text-base font-semibold">
            <Link
              href={href}
              title={project.name}
              className="line-clamp-1 rounded-sm break-all hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {project.name}
            </Link>
          </h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Create ticket in ${project.name}`}
                onClick={() => onCreateTicket(project)}
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New ticket</TooltipContent>
          </Tooltip>
        </div>
        <p
          className={cn(
            'line-clamp-2 min-h-10',
            project.description ? 'text-muted-foreground' : 'text-muted-foreground italic',
          )}
        >
          {project.description || 'No description'}
        </p>
        {/* Always one line, so cards side by side keep their counts and lists aligned. */}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {project.githubRepo ? (
            <GithubIcon className="size-3.5 shrink-0" />
          ) : (
            <FolderGit className="size-3.5 shrink-0" aria-hidden />
          )}
          {project.githubRepo ? (
            <span className="truncate font-mono" title={project.githubRepo}>
              {project.githubRepo}
            </span>
          ) : (
            <span className="italic">No repository</span>
          )}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 px-5 pb-4">
        <StatusCounts counts={project.ticketCounts} />

        <section aria-label="Recently updated tickets" className="flex-1">
          <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">Recently updated</h3>
          {project.recentTickets.length === 0 ? (
            <p className="py-2 text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="-mx-2">
              {project.recentTickets.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <StatusIcon status={ticket.status} label />
                    <span className="min-w-0 flex-1 truncate" title={ticket.title}>
                      {ticket.title}
                    </span>
                    <PriorityBadge priority={ticket.priority} className="text-xs" />
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      <TimeAgo iso={ticket.updatedAt} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>

      <CardFooter className="justify-between border-t px-5 py-3">
        <span className="tabular text-xs text-muted-foreground">
          {formatNumber(project.ticketCounts.total)}{' '}
          {project.ticketCounts.total === 1 ? 'ticket' : 'tickets'}
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={href} aria-label={`Open project ${project.name}`}>
            Open project <ArrowRight />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}

/** Mirrors ProjectCard's layout so content replaces it without shifting (skill §4). */
export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border bg-card" aria-hidden>
      <div className="space-y-2 px-5 pt-5 pb-4">
        <div className="h-5 w-2/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-4 px-5 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-6 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="h-12 border-t" />
    </div>
  )
}
