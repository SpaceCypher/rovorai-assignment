import { expect, test, type Page } from '@playwright/test'
import { resetDatabase } from './db'

test.beforeEach(() => resetDatabase())

const INSIGHTS = {
  data: {
    fullName: 'vercel/next.js',
    htmlUrl: 'https://github.com/vercel/next.js',
    description: 'The React Framework',
    stars: 143216,
    forks: 34014,
    openIssuesAndPrs: 3542,
    watchers: 1630,
    language: 'JavaScript',
    license: 'MIT',
    defaultBranch: 'canary',
    archived: false,
    pushedAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  meta: { cached: true, stale: false, fetchedAt: new Date().toISOString() },
}

/** Insights come from our API; mock that call so tests never depend on GitHub. */
async function mockInsights(page: Page, body: unknown = INSIGHTS, status = 200) {
  await page.route('**/api/projects/*/repository', (route) => route.fulfill({ status, json: body }))
}

async function openProject(page: Page, name: string) {
  await page.goto('/')
  await page.getByRole('link', { name: `Open project ${name}` }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

const rows = (page: Page) => page.getByTestId('ticket-list').getByRole('link')
const count = (page: Page, status: string) =>
  page
    .getByRole('region', { name: 'Ticket counts for the whole project' })
    .locator('dl > div', { hasText: status })
    .locator('dd')

test('project page shows summary, all tickets and repository insights', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => !r.url().startsWith('http://localhost') && external.push(r.url()))
  await mockInsights(page)
  await openProject(page, 'Web Platform')
  await expect(count(page, 'Todo')).toHaveText('3')
  await expect(rows(page)).toHaveCount(7)
  const insights = page.getByRole('region', { name: 'Repository insights' })
  await expect(insights.getByText('143.2K')).toBeVisible()
  await expect(insights.getByText('Open issues & PRs')).toBeVisible()
  await expect(insights.getByRole('link', { name: /vercel\/next\.js/ })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  )
  // GH-2: the browser only talks to our API; GitHub is reached server-side.
  expect(external).toEqual([])
})

test('search and filters run on the server, combine, live in the URL and survive reload', async ({
  page,
}) => {
  await mockInsights(page)
  await openProject(page, 'Web Platform')

  const ticketRequests: string[] = []
  page.on(
    'request',
    (r) => r.url().includes('/tickets') && ticketRequests.push(new URL(r.url()).search),
  )

  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('login')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toContainText('Fix login redirect loop')
  await expect(page).toHaveURL(/q=login/)
  expect(ticketRequests.some((s) => s.includes('q=login'))).toBe(true) // backend search, not client-side

  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('')
  await page
    .getByRole('group', { name: 'Filter by status' })
    .getByRole('button', { name: 'Todo' })
    .click()
  await page
    .getByRole('group', { name: 'Filter by priority' })
    .getByRole('button', { name: 'High' })
    .click()
  await expect(rows(page)).toHaveCount(1)
  await expect(page).toHaveURL(/status=todo/)
  await expect(page).toHaveURL(/priority=high/)

  await page.reload()
  await expect(
    page.getByRole('group', { name: 'Filter by status' }).getByRole('button', { name: 'Todo' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(rows(page)).toHaveCount(1)

  await page.getByRole('searchbox', { name: 'Search tickets' }).fill('zzz-nothing')
  await expect(page.getByText('No tickets match these filters')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).first().click()
  await expect(rows(page)).toHaveCount(7)
  await expect(page.getByRole('searchbox', { name: 'Search tickets' })).toHaveValue('')
})

test('"/" focuses search', async ({ page }) => {
  await mockInsights(page)
  await openProject(page, 'Data Layer')
  await page.keyboard.press('/')
  await expect(page.getByRole('searchbox', { name: 'Search tickets' })).toBeFocused()
})

test('new ticket from the project page updates the list and counts in place', async ({ page }) => {
  await mockInsights(page)
  await openProject(page, 'Data Layer')
  await expect(count(page, 'Todo')).toHaveText('2')
  await page.getByRole('button', { name: 'New ticket' }).click()
  const dialog = page.getByRole('dialog', { name: 'New ticket' })
  await dialog.getByLabel('Title').fill('Partition the events table')
  await dialog.getByRole('button', { name: 'Create ticket' }).click()
  await expect(dialog).toBeHidden()
  await expect(count(page, 'Todo')).toHaveText('3')
  await expect(rows(page).first()).toContainText('Partition the events table')
})

test('repository errors stay inside the insights panel', async ({ page }) => {
  await mockInsights(
    page,
    {
      error: {
        code: 'REPO_NOT_FOUND',
        message: 'Repository not found on GitHub, or it is private',
        requestId: 'r',
      },
    },
    404,
  )
  await openProject(page, 'Web Platform')
  await expect(
    page.getByRole('region', { name: 'Repository insights' }).getByText('Repository not found'),
  ).toBeVisible()
  await expect(rows(page)).toHaveCount(7)
})

test('projects without a repository: full-width list, and "Connect" opens the repo field', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await openProject(page, 'Internal Tools')
  await expect(rows(page)).toHaveCount(5)
  await expect(page.getByRole('region', { name: 'Repository insights' })).toHaveCount(0)

  // No reserved sidebar column: the ticket list spans the content width (the header's width).
  const listWidth = await page
    .getByTestId('ticket-list')
    .evaluate((el) => el.getBoundingClientRect().width)
  const headerWidth = await page
    .getByRole('heading', { level: 1 })
    .evaluate((el) => el.closest('main')!.firstElementChild!.getBoundingClientRect().width)
  expect(listWidth).toBeGreaterThan(headerWidth - 4)

  await expect(page.getByText('No repository')).toBeVisible()
  await page.getByRole('button', { name: 'Connect' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit project' })
  await expect(dialog.getByLabel('GitHub repository')).toBeFocused()
})

test('edit project: rename shows in the header and on the dashboard', async ({ page }) => {
  await mockInsights(page)
  await openProject(page, 'Internal Tools')
  await page.getByRole('button', { name: 'Project actions' }).click()
  await page.getByRole('menuitem', { name: 'Edit project' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit project' })
  await expect(dialog.getByLabel('Name')).toHaveValue('Internal Tools')
  await dialog.getByLabel('Name').fill('Ops Tooling')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Ops Tooling' })).toBeVisible()
  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page.getByRole('heading', { name: 'Ops Tooling', exact: true })).toBeVisible()
})

test('delete project requires typing its name, then returns to the dashboard', async ({ page }) => {
  await mockInsights(page)
  await openProject(page, 'Data Layer')
  await page.getByRole('button', { name: 'Project actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('6 tickets')
  const confirm = dialog.getByRole('button', { name: 'Delete project' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/to confirm/).fill('Data Layer')
  await confirm.click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('project-card')).toHaveCount(2)
  await expect(page.getByText('Project not found')).toHaveCount(0)
})

test('unknown project id shows a not-found state', async ({ page }) => {
  await page.goto('/projects/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('Project not found')).toBeVisible()
  await page.goto('/projects/not-a-uuid')
  await expect(page.getByText('Project not found')).toBeVisible()
})
