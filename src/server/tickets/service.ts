import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { LIMITS } from '@/shared/domain'
import type { Ticket, TicketListMeta, TicketWithProject } from '@/shared/schemas/api'
import type { TicketFilters } from '@/shared/schemas/filters'
import type { CreateTicket, UpdateTicket } from '@/shared/schemas/ticket'
import { db } from '../db/client'
import { toTicket } from '../db/mappers'
import { projects, tickets } from '../db/schema'
import { pgErrorCode, projectNotFound, ticketNotFound, versionConflict } from '../http/errors'
import { projectExists } from '../projects/service'
import { ticketListWhere } from './search'

const FOREIGN_KEY_VIOLATION = '23503'

export async function listTickets(
  projectId: string,
  filters: TicketFilters,
): Promise<{ tickets: Ticket[]; meta: TicketListMeta }> {
  if (!(await projectExists(projectId))) throw projectNotFound()

  const limit = LIMITS.ticketListMax
  // Fetch one extra row to know whether the list was cut off, without a COUNT(*) query.
  const rows = await db
    .select()
    .from(tickets)
    .where(ticketListWhere(projectId, filters))
    .orderBy(desc(tickets.updatedAt), desc(tickets.id))
    .limit(limit + 1)

  const truncated = rows.length > limit
  const list = rows.slice(0, limit).map(toTicket)
  return { tickets: list, meta: { count: list.length, limit, truncated } }
}

export async function getTicket(id: string): Promise<TicketWithProject> {
  const [row] = await db
    .select({ ticket: tickets, project: { id: projects.id, name: projects.name } })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.projectId))
    .where(eq(tickets.id, id))
  if (!row) throw ticketNotFound()
  return { ...toTicket(row.ticket), project: row.project }
}

export async function createTicket(projectId: string, input: CreateTicket): Promise<Ticket> {
  try {
    const [row] = await db
      .insert(tickets)
      .values({ ...input, projectId })
      .returning()
    return toTicket(row!)
  } catch (error) {
    // The project was deleted (or never existed) between the UI loading and this request.
    if (pgErrorCode(error) === FOREIGN_KEY_VIOLATION) throw projectNotFound()
    throw error
  }
}

/** Optimistic locking: the update only applies if the caller saw the latest version. */
export async function updateTicket(id: string, input: UpdateTicket): Promise<Ticket> {
  const { version, ...changes } = input
  const [row] = await db
    .update(tickets)
    .set({ ...changes, version: sql`${tickets.version} + 1`, updatedAt: sql`now()` })
    .where(and(eq(tickets.id, id), eq(tickets.version, version)))
    .returning()
  if (row) return toTicket(row)

  const [current] = await db.select().from(tickets).where(eq(tickets.id, id))
  if (!current) throw ticketNotFound()
  throw versionConflict(toTicket(current))
}

export async function deleteTicket(id: string): Promise<void> {
  const deleted = await db.delete(tickets).where(eq(tickets.id, id)).returning({ id: tickets.id })
  if (deleted.length === 0) throw ticketNotFound()
}
