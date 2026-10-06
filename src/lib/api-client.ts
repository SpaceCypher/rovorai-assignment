// Typed client for our own API. The browser never talks to GitHub or the database directly.
import type {
  ApiErrorBody,
  ErrorCode,
  Project,
  ProjectDetail,
  ProjectSummary,
  RepoInsights,
  RepoInsightsMeta,
  Ticket,
  TicketListMeta,
  TicketWithProject,
} from '@/shared/schemas/api'
import { filtersToSearchParams, type TicketFilters } from '@/shared/schemas/filters'
import type { CreateProjectInput, UpdateProjectInput } from '@/shared/schemas/project'
import type { CreateTicketInput, UpdateTicketInput } from '@/shared/schemas/ticket'

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'BAD_RESPONSE'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ClientErrorCode,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly current?: unknown,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Worth retrying automatically: the network or the server, not the request. */
  get retryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.status >= 500
  }
}

interface Envelope<T, M> {
  data: T
  meta?: M
}

async function request<T, M = undefined>(
  path: string,
  init: RequestInit = {},
): Promise<Envelope<T, M>> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    })
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Can’t reach the server. Check your connection and try again.',
    )
  }

  if (response.status === 204) return { data: undefined as T }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error
    if (!error)
      throw new ApiError(response.status, 'BAD_RESPONSE', 'Unexpected response from the server.')
    throw new ApiError(
      response.status,
      error.code,
      error.message,
      error.details?.fieldErrors,
      error.details?.current,
      error.requestId,
    )
  }
  if (body === null || typeof body !== 'object' || !('data' in body)) {
    throw new ApiError(response.status, 'BAD_RESPONSE', 'Unexpected response from the server.')
  }
  return body as Envelope<T, M>
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
})

/** Deleting something already gone is a success from the user's point of view (EXT-4). */
async function remove(path: string): Promise<void> {
  try {
    await request(path, { method: 'DELETE' })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return
    throw error
  }
}

const data = <T, M>(envelope: Envelope<T, M>) => envelope.data

export const api = {
  projects: {
    list: () => request<ProjectSummary[]>('/api/projects').then(data),
    get: (id: string) => request<ProjectDetail>(`/api/projects/${id}`).then(data),
    create: (input: CreateProjectInput) =>
      request<Project>('/api/projects', json('POST', input)).then(data),
    update: (id: string, input: UpdateProjectInput) =>
      request<Project>(`/api/projects/${id}`, json('PATCH', input)).then(data),
    remove: (id: string) => remove(`/api/projects/${id}`),
  },
  tickets: {
    list: async (projectId: string, filters: TicketFilters) => {
      const qs = filtersToSearchParams(filters).toString()
      const { data: tickets, meta } = await request<Ticket[], TicketListMeta>(
        `/api/projects/${projectId}/tickets${qs ? `?${qs}` : ''}`,
      )
      return { tickets, meta: meta! }
    },
    get: (id: string) => request<TicketWithProject>(`/api/tickets/${id}`).then(data),
    create: (projectId: string, input: CreateTicketInput) =>
      request<Ticket>(`/api/projects/${projectId}/tickets`, json('POST', input)).then(data),
    update: (id: string, input: UpdateTicketInput) =>
      request<Ticket>(`/api/tickets/${id}`, json('PATCH', input)).then(data),
    remove: (id: string) => remove(`/api/tickets/${id}`),
  },
  repository: {
    get: async (projectId: string) => {
      const { data: insights, meta } = await request<RepoInsights, RepoInsightsMeta>(
        `/api/projects/${projectId}/repository`,
      )
      return { insights, meta: meta! }
    },
  },
}
