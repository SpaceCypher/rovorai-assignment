import { beforeEach, describe, expect, it } from 'vitest'
import {
  GET as listTickets,
  POST as createTicket,
} from '@/app/api/projects/[projectId]/tickets/route'
import { DELETE, GET as getTicket, PATCH } from '@/app/api/tickets/[ticketId]/route'
import type { Ticket, TicketListMeta, TicketWithProject } from '@/shared/schemas/api'
import { LIMITS } from '@/shared/domain'
import {
  hoursAgo,
  insertProject,
  insertTicket,
  json,
  params,
  request,
  type ErrorBody,
} from './helpers'

const MISSING_ID = '00000000-0000-4000-8000-000000000000'

type ListBody = { data: Ticket[]; meta: TicketListMeta } & ErrorBody

const list = async (projectId: string, query = '') =>
  json<ListBody>(
    await listTickets(request(`/api/projects/${projectId}/tickets${query}`), params({ projectId })),
  )

const titles = (body: ListBody) => body.data.map((t) => t.title)

describe('GET /api/projects/:id/tickets (search + filters)', () => {
  let projectId: string

  beforeEach(async () => {
    const p = await insertProject()
    projectId = p.id
    const other = await insertProject()
    // Same words in another project must never leak into this project's results.
    await insertTicket(other.id, { title: 'Login page in other project' })

    await insertTicket(p.id, {
      title: 'Fix login redirect',
      status: 'todo',
      priority: 'high',
      updatedAt: hoursAgo(1),
    })
    await insertTicket(p.id, {
      title: 'Cache insights',
      description: 'login not involved',
      status: 'in_progress',
      priority: 'medium',
      updatedAt: hoursAgo(2),
    })
    await insertTicket(p.id, {
      title: 'Ship CI',
      status: 'done',
      priority: 'low',
      updatedAt: hoursAgo(3),
    })
    await insertTicket(p.id, {
      title: '100% coverage',
      status: 'todo',
      priority: 'low',
      updatedAt: hoursAgo(4),
    })
    await insertTicket(p.id, {
      title: 'snake_case names',
      status: 'done',
      priority: 'high',
      updatedAt: hoursAgo(5),
    })
  })

  it('lists all project tickets, most recently updated first', async () => {
    const res = await list(projectId)
    expect(res.status).toBe(200)
    expect(titles(res.body)).toEqual([
      'Fix login redirect',
      'Cache insights',
      'Ship CI',
      '100% coverage',
      'snake_case names',
    ])
    expect(res.body.meta).toEqual({ count: 5, limit: LIMITS.ticketListMax, truncated: false })
  })

  it('searches title and description, case-insensitively', async () => {
    expect(titles((await list(projectId, '?q=LOGIN')).body)).toEqual([
      'Fix login redirect',
      'Cache insights',
    ])
  })

  it('filters by multiple statuses and by priority', async () => {
    expect(titles((await list(projectId, '?status=todo,done')).body)).toEqual([
      'Fix login redirect',
      'Ship CI',
      '100% coverage',
      'snake_case names',
    ])
    expect(titles((await list(projectId, '?priority=high')).body)).toEqual([
      'Fix login redirect',
      'snake_case names',
    ])
  })

  it('combines search and filters with AND', async () => {
    expect(titles((await list(projectId, '?q=login&status=todo&priority=high')).body)).toEqual([
      'Fix login redirect',
    ])
    expect(titles((await list(projectId, '?q=login&status=done')).body)).toEqual([])
  })

  it('treats LIKE wildcards in the search as literal characters', async () => {
    expect(titles((await list(projectId, '?q=%25')).body)).toEqual(['100% coverage'])
    expect(titles((await list(projectId, '?q=_')).body)).toEqual(['snake_case names'])
    expect(titles((await list(projectId, '?q=!')).body)).toEqual([])
  })

  it('rejects invalid filter values and over-long searches', async () => {
    const bad = await list(projectId, '?status=blocked')
    expect([bad.status, bad.body.error.code]).toEqual([400, 'VALIDATION_ERROR'])
    expect((await list(projectId, `?q=${'a'.repeat(101)}`)).status).toBe(400)
  })

  it('404s for an unknown project', async () => {
    const res = await list(MISSING_ID)
    expect([res.status, res.body.error.code]).toEqual([404, 'PROJECT_NOT_FOUND'])
  })
})

describe('ticket list limit', () => {
  it('caps results and reports truncation', async () => {
    const p = await insertProject()
    const { db } = await import('@/server/db/client')
    const { tickets } = await import('@/server/db/schema')
    await db.insert(tickets).values(
      Array.from({ length: LIMITS.ticketListMax + 1 }, (_, i) => ({
        projectId: p.id,
        title: `T${i}`,
      })),
    )
    const res = await list(p.id)
    expect(res.body.data).toHaveLength(LIMITS.ticketListMax)
    expect(res.body.meta.truncated).toBe(true)
  })
})

describe('POST /api/projects/:id/tickets', () => {
  const create = async (projectId: string, body: unknown) =>
    json<{ data: Ticket } & ErrorBody>(
      await createTicket(
        request(`/api/projects/${projectId}/tickets`, { method: 'POST', body }),
        params({ projectId }),
      ),
    )

  it('creates a ticket with defaults', async () => {
    const p = await insertProject()
    const res = await create(p.id, { title: '  New ticket ' })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      projectId: p.id,
      title: 'New ticket',
      description: '',
      status: 'todo',
      priority: 'medium',
      version: 1,
    })
    expect(res.body.data.createdAt).toBe(res.body.data.updatedAt)
  })

  it('404s when the project does not exist (FK race included)', async () => {
    const res = await create(MISSING_ID, { title: 'x' })
    expect([res.status, res.body.error.code]).toEqual([404, 'PROJECT_NOT_FOUND'])
  })

  it('returns field errors for invalid input', async () => {
    const p = await insertProject()
    const res = await create(p.id, { title: ' ', priority: 'urgent' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.error.details!.fieldErrors!).sort()).toEqual(['priority', 'title'])
  })
})

describe('GET/PATCH/DELETE /api/tickets/:id', () => {
  const patch = async (id: string, body: unknown) =>
    json<{ data: Ticket } & ErrorBody>(
      await PATCH(
        request(`/api/tickets/${id}`, { method: 'PATCH', body }),
        params({ ticketId: id }),
      ),
    )

  it('returns the ticket with its project', async () => {
    const p = await insertProject({ name: 'Owner' })
    const t = await insertTicket(p.id)
    const res = await json<{ data: TicketWithProject }>(
      await getTicket(request(`/api/tickets/${t.id}`), params({ ticketId: t.id })),
    )
    expect(res.body.data.project).toEqual({ id: p.id, name: 'Owner' })
  })

  it('404s for missing or malformed ids', async () => {
    for (const id of [MISSING_ID, 'abc']) {
      const res = await json<ErrorBody>(
        await getTicket(request(`/api/tickets/x`), params({ ticketId: id })),
      )
      expect([res.status, res.body.error.code]).toEqual([404, 'TICKET_NOT_FOUND'])
    }
  })

  it('updates, bumps version and updatedAt, keeps createdAt', async () => {
    const p = await insertProject()
    const t = await insertTicket(p.id, { createdAt: hoursAgo(5), updatedAt: hoursAgo(5) })
    const res = await patch(t.id, { version: 1, status: 'done', title: 'Renamed' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ status: 'done', title: 'Renamed', version: 2 })
    expect(res.body.data.createdAt).toBe(t.createdAt.toISOString())
    expect(new Date(res.body.data.updatedAt).getTime()).toBeGreaterThan(t.updatedAt.getTime())
  })

  it('returns 409 with the current ticket for a stale version', async () => {
    const p = await insertProject()
    const t = await insertTicket(p.id)
    await patch(t.id, { version: 1, priority: 'high' })
    const res = await patch(t.id, { version: 1, priority: 'low' })
    expect([res.status, res.body.error.code]).toEqual([409, 'VERSION_CONFLICT'])
    expect(res.body.error.details?.current).toMatchObject({ priority: 'high', version: 2 })
  })

  it('rejects moving a ticket to another project', async () => {
    const p = await insertProject()
    const t = await insertTicket(p.id)
    expect((await patch(t.id, { version: 1, projectId: MISSING_ID })).status).toBe(400)
  })

  it('deletes once, then 404s', async () => {
    const p = await insertProject()
    const t = await insertTicket(p.id)
    const del = () =>
      DELETE(request(`/api/tickets/${t.id}`, { method: 'DELETE' }), params({ ticketId: t.id }))
    expect((await del()).status).toBe(204)
    expect((await del()).status).toBe(404)
  })
})

describe('review checks', () => {
  it('two concurrent saves of the same version: exactly one wins', async () => {
    const p = await insertProject()
    const t = await insertTicket(p.id)
    const save = (status: string) =>
      PATCH(
        request(`/api/tickets/${t.id}`, { method: 'PATCH', body: { version: 1, status } }),
        params({ ticketId: t.id }),
      )
    const statuses = (await Promise.all([save('done'), save('in_progress')]))
      .map((r) => r.status)
      .sort()
    expect(statuses).toEqual([200, 409])
  })

  it('the search query Drizzle generates uses the trigram index', async () => {
    const { db } = await import('@/server/db/client')
    const { tickets } = await import('@/server/db/schema')
    const { ticketSearchCondition } = await import('@/server/tickets/search')
    const query = db
      .select({ id: tickets.id })
      .from(tickets)
      .where(ticketSearchCondition('login'))
      .toSQL()
    // Seq scans win at test-sized tables; disable them to see whether the index is usable at all.
    const plan = await db.$client.begin(async (tx) => {
      await tx.unsafe('SET LOCAL enable_seqscan = off')
      return tx.unsafe(`EXPLAIN ${query.sql}`, query.params as never[])
    })
    expect(JSON.stringify(plan)).toContain('tickets_search_trgm_idx')
  })
})
