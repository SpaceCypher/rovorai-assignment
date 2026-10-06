import { loadEnvConfig } from '@next/env'
import { defineConfig } from 'drizzle-kit'

// Same .env file resolution as Next.js; real environment variables always win.
loadEnvConfig(process.cwd())

// DDL goes over a direct connection: PgBouncer's transaction pooling (Neon's pooled URL)
// is not safe for migrations. Locally there's no pooler, so DATABASE_URL is fine.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL (or DATABASE_URL_UNPOOLED) must be set to run drizzle-kit')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
})
