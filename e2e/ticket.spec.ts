import { expect, test, type Page } from '@playwright/test'
import { resetDatabase } from './db'

test.beforeEach(async ({ page }) => {
  resetDatabase()
  // Insights aren't under test here; keep GitHub out of the picture.
  await page.route('**/api/projects/*/repository', (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: 'REPO_NOT_FOUND', message: 'x', requestId: 'r' } },
    }),
  )
})

const rows = (page: Page) => page.getByTestId('ticket-list').getByRole('link')
const projectCount = (page: Page, status: string) =>
  page
    .getByRole('region', { name: 'Ticket counts for the whole project' })
    .locator('dl > div', { hasText: status })
    .locator('dd')
const cardCount = (page: Page, project: string, status: string) =>
  page
    .getByTestId('project-card')
    .filter({ has: page.getByRole('heading', { name: project, exact: true }) })
    .locator('dl > div', { hasText: status })
    .locator('dd')

async function markNoReload(page: Page) {
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true))
  return async () =>
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true)
}

test('TKT-5: edit, go back, and project + dashboard show the saved state without a refresh', async ({
  page,
}) => {
  await page.goto('/')
  const assertNoReload = await markNoReload(page)
  await page.getByRole('link', { name: 'Open project Web Platform' }).click()
  await page
    .getByRole('group', { name: 'Filter by status' })
    .getByRole('button', { name: 'Todo' })
    .click()
  await expect(rows(page)).toHaveCount(3)
  await expect(projectCount(page, 'Todo')).toHaveText('3')

  await rows(page).filter({ hasText: 'Fix login redirect loop' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Fix login redirect loop after session expiry' }),
  ).toBeVisible()
  const save = page.getByRole('button', { name: 'Save changes' })
  await expect(save).toBeDisabled() // nothing changed yet

  await page.getByLabel('Title').fill('Fix login redirect loop (session expiry)')
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'Done' }).click()
  await expect(page.getByText('Unsaved changes')).toBeVisible()
  await save.click()
  await expect(page.getByText('Ticket saved')).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Fix login redirect loop (session expiry)' }),
  ).toBeVisible()
  await expect(save).toBeDisabled() // form is clean again at the new version

  await page.goBack()
  await expect(page).toHaveURL(/status=todo/) // filters survive the round trip
  await expect(rows(page)).toHaveCount(2) // the ticket is Done now, so it left the Todo list
  await expect(projectCount(page, 'Todo')).toHaveText('2')
  await expect(projectCount(page, 'Done')).toHaveText('3')

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(cardCount(page, 'Web Platform', 'Todo')).toHaveText('2')
  await expect(cardCount(page, 'Web Platform', 'Done')).toHaveText('3')
  const recent = page
    .getByTestId('project-card')
    .filter({ has: page.getByRole('heading', { name: 'Web Platform', exact: true }) })
    .getByRole('region', { name: 'Recently updated tickets' })
    .getByRole('link')
  await expect(recent.first()).toContainText('Fix login redirect loop (session expiry)')
  await assertNoReload()
})

test('validation errors show inline and nothing is saved', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Data Layer' }).click()
  await rows(page).first().click()
  await page.getByLabel('Title').fill('   ')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Title is required')).toBeVisible()
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByText('Title is required')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('a concurrent edit shows the conflict banner; both choices work', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Internal Tools' }).click()
  await rows(page).filter({ hasText: 'Rotate expired API keys' }).click()
  // Client-side navigation: wait for the ticket URL before reading the id from it.
  await page.waitForURL(/\/tickets\/[0-9a-f-]{36}$/)
  // Let the editor load the current version before "someone else" saves (realistic order;
  // with route loading UI the URL changes before the ticket data arrives).
  await expect(page.getByLabel('Title')).not.toHaveValue('')
  const ticketId = page.url().split('/').pop()!

  // Someone else saves first.
  const other = await page.request.patch(`/api/tickets/${ticketId}`, {
    data: { version: 1, priority: 'low' },
  })
  expect(other.status()).toBe(200)

  await page.getByLabel('Title').fill('Rotate expired partner API keys')
  await page.getByRole('button', { name: 'Save changes' }).click()
  const banner = page.getByRole('alert').filter({ hasText: 'Someone else changed this' })
  await expect(banner).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveValue('Rotate expired partner API keys') // work is kept

  await banner.getByRole('button', { name: 'Load latest' }).click()
  await expect(banner).toBeHidden()
  await expect(page.getByLabel('Title')).toHaveValue('Rotate expired API keys')
  await expect(page.getByRole('combobox', { name: 'Priority' })).toContainText('Low')

  // Second round: conflict again, this time keep mine.
  await page.request.patch(`/api/tickets/${ticketId}`, { data: { version: 2, status: 'done' } })
  await page.getByLabel('Title').fill('Mine wins')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page
    .getByRole('alert')
    .filter({ hasText: 'Someone else changed this' })
    .getByRole('button', { name: 'Overwrite with mine' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mine wins' })).toBeVisible()
})

test('delete a ticket: back on the project page, list and counts updated', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Open project Data Layer' }).click()
  await expect(rows(page)).toHaveCount(6)
  await rows(page).filter({ hasText: 'Upgrade Postgres to version 16' }).click()
  await page.getByRole('button', { name: 'Ticket actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete ticket' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete ticket' }).click()

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/)
  await expect(rows(page)).toHaveCount(5)
  await expect(projectCount(page, 'Done')).toHaveText('1')
  await expect(page.getByText('Ticket not found')).toHaveCount(0)
})

test('unknown ticket shows a not-found state', async ({ page }) => {
  await page.goto('/tickets/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('Ticket not found')).toBeVisible()
})
