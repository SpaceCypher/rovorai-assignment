import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Integration tests run against a real Postgres. Default: the docker-compose test database.
const testDatabaseUrl =
  process.env.DATABASE_URL_TEST ?? 'postgres://rovor:rovor@localhost:5433/rovor_test'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          // Server modules validate env on first use; unit tests never connect to this URL.
          env: { DATABASE_URL: 'postgres://unit:unit@localhost:1/unit', LOG_LEVEL: 'error' },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/global-setup.ts'],
          setupFiles: ['tests/integration/setup.ts'],
          // One shared database: files must not truncate each other's data mid-test.
          fileParallelism: false,
          env: { DATABASE_URL: testDatabaseUrl, LOG_LEVEL: 'warn' },
        },
      },
    ],
  },
})
