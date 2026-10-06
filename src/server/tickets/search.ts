import 'server-only'
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { TicketFilters } from '@/shared/schemas/filters'
import { tickets } from '../db/schema'

const LIKE_ESCAPE = '!'

/**
 * Escapes LIKE wildcards so user input matches literally. Uses '!' as the escape character
 * rather than '\': it needs no escaping in JS template literals or in SQL string literals.
 */
export function escapeLike(input: string): string {
  return input.replace(/[!%_]/g, (ch) => LIKE_ESCAPE + ch)
}

/**
 * Substring search over title + description. The expression must stay identical to the
 * `tickets_search_trgm_idx` index expression or Postgres can't use the index (a test checks this).
 */
export function ticketSearchCondition(q: string): SQL {
  const pattern = `%${escapeLike(q)}%`
  return sql`(${tickets.title} || ' ' || ${tickets.description}) ILIKE ${pattern} ESCAPE '!'`
}

/** WHERE clause for a project's ticket list: project AND search AND status AND priority. */
export function ticketListWhere(projectId: string, filters: TicketFilters): SQL | undefined {
  const conditions: SQL[] = [eq(tickets.projectId, projectId)]
  if (filters.q) conditions.push(ticketSearchCondition(filters.q))
  if (filters.status.length) conditions.push(inArray(tickets.status, filters.status))
  if (filters.priority.length) conditions.push(inArray(tickets.priority, filters.priority))
  return and(...conditions)
}
