type Status = 'todo' | 'in_progress' | 'done'
type Priority = 'low' | 'medium' | 'high'

export interface SeedTicket {
  title: string
  description: string
  status: Status
  priority: Priority
  /** How long ago the ticket was created / last updated. Keeps "recent tickets" realistic. */
  createdHoursAgo: number
  updatedHoursAgo: number
}

export interface SeedProject {
  name: string
  description: string
  githubRepo: string | null
  tickets: SeedTicket[]
}

// 3 projects, 18 tickets. Every status × priority combination appears exactly twice.
// Two projects point at real, stable public repos so Repository Insights has data to show.
export const seedProjects: SeedProject[] = [
  {
    name: 'Web Platform',
    description:
      'Customer-facing Next.js application: routing, auth flows and dashboard performance.',
    githubRepo: 'vercel/next.js',
    tickets: [
      {
        title: 'Fix login redirect loop after session expiry',
        description:
          'Users with an expired session bounce between /login and /dashboard. Clear the stale auth cookie before redirecting.',
        status: 'todo',
        priority: 'high',
        createdHoursAgo: 30,
        updatedHoursAgo: 2,
      },
      {
        title: 'Cache GitHub repository insights for 5 minutes',
        description:
          'Repository stats are fetched on every project view. Cache responses server-side and reuse them while fresh.',
        status: 'in_progress',
        priority: 'high',
        createdHoursAgo: 72,
        updatedHoursAgo: 5,
      },
      {
        title: 'Set up CI pipeline',
        description: 'Run lint, typecheck, tests and a production build on every pull request.',
        status: 'done',
        priority: 'medium',
        createdHoursAgo: 240,
        updatedHoursAgo: 120,
      },
      {
        title: 'Add dark mode toggle to settings',
        description: 'Respect the OS preference by default and let users override it.',
        status: 'todo',
        priority: 'low',
        createdHoursAgo: 96,
        updatedHoursAgo: 96,
      },
      {
        title: 'Improve dashboard load time',
        description:
          'Dashboard issues one query per project card. Replace with a single aggregate query for ticket counts.',
        status: 'in_progress',
        priority: 'medium',
        createdHoursAgo: 50,
        updatedHoursAgo: 8,
      },
      {
        title: 'Update favicon and app metadata',
        description: 'Replace the framework default favicon and page titles.',
        status: 'done',
        priority: 'low',
        createdHoursAgo: 300,
        updatedHoursAgo: 280,
      },
      {
        title: 'Add keyboard shortcuts for ticket search',
        description: 'Focus the search box with "/" and clear filters with Escape.',
        status: 'todo',
        priority: 'medium',
        createdHoursAgo: 20,
        updatedHoursAgo: 20,
      },
    ],
  },
  {
    name: 'Data Layer',
    description: 'Database schema, migrations and query performance for the core services.',
    githubRepo: 'drizzle-team/drizzle-orm',
    tickets: [
      {
        title: 'Migrate auth tables to the new schema',
        description:
          'Move sessions and accounts into the consolidated auth schema with a zero-downtime migration.',
        status: 'todo',
        priority: 'high',
        createdHoursAgo: 48,
        updatedHoursAgo: 12,
      },
      {
        title: 'Document migration rollback steps',
        description: 'Every migration needs a tested rollback note in the runbook.',
        status: 'in_progress',
        priority: 'low',
        createdHoursAgo: 150,
        updatedHoursAgo: 26,
      },
      {
        title: 'Add trigram index for ticket search',
        description:
          'Substring search on title and description should not seq-scan large projects.',
        status: 'done',
        priority: 'high',
        createdHoursAgo: 200,
        updatedHoursAgo: 60,
      },
      {
        title: 'Write integration tests for project queries',
        description:
          'Cover ticket counts per status and recent-ticket selection against a real database.',
        status: 'in_progress',
        priority: 'medium',
        createdHoursAgo: 40,
        updatedHoursAgo: 3,
      },
      {
        title: 'Rename legacy priority values',
        description: 'Old rows use "urgent" and "normal"; map them to high and medium.',
        status: 'todo',
        priority: 'low',
        createdHoursAgo: 400,
        updatedHoursAgo: 330,
      },
      {
        title: 'Upgrade Postgres to version 16',
        description:
          'Test the upgrade on a staging branch first, then schedule a maintenance window.',
        status: 'done',
        priority: 'medium',
        createdHoursAgo: 500,
        updatedHoursAgo: 210,
      },
    ],
  },
  {
    name: 'Internal Tools',
    description: 'Admin utilities, data exports and housekeeping for the operations team.',
    githubRepo: null,
    tickets: [
      {
        title: 'Onboarding checklist for new engineers',
        description: 'Local setup, access requests and a first starter ticket.',
        status: 'todo',
        priority: 'medium',
        createdHoursAgo: 60,
        updatedHoursAgo: 44,
      },
      {
        title: 'Rotate expired API keys',
        description:
          'Two partner integrations still use keys issued last year. Rotate and update the vault.',
        status: 'in_progress',
        priority: 'high',
        createdHoursAgo: 28,
        updatedHoursAgo: 1,
      },
      {
        title: 'Fix broken CSV export',
        description: 'Exports with commas in the description column produce misaligned rows.',
        status: 'done',
        priority: 'high',
        createdHoursAgo: 90,
        updatedHoursAgo: 70,
      },
      {
        title: 'Clean up stale feature flags',
        description: 'Remove flags that have been fully rolled out for more than 30 days.',
        status: 'in_progress',
        priority: 'low',
        createdHoursAgo: 180,
        updatedHoursAgo: 36,
      },
      {
        title: 'Archive Q2 planning docs',
        description: 'Move finished planning documents to the archive folder.',
        status: 'done',
        priority: 'low',
        createdHoursAgo: 600,
        updatedHoursAgo: 550,
      },
    ],
  },
]
