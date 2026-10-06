// Stand-in for api.github.com. Integration tests must never touch the network.
type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'network-error'

interface Call {
  repo: string
  headers: Record<string, string>
}

const replies = new Map<string, Reply[]>()
export const githubCalls: Call[] = []

/** Queue replies for a repo; the last one repeats. Keys are case-insensitive like GitHub. */
export function githubReplies(repo: string, ...queue: Reply[]) {
  replies.set(repo.toLowerCase(), queue)
}

export function resetGithubFake() {
  replies.clear()
  githubCalls.length = 0
}

export function repoPayload(fullName: string, overrides: Record<string, unknown> = {}) {
  return {
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    description: 'A repository',
    stargazers_count: 100,
    watchers_count: 100,
    subscribers_count: 7,
    forks_count: 20,
    open_issues_count: 3,
    language: 'TypeScript',
    license: { spdx_id: 'MIT', name: 'MIT License' },
    default_branch: 'main',
    archived: false,
    pushed_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-02T10:00:00Z',
    ...overrides,
  }
}

export const ok = (fullName: string, etag = '"v1"', overrides = {}) => ({
  status: 200,
  body: repoPayload(fullName, overrides),
  headers: { etag },
})

export const fakeFetch: typeof fetch = async (input, init) => {
  const url = new URL(String(input))
  if (url.hostname !== 'api.github.com') throw new Error(`Unexpected outbound request: ${url}`)
  const repo = decodeURIComponent(url.pathname.replace(/^\/repos\//, '')).toLowerCase()
  githubCalls.push({ repo, headers: Object.fromEntries(new Headers(init?.headers).entries()) })

  const queue = replies.get(repo)
  const reply = queue && queue.length > 1 ? queue.shift()! : queue?.[0]
  if (!reply || reply === 'network-error') throw new TypeError('fetch failed')
  return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
    status: reply.status,
    headers: { 'content-type': 'application/json', ...reply.headers },
  })
}
