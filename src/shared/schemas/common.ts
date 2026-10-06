import { z } from 'zod'

/** Trimmed, non-empty string with a max length. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

/** Trimmed optional text; missing becomes ''. */
export const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

/** Lenient UUID shape (what Postgres accepts), used for path params. */
export const idSchema = z.guid()

export const versionSchema = z
  .number({ error: 'version is required' })
  .int()
  .positive('version must be a positive integer')
