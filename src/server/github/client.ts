import 'server-only'
import { z } from 'zod'
import type { RepoInsights } from '@/shared/schemas/api'

export type GithubRepoResult =
  | { kind: 'ok'; insights: RepoInsights; etag: string | null }
  | { kind: 'not_modified' }
  | { kind: 'not_found' }
  | { kind: 'rate_limited' }
  | { kind: 'unavailable'; reason: string }

export interface GithubClient {
  getRepo(fullName: string, etag?: string | null): Promise<GithubRepoResult>
}

// External data: validate the fields we use instead of trusting the payload's shape.
const repoResponseSchema = z.object({
  full_name: z.string(),
  html_url: z.string(),
  description: z.string().nullable(),
  stargazers_count: z.number().int(),
  forks_count: z.number().int(),
  open_issues_count: z.number().int(),
  subscribers_count: z.number().int().optional(),
  language: z.string().nullable(),
  license: z.object({ spdx_id: z.string().nullable(), name: z.string().nullable() }).nullable(),
  default_branch: z.string(),
  archived: z.boolean(),
  pushed_at: z.string().nullable(),
  updated_at: z.string(),
})

function normalize(raw: z.infer<typeof repoResponseSchema>): RepoInsights {
  // Only ever link to github.com, whatever the payload says.
  const htmlUrl = raw.html_url.startsWith('https://github.com/')
    ? raw.html_url
    : `https://github.com/${raw.full_name}`
  const spdx = raw.license?.spdx_id
  return {
    fullName: raw.full_name,
    htmlUrl,
    description: raw.description,
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssuesAndPrs: raw.open_issues_count,
    watchers: raw.subscribers_count ?? 0,
    language: raw.language,
    // "NOASSERTION" means GitHub couldn't classify the license; show its name instead.
    license: spdx && spdx !== 'NOASSERTION' ? spdx : (raw.license?.name ?? null),
    defaultBranch: raw.default_branch,
    archived: raw.archived,
    pushedAt: raw.pushed_at,
    updatedAt: raw.updated_at,
  }
}

interface ClientOptions {
  token?: string
  timeoutMs?: number
  /** Injected in tests. Read lazily so tests can stub the global. */
  fetchImpl?: typeof fetch
}

export function createGithubClient({
  token,
  timeoutMs = 5000,
  fetchImpl,
}: ClientOptions = {}): GithubClient {
  return {
    async getRepo(fullName, etag) {
      const [owner = '', repo = ''] = fullName.split('/')
      // Path built from validated, encoded segments only: never from a user-supplied URL.
      const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'rovorai-assignment',
      }
      if (token) headers.Authorization = `Bearer ${token}`
      if (etag) headers['If-None-Match'] = etag

      let response: Response
      try {
        response = await (fetchImpl ?? globalThis.fetch)(url, {
          headers,
          // Our own Postgres cache owns freshness; keep Next's fetch cache out of it.
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        const reason =
          error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network error'
        return { kind: 'unavailable', reason }
      }

      if (response.status === 304) return { kind: 'not_modified' }
      if (response.status === 404) return { kind: 'not_found' }
      if (isRateLimited(response)) return { kind: 'rate_limited' }
      if (!response.ok)
        return { kind: 'unavailable', reason: `GitHub responded ${response.status}` }

      const parsed = repoResponseSchema.safeParse(await response.json().catch(() => null))
      if (!parsed.success) return { kind: 'unavailable', reason: 'unexpected response shape' }
      return { kind: 'ok', insights: normalize(parsed.data), etag: response.headers.get('etag') }
    },
  }
}

function isRateLimited(response: Response): boolean {
  if (response.status === 429) return true
  return (
    response.status === 403 &&
    (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'))
  )
}
