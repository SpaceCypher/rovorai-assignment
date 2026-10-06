// Parses user input into a canonical "owner/repo". Isomorphic: used by forms and the API.
// Rules follow GitHub's naming: owner is alphanumeric or '-' (max 39, no leading '-');
// repo is alphanumeric, '.', '_' or '-' (max 100), and can't be '.' or '..'.

const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/
const REPO = /^[A-Za-z0-9._-]{1,100}$/
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])

export type GithubRepoParseResult = { ok: true; value: string } | { ok: false; error: string }

const INVALID = 'Enter a GitHub repository as owner/repo or a https://github.com/owner/repo URL'

export function parseGithubRepo(input: string): GithubRepoParseResult {
  const raw = input.trim()
  if (raw === '') return { ok: false, error: INVALID }

  // Everything goes through the URL parser so query strings, fragments, "." segments and
  // percent-encoding are handled one way. Bare "owner/repo" (no dot in the first segment,
  // so it can't be a hostname) is treated as a github.com path.
  const hasScheme = /^https?:\/\//i.test(raw)
  const firstSegment = raw.split('/')[0] ?? ''
  const candidate = hasScheme
    ? raw
    : firstSegment.includes('.')
      ? `https://${raw}`
      : `https://github.com/${raw}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: INVALID }
  }
  if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: 'Only github.com repositories are supported' }
  }
  if (url.username || url.password || url.port) return { ok: false, error: INVALID }
  const path = url.pathname

  // Keep the first two segments: github.com/owner/repo/tree/main → owner/repo.
  const [owner, rawRepo] = path.split('/').filter(Boolean)
  if (!owner || !rawRepo) return { ok: false, error: INVALID }
  const repo = rawRepo.replace(/\.git$/i, '')

  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..') {
    return { ok: false, error: INVALID }
  }
  return { ok: true, value: `${owner}/${repo}` }
}

/** Cache key: GitHub names are case-insensitive. */
export function githubRepoKey(canonical: string): string {
  return canonical.toLowerCase()
}
