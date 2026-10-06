import { z } from 'zod'
import { LIMITS, TICKET_PRIORITIES, TICKET_STATUSES } from '../domain'

/**
 * Accepts `?status=todo,done` and `?status=todo&status=done` (and mixes). Values are
 * de-duplicated; an empty list means "no filter".
 */
const enumList = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z
    .array(z.string())
    .transform((raw) =>
      raw
        .flatMap((v) => v.split(','))
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.enum(values, { error: `Invalid ${label}. Allowed: ${values.join(', ')}` })))
    .transform((list) => [...new Set(list)])

export const ticketFiltersSchema = z.object({
  q: z
    .string()
    .trim()
    .max(LIMITS.searchQuery, `Search must be at most ${LIMITS.searchQuery} characters`)
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  status: enumList(TICKET_STATUSES, 'status'),
  priority: enumList(TICKET_PRIORITIES, 'priority'),
})

export type TicketFilters = z.output<typeof ticketFiltersSchema>

/** Builds the schema input from URLSearchParams (used by the API and the UI's URL state). */
export function filtersFromSearchParams(params: URLSearchParams) {
  return {
    q: params.get('q') ?? undefined,
    status: params.getAll('status'),
    priority: params.getAll('priority'),
  }
}

/** Inverse of filtersFromSearchParams; omits empty values so URLs stay clean. */
export function filtersToSearchParams(filters: Partial<TicketFilters>): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.status?.length) params.set('status', filters.status.join(','))
  if (filters.priority?.length) params.set('priority', filters.priority.join(','))
  return params
}
