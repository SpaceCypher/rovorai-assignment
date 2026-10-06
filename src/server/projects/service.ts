import 'server-only'
import { and, desc, eq, getTableColumns, lte, sql } from 'drizzle-orm'
import { LIMITS } from '@/shared/domain'
import type { Project, ProjectDetail, ProjectSummary, TicketCounts } from '@/shared/schemas/api'
import type { CreateProject, UpdateProject } from '@/shared/schemas/project'
import { db } from '../db/client'
import { toProject, toTicket } from '../db/mappers'
import { projects, tickets } from '../db/schema'
import { githubRepoKey } from '@/shared/github-ref'
import { insightsService } from '../github/insights-service'
import {
  AppError,
  pgErrorCode,
  projectNameTaken,
  projectNotFound,
  versionConflict,
} from '../http/errors'

const UNIQUE_VIOLATION = '23505'

// Aggregates over a LEFT JOIN: a project with no tickets gets zeros, not a missing row.
const countColumns = {
  todo: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} = 'todo'))::int`,
  in_progress: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} = 'in_progress'))::int`,
  done: sql<number>`(count(${tickets.id}) filter (where ${tickets.status} = 'done'))::int`,
  total: sql<number>`count(${tickets.id})::int`,
}

const toCounts = (row: TicketCounts): TicketCounts => ({
  todo: row.todo,
  in_progress: row.in_progress,
  done: row.done,
  total: row.total,
})

/** Dashboard data in two queries regardless of project count: counts, then recent tickets. */
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const ranked = db.$with('ranked').as(
    db
      .select({
        ...getTableColumns(tickets),
        rank: sql<number>`row_number() over (partition by ${tickets.projectId} order by ${tickets.updatedAt} desc, ${tickets.id} desc)`.as(
          'rank',
        ),
      })
      .from(tickets),
  )

  const [projectRows, recentRows] = await Promise.all([
    db
      .select({ project: projects, ...countColumns })
      .from(projects)
      .leftJoin(tickets, eq(tickets.projectId, projects.id))
      .groupBy(projects.id)
      .orderBy(desc(projects.createdAt), desc(projects.id)),
    db
      .with(ranked)
      .select()
      .from(ranked)
      .where(lte(ranked.rank, LIMITS.recentTicketsPerProject))
      .orderBy(ranked.rank),
  ])

  const recentByProject = new Map<string, ProjectSummary['recentTickets']>()
  for (const { rank: _rank, ...ticket } of recentRows) {
    const list = recentByProject.get(ticket.projectId) ?? []
    list.push(toTicket(ticket))
    recentByProject.set(ticket.projectId, list)
  }

  return projectRows.map((row) => ({
    ...toProject(row.project),
    ticketCounts: toCounts(row),
    recentTickets: recentByProject.get(row.project.id) ?? [],
  }))
}

export async function getProjectDetail(id: string): Promise<ProjectDetail> {
  const [row] = await db
    .select({ project: projects, ...countColumns })
    .from(projects)
    .leftJoin(tickets, eq(tickets.projectId, projects.id))
    .where(eq(projects.id, id))
    .groupBy(projects.id)
  if (!row) throw projectNotFound()
  return { ...toProject(row.project), ticketCounts: toCounts(row) }
}

export async function projectExists(id: string): Promise<boolean> {
  const [row] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id))
  return row !== undefined
}

/**
 * Best-effort repo check for writes (decisions L2/L9): a repo GitHub confirms is missing is
 * rejected; if GitHub can't be reached the write goes ahead, so GitHub never blocks our core
 * write path. A successful check also warms the insights cache.
 */
async function assertRepoNotMissing(githubRepo: string) {
  if ((await insightsService().checkRepoExists(githubRepo)) === 'not_found') {
    throw new AppError(422, 'REPO_NOT_FOUND', 'Repository not found on GitHub, or it is private', {
      fieldErrors: { githubRepo: ['Repository not found on GitHub, or it is private'] },
    })
  }
}

export async function createProject(input: CreateProject): Promise<Project> {
  if (input.githubRepo) await assertRepoNotMissing(input.githubRepo)
  try {
    const [row] = await db.insert(projects).values(input).returning()
    return toProject(row!)
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) throw projectNameTaken()
    throw error
  }
}

/** Optimistic locking: the update only applies if the caller saw the latest version. */
export async function updateProject(id: string, input: UpdateProject): Promise<Project> {
  const { version, ...changes } = input
  if (changes.githubRepo) {
    const [current] = await db
      .select({ githubRepo: projects.githubRepo })
      .from(projects)
      .where(eq(projects.id, id))
    if (!current) throw projectNotFound()
    const changed =
      current.githubRepo === null ||
      githubRepoKey(current.githubRepo) !== githubRepoKey(changes.githubRepo)
    if (changed) await assertRepoNotMissing(changes.githubRepo)
  }
  let row
  try {
    ;[row] = await db
      .update(projects)
      .set({ ...changes, version: sql`${projects.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(projects.id, id), eq(projects.version, version)))
      .returning()
  } catch (error) {
    if (pgErrorCode(error) === UNIQUE_VIOLATION) throw projectNameTaken()
    throw error
  }
  if (row) return toProject(row)

  // Nothing updated: either the project is gone or the version is stale.
  const [current] = await db.select().from(projects).where(eq(projects.id, id))
  if (!current) throw projectNotFound()
  throw versionConflict(toProject(current))
}

/** Tickets are removed by the FK's ON DELETE CASCADE in the same statement. */
export async function deleteProject(id: string): Promise<void> {
  const deleted = await db
    .delete(projects)
    .where(eq(projects.id, id))
    .returning({ id: projects.id })
  if (deleted.length === 0) throw projectNotFound()
}
