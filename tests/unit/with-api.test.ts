import { DrizzleQueryError } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/server/http/errors'
import { withApi } from '@/server/http/with-api'
import { errorFields } from '@/server/logger'

const run = async (error: unknown) => {
  const handler = withApi(async () => {
    throw error
  })
  const response = await handler(new Request('http://localhost/api/x'), {})
  return { status: response.status, body: await response.json() }
}

const dbError = (code: string, params: unknown[] = ['secret ticket text']) =>
  new DrizzleQueryError(
    'select * from tickets where title = $1',
    params,
    Object.assign(new Error('pg'), { code }),
  )

describe('withApi error mapping', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  afterEach(() => consoleError.mockClear())

  it('passes AppErrors through with their status and code', async () => {
    const res = await run(new AppError(409, 'VERSION_CONFLICT', 'stale'))
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'VERSION_CONFLICT', message: 'stale' })
  })

  it('hides unexpected error details behind a generic 500', async () => {
    const res = await run(new Error('connection string postgres://admin:pw@host'))
    expect(res.status).toBe(500)
    expect(res.body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    })
    expect(JSON.stringify(res.body)).not.toContain('admin:pw')
  })

  it.each(['ECONNREFUSED', 'ECONNRESET', 'CONNECT_TIMEOUT', '57P01', '53300'])(
    'maps DB connection failure %s to a retryable 503',
    async (code) => {
      const res = await run(dbError(code))
      expect([res.status, res.body.error.code]).toEqual([503, 'DB_UNAVAILABLE'])
    },
  )

  it('maps check/length violations to 400', async () => {
    expect((await run(dbError('23514'))).status).toBe(400)
    expect((await run(dbError('22001'))).status).toBe(400)
  })

  it('never logs query parameters of failed DB queries', async () => {
    await run(dbError('XX000'))
    await run(dbError('ECONNRESET'))
    const logged = consoleError.mock.calls.flat().join('\n')
    expect(logged).toContain('database query failed')
    expect(logged).not.toContain('secret ticket text')
  })
})

describe('errorFields', () => {
  it('redacts wrapped DB errors even when the class name is minified', () => {
    const error = dbError('XX000')
    Object.defineProperty(error, 'name', { value: 'e' }) // what a production bundle looks like
    const fields = errorFields(error)
    expect(JSON.stringify(fields)).not.toContain('secret ticket text')
    expect(fields).toMatchObject({ errorMessage: 'database query failed', pgCode: 'XX000' })
  })
})
