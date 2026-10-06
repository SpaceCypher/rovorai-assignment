import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getEnv } from '../env'
import * as schema from './schema'

function createSql(url: string) {
  return postgres(url, {
    // Each serverless instance handles one request at a time; a small pool is plenty and
    // keeps us far below Neon's pooler limits when many instances are warm.
    max: 5,
    // Required behind PgBouncer in transaction mode (Neon's pooled endpoint).
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  })
}

// `next dev` re-evaluates modules on every edit. Reuse one pool across reloads so we don't
// leak connections. In production each instance evaluates this module exactly once.
const globalForDb = globalThis as typeof globalThis & { __rovorSql?: postgres.Sql }

const env = getEnv()
const sql = globalForDb.__rovorSql ?? createSql(env.DATABASE_URL)
if (env.NODE_ENV !== 'production') globalForDb.__rovorSql = sql

export const db = drizzle(sql, { schema })
export type Db = typeof db
