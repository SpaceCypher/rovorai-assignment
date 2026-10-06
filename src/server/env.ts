import 'server-only'
import { z } from 'zod'

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: postgresUrl,
  DATABASE_URL_UNPOOLED: postgresUrl.optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Env = z.infer<typeof envSchema>

export class EnvError extends Error {
  override name = 'EnvError'
}

/**
 * Validates configuration. Empty strings are treated as unset so `.env` lines like
 * `GITHUB_TOKEN=` behave as "not provided". Error messages name the variable but never its value.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  )
  const result = envSchema.safeParse(cleaned)
  if (!result.success) {
    throw new EnvError(`Invalid environment configuration:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}

let cached: Env | undefined

export function getEnv(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
