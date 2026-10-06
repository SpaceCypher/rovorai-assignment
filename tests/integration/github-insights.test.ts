import { describe, expect, it } from 'vitest'
import { GET as getRepository } from '@/app/api/projects/[projectId]/repository/route'
import { PATCH as patchProject } from '@/app/api/projects/[projectId]/route'
import { POST as createProject } from '@/app/api/projects/route'
import { dbRepoCacheStore } from '@/server/github/cache'
import { createGithubClient } from '@/server/github/client'
import { createInsightsService } from '@/server/github/insights-service'
import { AppError } from '@/server/http/errors'
import type { Project, RepoInsights, RepoInsightsMeta } from '@/shared/schemas/api'
import { fakeFetch, githubCalls, githubReplies, ok } from './github-fake'
import { insertProject, json, params, request, type ErrorBody } from './helpers'

const MINUTE = 60_000

/** Service with a controllable clock over the real Postgres cache and the GitHub fake. */
function serviceAt(start = new Date('2026-10-06T12:00:00Z')) {
  let current = start.getTime()
  const service = createInsightsService({
    client: createGithubClient({ fetchImpl: fakeFetch }),
    store: dbRepoCacheStore,
    now: () => new Date(current),
  })
  return { service, advance: (ms: number) => (current += ms) }
}

const errorCode = (fn: () => Promise<unknown>) =>
  fn().then(
    () => 'resolved',
    (e: unknown) => (e instanceof AppError ? `${e.status} ${e.code}` : String(e)),
  )

describe('insights cache (5-minute TTL)', () => {
  it('fetches once, then serves from cache within 5 minutes with no GitHub call', async () => {
    githubReplies('a/b', ok('a/b'))
    const { service, advance } = serviceAt()

    const first = await service.getInsights('a/b')
    expect(first.meta).toMatchObject({ cached: false, stale: false })
    expect(first.insights).toMatchObject({ fullName: 'a/b', stars: 100, watchers: 7 })

    advance(4 * MINUTE + 59_000)
    const second = await service.getInsights('a/b')
    expect(second.meta).toMatchObject({
      cached: true,
      stale: false,
      fetchedAt: first.meta.fetchedAt,
    })
    expect(githubCalls).toHaveLength(1)
  })

  it('revalidates with the ETag after 5 minutes; a 304 keeps the data and resets freshness', async () => {
    githubReplies('a/b', ok('a/b', '"etag-1"'), { status: 304 })
    const { service, advance } = serviceAt()
    await service.getInsights('a/b')

    advance(5 * MINUTE)
    const revalidated = await service.getInsights('a/b')
    expect(githubCalls[1]!.headers['if-none-match']).toBe('"etag-1"')
    expect(revalidated.insights.stars).toBe(100)
    expect(revalidated.meta.cached).toBe(false)

    advance(MINUTE)
    expect((await service.getInsights('a/b')).meta.cached).toBe(true)
    expect(githubCalls).toHaveLength(2)
  })

  it('replaces cached data when GitHub returns new data', async () => {
    githubReplies('a/b', ok('a/b', '"1"'), ok('a/b', '"2"', { stargazers_count: 150 }))
    const { service, advance } = serviceAt()
    await service.getInsights('a/b')
    advance(6 * MINUTE)
    expect((await service.getInsights('a/b')).insights.stars).toBe(150)
  })

  it('shares one cache entry across differently-cased names', async () => {
    githubReplies('vercel/next.js', ok('vercel/next.js'))
    const { service } = serviceAt()
    await service.getInsights('Vercel/Next.js')
    await service.getInsights('vercel/next.js')
    expect(githubCalls).toHaveLength(1)
  })

  it('negative-caches a missing repo for the TTL', async () => {
    githubReplies('a/missing', { status: 404 })
    const { service, advance } = serviceAt()
    expect(await errorCode(() => service.getInsights('a/missing'))).toBe('404 REPO_NOT_FOUND')
    advance(MINUTE)
    expect(await errorCode(() => service.getInsights('a/missing'))).toBe('404 REPO_NOT_FOUND')
    expect(githubCalls).toHaveLength(1)
  })

  it('serves stale data marked stale when GitHub fails after expiry', async () => {
    githubReplies('a/b', ok('a/b'), 'network-error')
    const { service, advance } = serviceAt()
    const first = await service.getInsights('a/b')
    advance(10 * MINUTE)
    const stale = await service.getInsights('a/b')
    expect(stale.meta).toEqual({ cached: true, stale: true, fetchedAt: first.meta.fetchedAt })
  })

  it.each([
    [
      'rate limited (403, remaining 0)',
      { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
      '503 GITHUB_RATE_LIMITED',
    ],
    ['rate limited (429)', { status: 429 }, '503 GITHUB_RATE_LIMITED'],
    ['server error', { status: 500 }, '502 GITHUB_UNAVAILABLE'],
    ['unexpected payload', { status: 200, body: { hello: 'world' } }, '502 GITHUB_UNAVAILABLE'],
    ['network error', 'network-error' as const, '502 GITHUB_UNAVAILABLE'],
  ])('with no cached copy, %s → %s', async (_label, reply, expected) => {
    githubReplies('a/b', reply)
    const { service } = serviceAt()
    expect(await errorCode(() => service.getInsights('a/b'))).toBe(expected)
  })
})

describe('GitHub client', () => {
  it('normalizes fields and never links outside github.com', async () => {
    githubReplies(
      'a/b',
      ok('a/b', '"1"', {
        html_url: 'javascript:alert(1)',
        license: { spdx_id: 'NOASSERTION', name: 'Other' },
        pushed_at: null,
      }),
    )
    const result = await createGithubClient({ fetchImpl: fakeFetch }).getRepo('a/b')
    expect(result).toMatchObject({
      kind: 'ok',
      insights: {
        htmlUrl: 'https://github.com/a/b',
        license: 'Other',
        pushedAt: null,
        watchers: 7,
      },
    })
  })

  it('sends the token when configured, and URL-encodes path segments', async () => {
    githubReplies('a/b.c', ok('a/b.c'))
    await createGithubClient({ fetchImpl: fakeFetch, token: 'tkn' }).getRepo('a/b.c')
    expect(githubCalls[0]!.headers.authorization).toBe('Bearer tkn')
  })

  it('times out slow responses', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
      )
    const result = await createGithubClient({ fetchImpl: hang, timeoutMs: 20 }).getRepo('a/b')
    expect(result).toEqual({ kind: 'unavailable', reason: 'timeout' })
  })
})

describe('GET /api/projects/:id/repository', () => {
  const get = async (projectId: string) =>
    json<{ data: RepoInsights; meta: RepoInsightsMeta } & ErrorBody>(
      await getRepository(request(`/api/projects/${projectId}/repository`), params({ projectId })),
    )

  it('returns insights, then the cached copy', async () => {
    githubReplies('a/b', ok('a/b'))
    const p = await insertProject({ githubRepo: 'a/b' })
    const first = await get(p.id)
    expect(first.status).toBe(200)
    expect(first.body.meta.cached).toBe(false)
    expect((await get(p.id)).body.meta.cached).toBe(true)
    expect(githubCalls).toHaveLength(1)
  })

  it('404s with REPO_NOT_CONNECTED, REPO_NOT_FOUND or PROJECT_NOT_FOUND', async () => {
    const plain = await insertProject()
    expect((await get(plain.id)).body.error.code).toBe('REPO_NOT_CONNECTED')

    githubReplies('a/gone', { status: 404 })
    const gone = await insertProject({ githubRepo: 'a/gone' })
    expect((await get(gone.id)).body.error.code).toBe('REPO_NOT_FOUND')

    expect((await get('00000000-0000-4000-8000-000000000000')).body.error.code).toBe(
      'PROJECT_NOT_FOUND',
    )
  })
})

describe('repo existence check on project writes', () => {
  const create = async (body: unknown) =>
    json<{ data: Project } & ErrorBody>(
      await createProject(request('/api/projects', { method: 'POST', body }), params({})),
    )

  it('rejects a repo GitHub confirms is missing with a field error', async () => {
    githubReplies('a/typo', { status: 404 })
    const res = await create({ name: 'P', githubRepo: 'a/typo' })
    expect([res.status, res.body.error.code]).toEqual([422, 'REPO_NOT_FOUND'])
    expect(res.body.error.details?.fieldErrors?.githubRepo).toBeDefined()
  })

  it('still creates the project when GitHub is unreachable', async () => {
    githubReplies('a/b', { status: 503 })
    expect((await create({ name: 'P', githubRepo: 'a/b' })).status).toBe(201)
  })

  it('a successful check warms the insights cache', async () => {
    githubReplies('a/b', ok('a/b'))
    const res = await create({ name: 'P', githubRepo: 'a/b' })
    const insights = await json<{ meta: RepoInsightsMeta }>(
      await getRepository(request('/x'), params({ projectId: res.body.data.id })),
    )
    expect(insights.body.meta.cached).toBe(true)
    expect(githubCalls).toHaveLength(1)
  })

  it('on edit, checks only when the repo actually changes', async () => {
    const p = await insertProject({ githubRepo: 'a/b' })
    const patch = (body: unknown) =>
      patchProject(
        request(`/api/projects/${p.id}`, { method: 'PATCH', body }),
        params({ projectId: p.id }),
      )

    expect((await patch({ version: 1, githubRepo: 'A/B' })).status).toBe(200)
    expect(githubCalls).toHaveLength(0)

    githubReplies('a/other', { status: 404 })
    expect((await patch({ version: 2, githubRepo: 'a/other' })).status).toBe(422)
    expect(githubCalls).toHaveLength(1)
  })
})
