'use client'

import {
  Archive,
  CircleDot,
  Clock,
  Code,
  ExternalLink,
  Eye,
  GitBranch,
  GitFork,
  RefreshCw,
  Scale,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
import { Button } from '@/components/ui/button'
import { useProject, useRepositoryInsights } from '@/features/projects/hooks'
import { ApiError } from '@/lib/api-client'
import { errorMessage } from '@/lib/error-message'
import { formatCompact, formatNumber } from '@/lib/format'
import { useDelayedFlag } from '@/lib/use-delayed-flag'
import type { RepoInsights } from '@/shared/schemas/api'

// Icons are decorative: the visible label is the accessible name.
function Metric({
  icon: Icon,
  label,
  value,
  full,
}: {
  icon: LucideIcon
  label: string
  value: string
  full?: string
}) {
  return (
    // Column + justify-between: numbers stay aligned when a label wraps (same fix as count tiles).
    <div className="flex flex-col justify-between gap-1 rounded-md bg-muted px-3 py-2">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="tabular truncate text-2xl font-semibold" title={full ?? value}>
        {value}
      </dd>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <dt className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  )
}

function InsightsBody({ insights }: { insights: RepoInsights }) {
  const count = (n: number) => ({ value: formatCompact(n), full: formatNumber(n) })
  return (
    <>
      <dl className="grid grid-cols-2 gap-2">
        <Metric icon={Star} label="Stars" {...count(insights.stars)} />
        <Metric icon={GitFork} label="Forks" {...count(insights.forks)} />
        <Metric icon={CircleDot} label="Issues & PRs" {...count(insights.openIssuesAndPrs)} />
        <Metric icon={Eye} label="Watchers" {...count(insights.watchers)} />
      </dl>
      <dl className="divide-y">
        {/* PDF §8 "last updated information". Uses pushed_at (last code push): GitHub's
            updated_at also changes when someone stars the repo, so it says little about activity. */}
        <Detail icon={Clock} label="Last updated">
          {insights.pushedAt ? (
            <span title="Last code push to the repository">
              <TimeAgo iso={insights.pushedAt} />
            </span>
          ) : (
            'No pushes yet'
          )}
        </Detail>
        <Detail icon={Code} label="Language">
          {insights.language ?? '—'}
        </Detail>
        <Detail icon={Scale} label="License">
          {insights.license ?? 'None'}
        </Detail>
        <Detail icon={GitBranch} label="Default branch">
          <span className="font-mono text-xs">{insights.defaultBranch}</span>
        </Detail>
      </dl>
    </>
  )
}

const ERROR_TITLES: Partial<Record<string, string>> = {
  REPO_NOT_FOUND: 'Repository not found',
  GITHUB_RATE_LIMITED: 'GitHub rate limit reached',
  GITHUB_UNAVAILABLE: 'GitHub isn’t responding',
}

/**
 * Loads independently of the rest of the page: a GitHub problem never blocks tickets (PSCR-8).
 * The browser only calls our API; GitHub is reached server-side and cached for 5 minutes.
 */
export function RepositoryInsights({ projectId }: { projectId: string }) {
  const project = useProject(projectId)
  const repo = project.data?.githubRepo ?? null
  const query = useRepositoryInsights(projectId, repo !== null)
  const showSkeleton = useDelayedFlag(query.isPending)

  if (!repo) return null

  const error = query.error instanceof ApiError ? query.error : null
  const isNotFound = error?.code === 'REPO_NOT_FOUND'

  return (
    <section aria-labelledby="repo-heading" className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="repo-heading" className="font-semibold">
            Repository insights
          </h2>
          <a
            href={query.data?.insights.htmlUrl ?? `https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 font-mono text-xs text-primary hover:underline"
          >
            <span className="truncate">{query.data?.insights.fullName ?? repo}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">(opens GitHub in a new tab)</span>
          </a>
        </div>
        {query.data?.insights.archived && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Archive className="size-3" aria-hidden /> Archived
          </span>
        )}
      </div>

      {query.isPending ? (
        <div aria-busy="true" aria-label="Loading repository insights" className="space-y-2">
          {showSkeleton && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                ))}
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-muted" />
              ))}
            </>
          )}
        </div>
      ) : query.isError ? (
        <div role="alert" className="space-y-3">
          <div>
            <p className="font-medium">
              {(error && ERROR_TITLES[error.code]) ?? 'Couldn’t load repository data'}
            </p>
            <p className="text-muted-foreground">
              {isNotFound
                ? 'It may have been renamed, deleted or made private. Edit the project to update it.'
                : errorMessage(query.error)}
            </p>
          </div>
          {!isNotFound && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={query.isFetching ? 'animate-spin' : undefined} /> Try again
            </Button>
          )}
        </div>
      ) : (
        <>
          <InsightsBody insights={query.data.insights} />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {query.data.meta.stale ? (
              <span className="text-priority-medium">
                GitHub is unavailable. Showing data from <TimeAgo iso={query.data.meta.fetchedAt} />
                .
              </span>
            ) : (
              <>
                From GitHub <TimeAgo iso={query.data.meta.fetchedAt} />
                {query.data.meta.cached && ' · cached'}
              </>
            )}
          </p>
        </>
      )}
    </section>
  )
}
