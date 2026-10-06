import 'server-only'
import { DrizzleQueryError } from 'drizzle-orm'
import { getEnv } from './env'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const
type Level = keyof typeof LEVELS

// One JSON object per line: Vercel's log viewer and any log drain can parse it.
function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (LEVELS[level] < LEVELS[getEnv().LOG_LEVEL]) return
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...fields })
  if (level === 'error' || level === 'warn') console.error(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => log('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => log('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => log('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => log('error', msg, fields),
}

/**
 * Error fields safe to log. For wrapped DB errors the message and stack are dropped: Drizzle
 * embeds the query parameters (user-entered text) in both. Uses `instanceof`, not
 * `error.name`, because production bundles minify class names.
 */
export function errorFields(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: String(error) }
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as { code?: unknown; constraint_name?: unknown } | undefined
    return {
      errorName: 'DrizzleQueryError',
      errorMessage: 'database query failed',
      pgCode: cause?.code,
      pgConstraint: cause?.constraint_name,
    }
  }
  return { errorName: error.name, errorMessage: error.message, stack: error.stack }
}
