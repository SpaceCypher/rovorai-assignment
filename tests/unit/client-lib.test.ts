import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/lib/api-client'
import { formatCompact, formatRelative } from '@/lib/format'
import { invalidate, normalizeFilters, queryKeys } from '@/lib/query-keys'
import { readFilters } from '@/lib/url-filters'

vi.mock('next/navigation', () => ({}))

const reply = (status: number, body?: unknown) =>
  vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status }))

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  it('unwraps { data } envelopes', async () => {
    vi.stubGlobal('fetch', reply(200, { data: [{ id: 'p1' }] }))
    expect(await api.projects.list()).toEqual([{ id: 'p1' }])
  })

  it('turns error envelopes into ApiError with field errors and conflict payload', async () => {
    vi.stubGlobal(
      'fetch',
      reply(409, {
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Changed elsewhere',
          requestId: 'r1',
          details: { current: { version: 3 }, fieldErrors: { title: ['Required'] } },
        },
      }),
    )
    const error = await api.tickets
      .update('t1', { version: 1, title: 'x' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'VERSION_CONFLICT',
      message: 'Changed elsewhere',
      fieldErrors: { title: ['Required'] },
      current: { version: 3 },
      requestId: 'r1',
      retryable: false,
    })
  })

  it('reports network failures as retryable NETWORK_ERROR', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    )
    const error = await api.projects.list().catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'NETWORK_ERROR', retryable: true })
  })

  it('treats a non-JSON error page as BAD_RESPONSE', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>502</html>', { status: 502 })),
    )
    expect(await api.projects.list().catch((e: unknown) => e)).toMatchObject({
      code: 'BAD_RESPONSE',
      retryable: true,
    })
  })

  it('treats deleting something already gone as success', async () => {
    vi.stubGlobal(
      'fetch',
      reply(404, { error: { code: 'TICKET_NOT_FOUND', message: 'x', requestId: 'r' } }),
    )
    await expect(api.tickets.remove('t1')).resolves.toBeUndefined()
  })

  it('builds ticket list URLs from filters', async () => {
    const fetchMock = reply(200, { data: [], meta: { count: 0, limit: 200, truncated: false } })
    vi.stubGlobal('fetch', fetchMock)
    await api.tickets.list('p1', { q: 'login', status: ['todo', 'done'], priority: [] })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/p1/tickets?q=login&status=todo%2Cdone',
      expect.anything(),
    )
  })
})

describe('query keys and invalidation map', () => {
  const seed = () => {
    const qc = new QueryClient()
    const keys = [
      queryKeys.projects(),
      queryKeys.project('p1'),
      queryKeys.ticketList('p1', { q: 'a', status: [], priority: [] }),
      queryKeys.ticketList('p1', { q: undefined, status: ['done'], priority: [] }),
      queryKeys.repository('p1'),
      queryKeys.project('p2'),
      queryKeys.ticket('t1'),
    ]
    for (const key of keys) qc.setQueryData(key, 'x')
    const stale = () =>
      qc
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.isInvalidated)
        .map((q) => JSON.stringify(q.queryKey))
        .sort()
    return { qc, stale }
  }

  it('equivalent filters share one cache key', () => {
    expect(normalizeFilters({ q: ' a ', status: ['done', 'todo', 'done'], priority: [] })).toEqual(
      normalizeFilters({ q: 'a', status: ['todo', 'done'], priority: [] }),
    )
  })

  it('a ticket change refreshes dashboard, project and all its lists, but not insights', async () => {
    const { qc, stale } = seed()
    await invalidate.afterTicketChange(qc, 'p1')
    expect(stale()).toEqual(
      [
        '["projects"]',
        '["projects","p1"]',
        '["projects","p1","tickets",{"q":"a","status":[],"priority":[]}]',
        '["projects","p1","tickets",{"status":["done"],"priority":[]}]',
      ].sort(),
    )
  })

  it('a project edit refreshes insights only when the repo changed', async () => {
    const a = seed()
    await invalidate.afterProjectEdit(a.qc, 'p1', false)
    expect(a.stale()).toEqual(['["projects","p1"]', '["projects"]'].sort())
    const b = seed()
    await invalidate.afterProjectEdit(b.qc, 'p1', true)
    expect(b.stale()).toContain('["projects","p1","repository"]')
  })

  it('a project delete removes its queries instead of refetching them', async () => {
    const { qc } = seed()
    await invalidate.afterProjectDelete(qc, 'p1')
    const remaining = qc
      .getQueryCache()
      .getAll()
      .map((q) => JSON.stringify(q.queryKey))
    expect(remaining.some((k) => k.startsWith('["projects","p1"'))).toBe(false)
    expect(remaining).toContain('["projects","p2"]')
  })
})

describe('readFilters (lenient URL parsing)', () => {
  it('keeps valid values and silently drops invalid ones', () => {
    expect(
      readFilters(
        new URLSearchParams('q=%20login%20&status=todo,bogus&status=done&priority=urgent'),
      ),
    ).toEqual({
      q: 'login',
      status: ['todo', 'done'],
      priority: [],
    })
  })

  it('caps the search length', () => {
    expect(readFilters(new URLSearchParams(`q=${'a'.repeat(150)}`)).q).toHaveLength(100)
  })
})

describe('format', () => {
  const now = new Date('2026-10-06T12:00:00Z')
  it('relative times', () => {
    expect(formatRelative('2026-10-06T11:59:40Z', now, 'en-US')).toBe('just now')
    expect(formatRelative('2026-10-06T10:00:00Z', now, 'en-US')).toBe('2 hours ago')
    expect(formatRelative('2026-10-05T12:00:00Z', now, 'en-US')).toBe('yesterday')
  })
  it('compact numbers follow the locale', () => {
    expect(formatCompact(143216, 'en-IN')).toBe('1.4L')
    expect(formatCompact(143216, 'en-US')).toBe('143.2K')
    expect(formatCompact(999, 'en-US')).toBe('999')
  })
})
