import { describe, expect, it } from 'vitest'
import { GET as health } from '@/app/api/health/route'
import { DELETE, GET as getOne, PATCH } from '@/app/api/projects/[projectId]/route'
import { GET as list, POST as create } from '@/app/api/projects/route'
import type {
  Project,
  ProjectDetail,
  ProjectSummary,
  TicketWithProject,
} from '@/shared/schemas/api'
import { GET as getTicket } from '@/app/api/tickets/[ticketId]/route'
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

const createProject = async (body: unknown) =>
  json<{ data: Project } & ErrorBody>(
    await create(request('/api/projects', { method: 'POST', body }), params({})),
  )

describe('GET /api/health', () => {
  it('reports the database as ok', async () => {
    const res = await json(await health(request('/api/health'), params({})))
    expect(res).toEqual({ status: 200, body: { data: { db: 'ok' } } })
  })
})

describe('GET /api/projects', () => {
  it('returns an empty list when there are no projects', async () => {
    const res = await json(await list(request('/api/projects'), params({})))
    expect(res).toEqual({ status: 200, body: { data: [] } })
  })

  it('returns counts per status and the 3 most recently updated tickets', async () => {
    const p = await insertProject({ name: 'Alpha' })
    await insertTicket(p.id, { title: 'old', status: 'done', updatedAt: hoursAgo(50) })
    await insertTicket(p.id, { title: 'newest', status: 'todo', updatedAt: hoursAgo(1) })
    await insertTicket(p.id, { title: 'second', status: 'in_progress', updatedAt: hoursAgo(2) })
    await insertTicket(p.id, { title: 'third', status: 'todo', updatedAt: hoursAgo(3) })
    const empty = await insertProject({ name: 'Empty', createdAt: hoursAgo(100) })

    const res = await json<{ data: ProjectSummary[] }>(
      await list(request('/api/projects'), params({})),
    )
    expect(res.status).toBe(200)
    const [alpha, emptyProject] = res.body.data
    expect(alpha!.ticketCounts).toEqual({ todo: 2, in_progress: 1, done: 1, total: 4 })
    expect(alpha!.recentTickets.map((t) => t.title)).toEqual(['newest', 'second', 'third'])
    expect(emptyProject!.id).toBe(empty.id)
    expect(emptyProject!.ticketCounts).toEqual({ todo: 0, in_progress: 0, done: 0, total: 0 })
    expect(emptyProject!.recentTickets).toEqual([])
  })

  it('orders projects newest first and serializes timestamps as ISO strings', async () => {
    await insertProject({ name: 'Older', createdAt: hoursAgo(10) })
    await insertProject({ name: 'Newer', createdAt: hoursAgo(1) })
    const res = await json<{ data: ProjectSummary[] }>(
      await list(request('/api/projects'), params({})),
    )
    expect(res.body.data.map((p) => p.name)).toEqual(['Newer', 'Older'])
    expect(res.body.data[0]!.createdAt).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/)
  })

  it('sets no-store and a request id on every response', async () => {
    const res = await list(request('/api/projects'), params({}))
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('POST /api/projects', () => {
  it('creates a project with a normalized repo', async () => {
    const res = await createProject({
      name: '  Web  ',
      description: 'Main app',
      githubRepo: 'https://github.com/vercel/next.js.git',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      name: 'Web',
      description: 'Main app',
      githubRepo: 'vercel/next.js',
      version: 1,
    })
  })

  it('rejects a case-insensitive duplicate name with a field error', async () => {
    await createProject({ name: 'Web' })
    const res = await createProject({ name: 'WEB' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('PROJECT_NAME_TAKEN')
    expect(res.body.error.details?.fieldErrors?.name).toBeDefined()
  })

  it('returns field errors for invalid input', async () => {
    const res = await createProject({ name: '', githubRepo: 'gitlab.com/a/b' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(res.body.error.details!.fieldErrors!)).toEqual(
      expect.arrayContaining(['name', 'githubRepo']),
    )
  })

  it('rejects unknown fields', async () => {
    const res = await createProject({ name: 'x', id: MISSING_ID })
    expect(res.status).toBe(400)
  })

  it('rejects malformed JSON, wrong content type and oversized bodies', async () => {
    const bad = await json<ErrorBody>(
      await create(request('/api/projects', { method: 'POST', body: '{"name":' }), params({})),
    )
    expect([bad.status, bad.body.error.code]).toEqual([400, 'INVALID_JSON'])

    const form = await json<ErrorBody>(
      await create(
        new Request('http://localhost/api/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'name=x',
        }),
        params({}),
      ),
    )
    expect([form.status, form.body.error.code]).toEqual([415, 'UNSUPPORTED_MEDIA_TYPE'])

    const huge = await createProject({ name: 'x', description: 'a'.repeat(70_000) })
    expect([huge.status, huge.body.error.code]).toEqual([413, 'PAYLOAD_TOO_LARGE'])
  })
})

describe('GET /api/projects/:id', () => {
  it('returns the project with counts', async () => {
    const p = await insertProject()
    await insertTicket(p.id, { status: 'done' })
    const res = await json<{ data: ProjectDetail }>(
      await getOne(request(`/api/projects/${p.id}`), params({ projectId: p.id })),
    )
    expect(res.status).toBe(200)
    expect(res.body.data.ticketCounts).toEqual({ todo: 0, in_progress: 0, done: 1, total: 1 })
  })

  it.each([MISSING_ID, 'not-a-uuid', "1' OR '1'='1"])('404s for %j', async (id) => {
    const res = await json<ErrorBody>(
      await getOne(request(`/api/projects/x`), params({ projectId: id })),
    )
    expect([res.status, res.body.error.code]).toEqual([404, 'PROJECT_NOT_FOUND'])
  })
})

describe('PATCH /api/projects/:id', () => {
  const patch = async (id: string, body: unknown) =>
    json<{ data: Project } & ErrorBody>(
      await PATCH(
        request(`/api/projects/${id}`, { method: 'PATCH', body }),
        params({ projectId: id }),
      ),
    )

  it('updates fields, bumps version and updatedAt, keeps createdAt', async () => {
    const p = await insertProject({ name: 'api', createdAt: hoursAgo(5), updatedAt: hoursAgo(5) })
    const res = await patch(p.id, { version: 1, name: 'API', githubRepo: 'a/b' })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ name: 'API', githubRepo: 'a/b', version: 2 })
    expect(res.body.data.createdAt).toBe(p.createdAt.toISOString())
    expect(new Date(res.body.data.updatedAt).getTime()).toBeGreaterThan(p.updatedAt.getTime())
  })

  it('disconnects the repo with null', async () => {
    const p = await insertProject({ githubRepo: 'a/b' })
    const res = await patch(p.id, { version: 1, githubRepo: null })
    expect(res.body.data.githubRepo).toBeNull()
  })

  it('returns 409 with the current project when the version is stale', async () => {
    const p = await insertProject()
    await patch(p.id, { version: 1, description: 'first' })
    const res = await patch(p.id, { version: 1, description: 'second' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('VERSION_CONFLICT')
    expect(res.body.error.details?.current).toMatchObject({ description: 'first', version: 2 })
  })

  it('rejects renaming onto another project name', async () => {
    await insertProject({ name: 'Taken' })
    const p = await insertProject({ name: 'Mine' })
    const res = await patch(p.id, { version: 1, name: 'taken' })
    expect([res.status, res.body.error.code]).toEqual([409, 'PROJECT_NAME_TAKEN'])
  })

  it('requires a field to change and 404s for a missing project', async () => {
    const p = await insertProject()
    expect((await patch(p.id, { version: 1 })).status).toBe(400)
    expect((await patch(MISSING_ID, { version: 1, name: 'x' })).status).toBe(404)
  })
})

describe('DELETE /api/projects/:id', () => {
  it('deletes the project and its tickets, then 404s', async () => {
    const p = await insertProject()
    const t = await insertTicket(p.id)
    const del = () =>
      DELETE(request(`/api/projects/${p.id}`, { method: 'DELETE' }), params({ projectId: p.id }))

    const first = await del()
    expect(first.status).toBe(204)
    expect(await first.text()).toBe('')
    expect((await del()).status).toBe(404)

    const ticket = await json<{ data: TicketWithProject }>(
      await getTicket(request(`/api/tickets/${t.id}`), params({ ticketId: t.id })),
    )
    expect(ticket.status).toBe(404)
  })
})
