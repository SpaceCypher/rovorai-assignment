import 'server-only'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { RepoInsights } from '@/shared/schemas/api'
import { db } from '../db/client'
import { githubRepoCache } from '../db/schema'

export type CacheEntry =
  | { status: 'ok'; insights: RepoInsights; etag: string | null; fetchedAt: Date }
  | { status: 'not_found'; fetchedAt: Date }

export interface RepoCacheStore {
  get(repoKey: string): Promise<CacheEntry | undefined>
  set(repoKey: string, entry: CacheEntry): Promise<void>
}

// Guards against payloads written by an older deploy with a different shape: treat as a miss.
const insightsSchema = z.object({
  fullName: z.string(),
  htmlUrl: z.string(),
  description: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  openIssuesAndPrs: z.number(),
  watchers: z.number(),
  language: z.string().nullable(),
  license: z.string().nullable(),
  defaultBranch: z.string(),
  archived: z.boolean(),
  pushedAt: z.string().nullable(),
  updatedAt: z.string(),
}) satisfies z.ZodType<RepoInsights>

export const dbRepoCacheStore: RepoCacheStore = {
  async get(repoKey) {
    const [row] = await db
      .select()
      .from(githubRepoCache)
      .where(eq(githubRepoCache.repoKey, repoKey))
    if (!row) return undefined
    if (row.status === 'not_found') return { status: 'not_found', fetchedAt: row.fetchedAt }
    const insights = insightsSchema.safeParse(row.payload)
    if (!insights.success) return undefined
    return { status: 'ok', insights: insights.data, etag: row.etag, fetchedAt: row.fetchedAt }
  },

  // Upsert: concurrent misses for the same repo both write; last write wins, which is harmless.
  async set(repoKey, entry) {
    const values = {
      repoKey,
      status: entry.status,
      payload: entry.status === 'ok' ? entry.insights : null,
      etag: entry.status === 'ok' ? entry.etag : null,
      fetchedAt: entry.fetchedAt,
    }
    await db
      .insert(githubRepoCache)
      .values(values)
      .onConflictDoUpdate({ target: githubRepoCache.repoKey, set: values })
  },
}
