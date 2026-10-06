// Response contracts shared by route handlers and the API client. Timestamps are ISO-8601.
import type { TicketPriority, TicketStatus } from '../domain'

export interface Project {
  id: string
  name: string
  description: string
  githubRepo: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface Ticket {
  id: string
  projectId: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  version: number
  createdAt: string
  updatedAt: string
}

export interface TicketCounts {
  todo: number
  in_progress: number
  done: number
  total: number
}

export interface ProjectSummary extends Project {
  ticketCounts: TicketCounts
  recentTickets: Ticket[]
}

export interface ProjectDetail extends Project {
  ticketCounts: TicketCounts
}

export interface TicketWithProject extends Ticket {
  project: { id: string; name: string }
}

export interface TicketListMeta {
  count: number
  limit: number
  /** True when more tickets matched than `limit`; the list is cut off. */
  truncated: boolean
}

/** Normalized repository data: only what the UI renders, not GitHub's full payload. */
export interface RepoInsights {
  fullName: string
  htmlUrl: string
  description: string | null
  stars: number
  forks: number
  /** GitHub's open_issues_count, which includes open pull requests. */
  openIssuesAndPrs: number
  /** subscribers_count. GitHub's `watchers_count` is the star count, so it isn't used. */
  watchers: number
  language: string | null
  license: string | null
  defaultBranch: string
  archived: boolean
  pushedAt: string | null
  updatedAt: string
}

export interface RepoInsightsMeta {
  /** Served from our cache without contacting GitHub. */
  cached: boolean
  /** GitHub was unreachable; this is the last good copy, older than the 5-minute TTL. */
  stale: boolean
  /** When this data was fetched from (or last revalidated with) GitHub. */
  fetchedAt: string
}

export interface ApiSuccess<T, M = undefined> {
  data: T
  meta?: M
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'PROJECT_NOT_FOUND'
  | 'TICKET_NOT_FOUND'
  | 'NOT_FOUND'
  | 'PROJECT_NAME_TAKEN'
  | 'VERSION_CONFLICT'
  | 'REPO_NOT_CONNECTED'
  | 'REPO_NOT_FOUND'
  | 'GITHUB_UNAVAILABLE'
  | 'GITHUB_RATE_LIMITED'
  | 'DB_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: {
    code: ErrorCode
    message: string
    requestId: string
    details?: {
      fieldErrors?: Record<string, string[]>
      formErrors?: string[]
      current?: unknown
    }
  }
}
