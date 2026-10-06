import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, vi } from 'vitest'
import { closeDb, db } from '@/server/db/client'
import { fakeFetch, resetGithubFake } from './github-fake'
import { assertTestDatabase } from './guard'

assertTestDatabase(process.env.DATABASE_URL)

// Every outbound request goes to the GitHub fake; anything else throws.
vi.stubGlobal('fetch', fakeFetch)

beforeEach(async () => {
  resetGithubFake()
  await db.execute(sql`TRUNCATE tickets, projects, github_repo_cache`)
})

afterAll(async () => {
  await closeDb()
})
