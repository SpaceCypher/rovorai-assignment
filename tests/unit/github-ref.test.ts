import { describe, expect, it } from 'vitest'
import { githubRepoKey, parseGithubRepo } from '@/shared/github-ref'

describe('parseGithubRepo', () => {
  it.each([
    ['vercel/next.js', 'vercel/next.js'],
    ['  vercel/next.js  ', 'vercel/next.js'],
    ['vercel/next.js/', 'vercel/next.js'],
    ['https://github.com/vercel/next.js', 'vercel/next.js'],
    ['http://github.com/vercel/next.js', 'vercel/next.js'],
    ['https://www.github.com/vercel/next.js', 'vercel/next.js'],
    ['HTTPS://GitHub.com/Vercel/Next.js', 'Vercel/Next.js'],
    ['github.com/vercel/next.js', 'vercel/next.js'],
    ['https://github.com/Owner/Repo.git', 'Owner/Repo'],
    ['https://github.com/Owner/Repo.git/', 'Owner/Repo'],
    ['https://github.com/owner/repo/tree/main/src', 'owner/repo'],
    ['owner/repo?tab=readme', 'owner/repo'],
    ['https://github.com/owner/repo#readme', 'owner/repo'],
    ['owner/.github', 'owner/.github'],
    ['a-b/c_d.e', 'a-b/c_d.e'],
  ])('accepts %j → %s', (input, expected) => {
    expect(parseGithubRepo(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    [''],
    ['   '],
    ['owner'],
    ['https://github.com/owner'],
    ['https://gitlab.com/owner/repo'],
    ['https://github.com.evil.com/owner/repo'],
    ['https://evil.com/github.com/owner/repo'],
    ['https://user:pass@github.com/owner/repo'],
    ['https://github.com:8443/owner/repo'],
    ['ftp://github.com/owner/repo'],
    ['../../etc/passwd'],
    ['owner/..'],
    ['owner/.'],
    ['-owner/repo'],
    ['own_er/repo'],
    ['owner/re po'],
    ['owner/repo%2Fx'],
    ['a'.repeat(40) + '/repo'],
    ['owner/' + 'r'.repeat(101)],
    ['javascript:alert(1)'],
  ])('rejects %j', (input) => {
    expect(parseGithubRepo(input).ok).toBe(false)
  })

  it('explains non-GitHub hosts specifically', () => {
    expect(parseGithubRepo('https://gitlab.com/a/b')).toEqual({
      ok: false,
      error: 'Only github.com repositories are supported',
    })
  })

  it('cache key is case-insensitive', () => {
    expect(githubRepoKey('Vercel/Next.js')).toBe('vercel/next.js')
  })
})
