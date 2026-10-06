import { expect, test, type Page } from '@playwright/test'
import { resetDatabase } from './db'

test.beforeEach(async ({ page }) => {
  resetDatabase()
  await page.route('**/api/projects/*/repository', (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: 'REPO_NOT_FOUND', message: 'x', requestId: 'r' } },
    }),
  )
})

/** Presses Tab until the focused element's accessible text matches (keyboard only, no clicks). */
async function tabTo(page: Page, match: RegExp, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return `${el?.getAttribute('aria-label') ?? ''} ${el?.textContent ?? ''}`.trim()
    })
    if (match.test(label)) return
  }
  throw new Error(`Never reached ${match} with Tab`)
}

test('the three core tasks work with the keyboard alone', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('project-card')).toHaveCount(3)

  // 1. Create a ticket from a dashboard card.
  await tabTo(page, /Create ticket in Internal Tools/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog', { name: 'New ticket' })).toBeVisible()
  await expect(page.getByLabel('Title')).toBeFocused() // focus moved into the dialog
  await page.keyboard.type('Keyboard-only ticket')
  await page.keyboard.press('Enter') // submits the form
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Keyboard-only ticket').first()).toBeVisible()

  // 2. Find a ticket with search and change its status.
  await tabTo(page, /Open project Web Platform/)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Web Platform' })).toBeVisible()
  await page.keyboard.press('/')
  await page.keyboard.type('login')
  await expect(page.getByTestId('ticket-list').getByRole('link')).toHaveCount(1)
  await tabTo(page, /Fix login redirect loop/)
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('heading', { level: 1, name: /Fix login redirect loop/ }),
  ).toBeVisible()
  await tabTo(page, /^Todo$/) // the Status select trigger
  await page.keyboard.press('Enter')
  // Radix ignores keys for a frame or two while the listbox positions itself. Like a person,
  // press ArrowDown and watch the highlight rather than counting keypresses blindly.
  const done = page.getByRole('option', { name: 'Done' })
  await expect(async () => {
    await page.keyboard.press('ArrowDown')
    await expect(done).toBeFocused({ timeout: 200 })
  }).toPass({ timeout: 5_000 })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Done')
  await tabTo(page, /Save changes/)
  await page.keyboard.press('Enter')
  await expect(page.getByText('Ticket saved')).toBeVisible()

  // 3. Back to the project via the in-page link: same filtered list, change reflected.
  await tabTo(page, /Web Platform/)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/q=login/)
  await expect(page.getByTestId('ticket-list').getByRole('link').first()).toContainText('Done')
})
