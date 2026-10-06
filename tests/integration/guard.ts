/** Integration tests truncate tables: refuse to run against anything but a *_test database. */
export function assertTestDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is not set for integration tests')
  const name = new URL(url).pathname.replace(/^\//, '')
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests against "${name}": name must end in _test`)
  }
  return url
}
