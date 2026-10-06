import type { QueryClient } from '@tanstack/react-query'
import type { TicketFilters } from '@/shared/schemas/filters'

/** Equivalent filters (different order, duplicates) share one cache entry. */
export function normalizeFilters(filters: TicketFilters): TicketFilters {
  return {
    q: filters.q?.trim() || undefined,
    status: [...new Set(filters.status)].sort(),
    priority: [...new Set(filters.priority)].sort(),
  }
}

// Hierarchy: everything about a project lives under ['projects', id] so it can be targeted.
export const queryKeys = {
  projects: () => ['projects'] as const,
  project: (projectId: string) => ['projects', projectId] as const,
  projectTickets: (projectId: string) => ['projects', projectId, 'tickets'] as const,
  ticketList: (projectId: string, filters: TicketFilters) =>
    ['projects', projectId, 'tickets', normalizeFilters(filters)] as const,
  repository: (projectId: string) => ['projects', projectId, 'repository'] as const,
  ticket: (ticketId: string) => ['tickets', ticketId] as const,
}

/**
 * The single source of truth for "what is stale after a change" (ARCHITECTURE §9).
 * Mutations call these instead of invalidating keys ad hoc.
 */
export const invalidate = {
  /** Dashboard list only (project created). */
  projectList: (qc: QueryClient) =>
    qc.invalidateQueries({ queryKey: queryKeys.projects(), exact: true }),

  /**
   * After any ticket change in a project: dashboard card, project counts and every filtered
   * list. Repository insights are deliberately untouched; tickets don't affect them.
   */
  afterTicketChange: (qc: QueryClient, projectId: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.projects(), exact: true }),
      qc.invalidateQueries({ queryKey: queryKeys.project(projectId), exact: true }),
      qc.invalidateQueries({ queryKey: queryKeys.projectTickets(projectId) }),
    ]),

  /** After a project edit: dashboard + header; insights only if the repo changed. */
  afterProjectEdit: (qc: QueryClient, projectId: string, repoChanged: boolean) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.projects(), exact: true }),
      qc.invalidateQueries({ queryKey: queryKeys.project(projectId), exact: true }),
      repoChanged
        ? qc.invalidateQueries({ queryKey: queryKeys.repository(projectId) })
        : Promise.resolve(),
    ]),

  /**
   * After a project delete. Callers navigate away first; queries are then removed (not
   * invalidated) so nothing mounted refetches into a 404.
   */
  afterProjectDelete: (qc: QueryClient, projectId: string) => {
    qc.removeQueries({ queryKey: queryKeys.project(projectId) })
    return qc.invalidateQueries({ queryKey: queryKeys.projects(), exact: true })
  },
}
