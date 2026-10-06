import { expect, test } from '@playwright/test'
import { resetDatabase } from './db'

test.beforeEach(() => resetDatabase())

test('offline: banner appears and a submit fails fast with a clear message', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('project-card')).toHaveCount(3)
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Offline project')

  await context.setOffline(true)
  await expect(page.getByText('You’re offline')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Can’t reach the server')).toBeVisible()
  // Not stuck in a pending state, and the draft is kept for a retry.
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Create project' }),
  ).toBeEnabled()
  await expect(page.getByRole('dialog').getByLabel('Name')).toHaveValue('Offline project')

  await context.setOffline(false)
  await expect(page.getByText('You’re offline')).toBeHidden()
  await page.getByRole('dialog').getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByTestId('project-card')).toHaveCount(4)
})

test('a server error on save shows a toast and keeps the dialog open', async ({ page }) => {
  await page.goto('/')
  await page.route('**/api/projects', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'DB_UNAVAILABLE',
              message: 'The database is temporarily unavailable. Try again.',
              requestId: 'r',
            },
          },
        })
      : route.fallback(),
  )
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByRole('dialog').getByLabel('Name').fill('Will fail')
  await page.getByRole('dialog').getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Couldn’t create the project')).toBeVisible()
  await expect(page.getByText('The database is temporarily unavailable. Try again.')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
})
