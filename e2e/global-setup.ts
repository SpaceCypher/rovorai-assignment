import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { E2E_DATABASE_URL } from '../playwright.config'
import { assertE2eDatabase } from './db'

/** Creates the e2e database on first run, then applies migrations. */
export default async function globalSetup() {
  assertE2eDatabase(E2E_DATABASE_URL)
  const url = new URL(E2E_DATABASE_URL)
  const dbName = url.pathname.slice(1)

  const adminUrl = new URL(E2E_DATABASE_URL)
  adminUrl.pathname = '/postgres'
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
  try {
    const [exists] = await admin`select 1 from pg_database where datname = ${dbName}`
    if (!exists) await admin.unsafe(`CREATE DATABASE "${dbName}"`)
  } finally {
    await admin.end()
  }

  const client = postgres(E2E_DATABASE_URL, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
  } finally {
    await client.end()
  }
}
