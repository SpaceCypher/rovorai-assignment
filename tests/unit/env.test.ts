import { describe, expect, it } from 'vitest'
import { EnvError, parseEnv } from '@/server/env'

const valid = { DATABASE_URL: 'postgres://u:p@localhost:5433/rovor' }

describe('parseEnv', () => {
  it('accepts a minimal valid config and applies defaults', () => {
    expect(parseEnv(valid)).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL: valid.DATABASE_URL,
      LOG_LEVEL: 'info',
    })
  })

  it('accepts the postgresql:// scheme', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgresql://u:p@host/db' })).not.toThrow()
  })

  it('fails when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(EnvError)
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/)
  })

  it('rejects non-postgres URLs', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://u:p@host/db' })).toThrow(/postgres/)
  })

  it('treats empty strings as unset', () => {
    const env = parseEnv({ ...valid, GITHUB_TOKEN: '', DATABASE_URL_UNPOOLED: '' })
    expect(env.GITHUB_TOKEN).toBeUndefined()
    expect(env.DATABASE_URL_UNPOOLED).toBeUndefined()
  })

  it('never echoes secret values in the error message', () => {
    const secret = 'super-secret-password'
    try {
      parseEnv({ DATABASE_URL: `mysql://user:${secret}@host/db` })
      expect.unreachable()
    } catch (error) {
      expect(String(error)).not.toContain(secret)
    }
  })

  it('rejects an unknown LOG_LEVEL', () => {
    expect(() => parseEnv({ ...valid, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/)
  })
})
