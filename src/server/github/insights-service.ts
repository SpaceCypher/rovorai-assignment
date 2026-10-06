import 'server-only'
import { GITHUB_CACHE_TTL_SECONDS } from '@/shared/domain'
import { githubRepoKey } from '@/shared/github-ref'
import type { RepoInsights, RepoInsightsMeta } from '@/shared/schemas/api'
import { getEnv } from '../env'
import { AppError } from '../http/errors'
import { logger } from '../logger'
import { dbRepoCacheStore, type RepoCacheStore } from './cache'
import { createGithubClient, type GithubClient } from './client'

export const repoNotFound = () =>
  new AppError(404, 'REPO_NOT_FOUND', 'Repository not found on GitHub, or it is private')

export interface InsightsResult {
  insights: RepoInsights
  meta: RepoInsightsMeta
}

export interface InsightsService {
  /** Throws REPO_NOT_FOUND (404), GITHUB_RATE_LIMITED (503) or GITHUB_UNAVAILABLE (502). */
  getInsights(fullName: string): Promise<InsightsResult>
  /** Best-effort existence check for writes: 'unknown' means GitHub couldn't be asked. */
  checkRepoExists(fullName: string): Promise<'exists' | 'not_found' | 'unknown'>
}

interface Deps {
  client: GithubClient
  store: RepoCacheStore
  now?: () => Date
  ttlSeconds?: number
}

export function createInsightsService({
  client,
  store,
  now = () => new Date(),
  ttlSeconds = GITHUB_CACHE_TTL_SECONDS,
}: Deps): InsightsService {
  const ttlMs = ttlSeconds * 1000

  async function getInsights(fullName: string): Promise<InsightsResult> {
    const key = githubRepoKey(fullName)
    const cached = await store.get(key)
    const isFresh = cached !== undefined && now().getTime() - cached.fetchedAt.getTime() < ttlMs

    if (cached && isFresh) {
      if (cached.status === 'not_found') throw repoNotFound()
      return { insights: cached.insights, meta: meta(true, false, cached.fetchedAt) }
    }

    const previous = cached?.status === 'ok' ? cached : undefined
    const result = await client.getRepo(fullName, previous?.etag)
    const fetchedAt = now()

    switch (result.kind) {
      case 'ok':
        await store.set(key, {
          status: 'ok',
          insights: result.insights,
          etag: result.etag,
          fetchedAt,
        })
        return { insights: result.insights, meta: meta(false, false, fetchedAt) }

      case 'not_modified':
        if (previous) {
          await store.set(key, { ...previous, fetchedAt })
          return { insights: previous.insights, meta: meta(false, false, fetchedAt) }
        }
        // 304 without a cached copy can't happen (no ETag sent); treat as an upstream fault.
        break

      case 'not_found':
        // Negative caching: don't ask GitHub about a missing repo more than once per TTL.
        await store.set(key, { status: 'not_found', fetchedAt })
        throw repoNotFound()

      case 'rate_limited':
      case 'unavailable':
        break
    }

    // GitHub couldn't answer. Serve the last good copy, marked stale, if there is one.
    logger.warn('github fetch failed', {
      repo: key,
      kind: result.kind,
      reason: result.kind === 'unavailable' ? result.reason : undefined,
      servedStale: previous !== undefined,
    })
    if (previous) return { insights: previous.insights, meta: meta(true, true, previous.fetchedAt) }
    if (result.kind === 'rate_limited') {
      throw new AppError(
        503,
        'GITHUB_RATE_LIMITED',
        'GitHub rate limit reached. Try again in a few minutes.',
      )
    }
    throw new AppError(
      502,
      'GITHUB_UNAVAILABLE',
      'GitHub is not responding right now. Try again shortly.',
    )
  }

  return {
    getInsights,
    async checkRepoExists(fullName) {
      try {
        await getInsights(fullName)
        return 'exists'
      } catch (error) {
        if (error instanceof AppError && error.code === 'REPO_NOT_FOUND') return 'not_found'
        if (error instanceof AppError && error.status >= 500) return 'unknown'
        throw error
      }
    },
  }
}

const meta = (cached: boolean, stale: boolean, fetchedAt: Date): RepoInsightsMeta => ({
  cached,
  stale,
  fetchedAt: fetchedAt.toISOString(),
})

let defaultService: InsightsService | undefined

/** App-wide instance: real GitHub client + Postgres cache. Created on first use. */
export function insightsService(): InsightsService {
  defaultService ??= createInsightsService({
    client: createGithubClient({ token: getEnv().GITHUB_TOKEN }),
    store: dbRepoCacheStore,
  })
  return defaultService
}
