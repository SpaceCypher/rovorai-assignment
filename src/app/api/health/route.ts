import { sql } from 'drizzle-orm'
import { db } from '@/server/db/client'
import { AppError } from '@/server/http/errors'
import { ok, withApi } from '@/server/http/with-api'
import { errorFields, logger } from '@/server/logger'

export const GET = withApi(async () => {
  try {
    await db.execute(sql`select 1`)
  } catch (error) {
    logger.error('health check failed', errorFields(error))
    throw new AppError(503, 'DB_UNAVAILABLE', 'Database is unavailable')
  }
  return ok({ db: 'ok' })
})
