'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@/lib/api-client'
import { invalidate, queryKeys } from '@/lib/query-keys'
import { githubRepoKey } from '@/shared/github-ref'
import type { TicketFilters } from '@/shared/schemas/filters'
import type { CreateProjectInput, UpdateProjectInput } from '@/shared/schemas/project'

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects(), queryFn: api.projects.list })
}

export function useProject(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => api.projects.get(projectId),
    enabled,
  })
}

export function useTicketList(projectId: string, filters: TicketFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ticketList(projectId, filters),
    queryFn: () => api.tickets.list(projectId, filters),
    // Keep the previous results on screen while a new search/filter loads (skill §5).
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useRepositoryInsights(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.repository(projectId),
    queryFn: () => api.repository.get(projectId),
    enabled,
    // The server owns the 5-minute TTL; this only avoids refetching on every focus.
    staleTime: 60_000,
    retry: (count, error) => count < 1 && error instanceof ApiError && error.retryable,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.projects.create(input),
    onSuccess: () => invalidate.projectList(qc),
  })
}

export function useUpdateProject(projectId: string, currentRepo: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => api.projects.update(projectId, input),
    onSuccess: (project) => {
      const before = currentRepo ? githubRepoKey(currentRepo) : null
      const after = project.githubRepo ? githubRepoKey(project.githubRepo) : null
      return invalidate.afterProjectEdit(qc, projectId, before !== after)
    },
  })
}

export function useDeleteProject(projectId: string) {
  return useMutation({ mutationFn: () => api.projects.remove(projectId) })
}
