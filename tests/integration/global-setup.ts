import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import type { TestProject } from 'vitest/node'
import { assertTestDatabase } from './guard'

/** Applies migrations once per run, exactly as production does. */
export default async function setup(project: TestProject) {
  const url = assertTestDatabase(project.config.env.DATABASE_URL)
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
  } finally {
    await client.end()
  }
}
