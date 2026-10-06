import { z } from 'zod'
import { LIMITS } from '../domain'
import { parseGithubRepo } from '../github-ref'
import { optionalText, requiredText, versionSchema } from './common'

/** '' / null → null (no repo); anything else must parse to canonical owner/repo. */
const githubRepoInput = z
  .string()
  .max(LIMITS.githubRepoInput)
  .nullable()
  .transform((value, ctx) => {
    if (value === null || value.trim() === '') return null
    const parsed = parseGithubRepo(value)
    if (!parsed.ok) {
      ctx.addIssue({ code: 'custom', message: parsed.error })
      return z.NEVER
    }
    return parsed.value
  })

export const createProjectSchema = z.strictObject({
  name: requiredText('Name', LIMITS.projectName),
  description: optionalText('Description', LIMITS.projectDescription).default(''),
  githubRepo: githubRepoInput.optional().transform((v) => v ?? null),
})

export const updateProjectSchema = z
  .strictObject({
    version: versionSchema,
    name: requiredText('Name', LIMITS.projectName).optional(),
    description: optionalText('Description', LIMITS.projectDescription).optional(),
    githubRepo: githubRepoInput.optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.description !== undefined || v.githubRepo !== undefined,
    { message: 'Provide at least one field to update' },
  )

export type CreateProjectInput = z.input<typeof createProjectSchema>
export type CreateProject = z.output<typeof createProjectSchema>
export type UpdateProjectInput = z.input<typeof updateProjectSchema>
export type UpdateProject = z.output<typeof updateProjectSchema>
