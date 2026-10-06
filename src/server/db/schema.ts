// Table definitions only. Deliberately has no `server-only` import: drizzle-kit and the seed
// script load this file outside Next.js. It holds no secrets and opens no connections.
import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// Declaration order is the sort order in Postgres (low < medium < high).
export const ticketStatus = pgEnum('ticket_status', ['todo', 'in_progress', 'done'])
export const ticketPriority = pgEnum('ticket_priority', ['low', 'medium', 'high'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull().default(''),
    githubRepo: text('github_repo'),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('projects_name_lower_uq').on(sql`lower(${t.name})`),
    check('projects_name_not_blank', sql`length(btrim(${t.name})) > 0`),
    check('projects_description_len', sql`length(${t.description}) <= 1000`),
    // Canonical "owner/repo": owner can't start with '-', repo can't be '.' or '..'.
    // The app parser enforces the same rules; this guards writes that bypass the API.
    check(
      'projects_github_repo_format',
      sql`${t.githubRepo} ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9._-]{1,100}$' AND ${t.githubRepo} !~ '/[.]{1,2}$'`,
    ),
  ],
)

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull().default(''),
    status: ticketStatus('status').notNull().default('todo'),
    priority: ticketPriority('priority').notNull().default('medium'),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (t) => [
    index('tickets_project_updated_idx').on(t.projectId, t.updatedAt.desc()),
    index('tickets_search_trgm_idx').using(
      'gin',
      sql`(${t.title} || ' ' || ${t.description}) gin_trgm_ops`,
    ),
    check('tickets_title_not_blank', sql`length(btrim(${t.title})) > 0`),
    check('tickets_description_len', sql`length(${t.description}) <= 10000`),
  ],
)

export const githubRepoCache = pgTable(
  'github_repo_cache',
  {
    repoKey: text('repo_key').primaryKey(), // lower('owner/repo')
    status: text('status', { enum: ['ok', 'not_found'] }).notNull(),
    payload: jsonb('payload'),
    etag: text('etag'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  },
  (t) => [check('github_repo_cache_status', sql`${t.status} IN ('ok', 'not_found')`)],
)

export type ProjectRow = typeof projects.$inferSelect
export type TicketRow = typeof tickets.$inferSelect
export type NewTicketRow = typeof tickets.$inferInsert
export type GithubRepoCacheRow = typeof githubRepoCache.$inferSelect
