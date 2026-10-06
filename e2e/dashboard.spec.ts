import { expect, test, type Page } from '@playwright/test'
import { resetDatabase } from './db'

test.beforeEach(() => resetDatabase())

const card = (page: Page, name: string) =>
  page.getByTestId('project-card').filter({ has: page.getByRole('heading', { name, exact: true }) })

const count = (page: Page, project: string, status: 'Todo' | 'In Progress' | 'Done') =>
  card(page, project).locator('dl > div', { hasText: status }).locator('dd')

/** Fails the test if the page did a full reload (requirement: no manual refresh needed). */
async function markNoReload(page: Page) {
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true))
  return async () =>
    expect(
      await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload),
    ).toBe(true)
}

test('dashboard shows every project with counts, recent tickets and links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('project-card')).toHaveCount(3)
  await expect(count(page, 'Web Platform', 'Todo')).toHaveText('3')
  await expect(count(page, 'Web Platform', 'In Progress')).toHaveText('2')
  await expect(count(page, 'Web Platform', 'Done')).toHaveText('2')
  await expect(
    card(page, 'Web Platform')
      .getByRole('region', { name: 'Recently updated tickets' })
      .getByRole('link'),
  ).toHaveCount(3)
  await expect(
    card(page, 'Web Platform').getByRole('link', { name: 'Open project Web Platform' }),
  ).toHaveAttribute('href', /\/projects\/[0-9a-f-]{36}$/)
})

test('create a project: inline validation, server errors on the field, card appears', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('project-card')).toHaveCount(3)
  const assertNoReload = await markNoReload(page)

  await page.getByRole('button', { name: 'New project' }).click()
  const dialog = page.getByRole('dialog', { name: 'New project' })
  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expect(dialog.getByText('Name is required')).toBeVisible()

  // Server-side rule (case-insensitive unique name) lands on the name field.
  await dialog.getByLabel('Name').fill('web platform')
  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expect(dialog.getByText('A project with this name already exists')).toBeVisible()

  await dialog.getByLabel('Name').fill('Mobile App')
  await dialog.getByLabel('Description').fill('iOS and Android clients')
  await dialog.getByRole('button', { name: 'Create project' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('project-card')).toHaveCount(4)
  await expect(count(page, 'Mobile App', 'Todo')).toHaveText('0')
  await expect(card(page, 'Mobile App').getByText('No tickets yet.')).toBeVisible()
  // The empty card offers the next step, which opens the ticket dialog for that project.
  await card(page, 'Mobile App').getByRole('button', { name: 'Create the first ticket' }).click()
  await expect(page.getByRole('dialog', { name: 'New ticket' })).toContainText('in Mobile App')
  await page.keyboard.press('Escape')
  await assertNoReload()
})

test('the + on a card creates a ticket and the card updates without a reload', async ({ page }) => {
  await page.goto('/')
  await expect(count(page, 'Internal Tools', 'Todo')).toHaveText('1')
  const assertNoReload = await markNoReload(page)

  await page.getByRole('button', { name: 'Create ticket in Internal Tools' }).click()
  const dialog = page.getByRole('dialog', { name: 'New ticket' })
  await expect(dialog.getByText('in Internal Tools')).toBeVisible()
  await dialog.getByLabel('Title').fill('Audit admin permissions')
  await dialog.getByRole('combobox', { name: 'Priority' }).click()
  await page.getByRole('option', { name: 'High' }).click()
  await dialog.getByRole('button', { name: 'Create ticket' }).click()

  await expect(dialog).toBeHidden()
  await expect(count(page, 'Internal Tools', 'Todo')).toHaveText('2')
  const recent = card(page, 'Internal Tools')
    .getByRole('region', { name: 'Recently updated tickets' })
    .getByRole('link')
  await expect(recent.first()).toContainText('Audit admin permissions')
  await expect(recent.first()).toContainText('High')
  await assertNoReload()
})

test('a ticket draft survives closing the dialog by accident', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create ticket in Data Layer' }).click()
  await page.getByRole('dialog').getByLabel('Title').fill('Half-written idea')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.getByRole('button', { name: 'Create ticket in Data Layer' }).click()
  await expect(page.getByRole('dialog').getByLabel('Title')).toHaveValue('Half-written idea')
})

test('footer links to the source and the 2-minute guide in a new tab', async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('contentinfo').getByRole('link', { name: /Source & how to try it/ })
  await expect(link).toHaveAttribute(
    'href',
    /github\.com\/SpaceCypher\/rovorai-assignment#try-it-in-2-minutes$/,
  )
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
})

test('cards show done/total progress', async ({ page }) => {
  await page.goto('/')
  const bar = card(page, 'Internal Tools').getByRole('progressbar')
  await expect(bar).toHaveAttribute('aria-valuenow', '2')
  await expect(bar).toHaveAttribute('aria-valuemax', '5')
  await expect(card(page, 'Internal Tools').getByText('2 of 5 done')).toBeVisible()
})

test('Ctrl/Cmd+Enter creates a ticket from the description field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create ticket in Data Layer' }).click()
  const dialog = page.getByRole('dialog', { name: 'New ticket' })
  await dialog.getByLabel('Title').fill('Shortcut-created ticket')
  await dialog.getByLabel('Description').fill('Line one')
  await dialog.getByLabel('Description').press('ControlOrMeta+Enter')
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Shortcut-created ticket').first()).toBeVisible()
})

test('the tab icon is the app mark, not the framework default', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="icon"]').first().getAttribute('href')
  expect(href).toMatch(/icon\.svg/)
  const res = await request.get(href!)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/svg+xml')
  expect((await request.get('/favicon.ico')).status()).toBe(404)
})
