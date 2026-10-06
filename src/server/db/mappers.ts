import 'server-only'
import type { Project, Ticket } from '@/shared/schemas/api'
import type { ProjectRow, TicketRow } from './schema'

// DB rows → API contracts. Dates become ISO strings here, once.

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  githubRepo: row.githubRepo,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  projectId: row.projectId,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  version: row.version,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})
