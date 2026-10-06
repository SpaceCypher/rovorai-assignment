// Domain constants shared by the API and the UI. No server or DOM dependencies.

export const TICKET_STATUSES = ['todo', 'in_progress', 'done'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const LIMITS = {
  projectName: 100,
  projectDescription: 1000,
  ticketTitle: 200,
  ticketDescription: 10_000,
  searchQuery: 100,
  githubRepoInput: 300,
  /** Max tickets returned by one list request (no pagination UI; see README limitations). */
  ticketListMax: 200,
  /** Tickets shown on each dashboard card. */
  recentTicketsPerProject: 3,
} as const

/** Repository data is served from cache for this long (assignment requirement: 5 minutes). */
export const GITHUB_CACHE_TTL_SECONDS = 300
