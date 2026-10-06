import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { resetDatabase } from './db'

test.beforeEach(() => resetDatabase())

async function expectNoViolations(page: Page) {
  // Scan the settled UI: mid-transition opacity (menus fading out) isn't what users read.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary).toEqual([])
}

test('dashboard has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('project-card')).toHaveCount(3)
  await expectNoViolations(page)
})

test('create-project dialog with errors has no violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Name is required')).toBeVisible()
  await expectNoViolations(page)
})

test('create-ticket dialog has no violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create ticket in Web Platform' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expectNoViolations(page)
})

test('project page (with insights and filters) has no violations', async ({ page }) => {
  await page.route('**/api/projects/*/repository', (route) =>
    route.fulfill({
      json: {
        data: {
          fullName: 'a/b',
          htmlUrl: 'https://github.com/a/b',
          description: null,
          stars: 1,
          forks: 1,
          openIssuesAndPrs: 1,
          watchers: 1,
          language: 'TypeScript',
          license: 'MIT',
          defaultBranch: 'main',
          archived: false,
          pushedAt: null,
          updatedAt: new Date().toISOString(),
        },
        meta: { cached: false, stale: true, fetchedAt: new Date().toISOString() },
      },
    }),
  )
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Web Platform' }).click()
  await page
    .getByRole('group', { name: 'Filter by status' })
    .getByRole('button', { name: 'Todo' })
    .click()
  await expect(page.getByTestId('ticket-list')).toBeVisible()
  await expectNoViolations(page)
})

test('delete-project dialog has no violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Internal Tools' }).click()
  await page.getByRole('button', { name: 'Project actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete project' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.getByRole('menu')).toBeHidden()
  await expectNoViolations(page)
})

test('project actions menu has no violations when open', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Internal Tools' }).click()
  await page.getByRole('button', { name: 'Project actions' }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await expectNoViolations(page)
})

test('ticket page with a conflict banner has no violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Internal Tools' }).click()
  await page.getByTestId('ticket-list').getByRole('link').first().click()
  // Client-side navigation: wait for the ticket URL before reading the id from it.
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/)
  // Let the editor load the current version before "someone else" saves (realistic order;
  // with route loading UI the URL changes before the ticket data arrives).
  await expect(page.getByLabel('Title')).not.toHaveValue('')
  const ticketId = page.url().split('/').pop()!
  await page.request.patch(`/api/tickets/${ticketId}`, { data: { version: 1, priority: 'low' } })
  await page.getByLabel('Title').fill('Edited')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Someone else changed this')).toBeVisible()
  await expectNoViolations(page)
})

test.describe('with the OS in dark mode', () => {
  test.use({ colorScheme: 'dark' })

  // Regression: shadcn's dark: styles leaked in when the OS was dark (gray inputs/buttons).
  test('the light-only UI is unchanged and still passes axe', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'New project' }).click()
    const input = page.getByRole('dialog').getByLabel('Name')
    await expect(input).toBeVisible()
    expect(await input.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    )
    await expectNoViolations(page)
  })
})
