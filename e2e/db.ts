import { execFileSync } from 'node:child_process'
import { E2E_DATABASE_URL } from '../playwright.config'

export function assertE2eDatabase(url: string) {
  const name = new URL(url).pathname.slice(1)
  if (!name.endsWith('_e2e'))
    throw new Error(`Refusing to reset "${name}": e2e database name must end in _e2e`)
}

/** Truncate + reseed (3 projects, 18 tickets) so every test starts from the same data. */
export function resetDatabase() {
  assertE2eDatabase(E2E_DATABASE_URL)
  execFileSync('node_modules/.bin/tsx', ['scripts/seed.ts'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'pipe',
  })
}
