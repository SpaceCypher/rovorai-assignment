/**
 * Seeds the database with review data.
 *
 *   pnpm db:seed            Reset + insert. Local databases only (refuses remote hosts).
 *   pnpm db:seed:if-empty   Insert only when there are no projects. Safe for production.
 *
 * Runs in a single transaction, so a failure leaves the database unchanged.
 */
import { loadEnvConfig } from '@next/env'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { githubRepoCache, projects, tickets, type NewTicketRow } from '../src/server/db/schema'
import { seedProjects } from './seed-data'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const HOUR_MS = 60 * 60 * 1000

async function main() {
  loadEnvConfig(process.cwd())
  const ifEmpty = process.argv.includes('--if-empty')

  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  const host = new URL(url).hostname
  if (!ifEmpty && !LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to reset a non-local database (${host}). Use "pnpm db:seed:if-empty" instead.`,
    )
  }

  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client)

  try {
    const result = await db.transaction(async (tx) => {
      if (ifEmpty) {
        const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(projects)
        if ((row?.n ?? 0) > 0) return { skipped: true as const, existing: row?.n ?? 0 }
      } else {
        await tx.execute(sql`TRUNCATE ${tickets}, ${projects}, ${githubRepoCache}`)
      }

      const now = Date.now()
      let ticketCount = 0
      for (const [index, project] of seedProjects.entries()) {
        // Stagger project creation so "newest first" ordering on the dashboard is stable.
        const createdAt = new Date(now - (seedProjects.length - index) * 24 * HOUR_MS)
        const [inserted] = await tx
          .insert(projects)
          .values({
            name: project.name,
            description: project.description,
            githubRepo: project.githubRepo,
            createdAt,
            updatedAt: createdAt,
          })
          .returning({ id: projects.id })
        if (!inserted) throw new Error(`Failed to insert project ${project.name}`)

        const rows: NewTicketRow[] = project.tickets.map((t) => ({
          projectId: inserted.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          createdAt: new Date(now - t.createdHoursAgo * HOUR_MS),
          updatedAt: new Date(now - t.updatedHoursAgo * HOUR_MS),
        }))
        await tx.insert(tickets).values(rows)
        ticketCount += rows.length
      }
      return { skipped: false as const, projects: seedProjects.length, tickets: ticketCount }
    })

    if (result.skipped) {
      console.log(`Seed skipped: database already has ${result.existing} project(s).`)
    } else {
      console.log(`Seeded ${result.projects} projects and ${result.tickets} tickets.`)
    }
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
