import { db } from '@/server/db/client'
import { projects, tickets, type NewTicketRow } from '@/server/db/schema'
import type { ApiErrorBody } from '@/shared/schemas/api'

const BASE = 'http://localhost'

export function request(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const { method = 'GET', body, headers = {} } = init
  const hasBody = body !== undefined
  return new Request(BASE + path, {
    method,
    headers: hasBody ? { 'content-type': 'application/json', ...headers } : headers,
    body: hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })
}

export const params = <P extends Record<string, string>>(value: P) => ({
  params: Promise.resolve(value),
})

export async function json<T = unknown>(response: Response): Promise<{ status: number; body: T }> {
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T }
}

export type ErrorBody = ApiErrorBody

// ---- Direct DB fixtures (for exact timestamps and bulk data) -------------------------------

export async function insertProject(values: Partial<typeof projects.$inferInsert> = {}) {
  const [row] = await db
    .insert(projects)
    .values({ name: `Project ${crypto.randomUUID().slice(0, 8)}`, ...values })
    .returning()
  return row!
}

export async function insertTicket(projectId: string, values: Partial<NewTicketRow> = {}) {
  const [row] = await db
    .insert(tickets)
    .values({ projectId, title: 'Ticket', ...values })
    .returning()
  return row!
}

export const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000)
