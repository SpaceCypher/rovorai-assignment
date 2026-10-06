import { describe, expect, it } from 'vitest'
import {
  filtersFromSearchParams,
  filtersToSearchParams,
  ticketFiltersSchema,
} from '@/shared/schemas/filters'
import { createProjectSchema, updateProjectSchema } from '@/shared/schemas/project'
import { createTicketSchema, updateTicketSchema } from '@/shared/schemas/ticket'

const parseFilters = (qs: string) =>
  ticketFiltersSchema.safeParse(filtersFromSearchParams(new URLSearchParams(qs)))

describe('createProjectSchema', () => {
  it('trims, defaults description and normalizes the repo', () => {
    expect(
      createProjectSchema.parse({ name: '  Web  ', githubRepo: 'https://github.com/a/b.git' }),
    ).toEqual({ name: 'Web', description: '', githubRepo: 'a/b' })
  })

  it.each([[undefined], [null], ['']])('treats repo %j as not connected', (githubRepo) => {
    expect(createProjectSchema.parse({ name: 'x', githubRepo }).githubRepo).toBeNull()
  })

  it('rejects blank name, long fields, bad repo and unknown keys', () => {
    const result = createProjectSchema.safeParse({
      name: '   ',
      description: 'd'.repeat(1001),
      githubRepo: 'gitlab.com/a/b',
      extra: true,
    })
    expect(result.success).toBe(false)
    const paths = result.error!.issues.map((i) => i.path.join('.') || '(root)')
    expect(paths).toEqual(expect.arrayContaining(['name', 'description', 'githubRepo']))
    expect(result.error!.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true)
  })
})

describe('updateProjectSchema', () => {
  it('requires version and at least one field', () => {
    expect(updateProjectSchema.safeParse({ name: 'x' }).success).toBe(false)
    expect(updateProjectSchema.safeParse({ version: 1 }).success).toBe(false)
  })

  it('allows disconnecting the repo with null', () => {
    expect(updateProjectSchema.parse({ version: 2, githubRepo: null })).toEqual({
      version: 2,
      githubRepo: null,
    })
  })
})

describe('ticket schemas', () => {
  it('applies defaults on create', () => {
    expect(createTicketSchema.parse({ title: ' Fix it ' })).toEqual({
      title: 'Fix it',
      description: '',
      status: 'todo',
      priority: 'medium',
    })
  })

  it('rejects invalid enum values and fractional versions', () => {
    expect(createTicketSchema.safeParse({ title: 'x', status: 'blocked' }).success).toBe(false)
    expect(updateTicketSchema.safeParse({ version: 1.5, title: 'x' }).success).toBe(false)
  })

  it('rejects an update with nothing to change', () => {
    const result = updateTicketSchema.safeParse({ version: 1 })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('Provide at least one field to update')
  })
})

describe('ticketFiltersSchema', () => {
  it('parses comma lists and repeated params, de-duplicated', () => {
    const result = parseFilters('status=todo,done&status=todo&priority=high')
    expect(result.data).toEqual({ q: undefined, status: ['todo', 'done'], priority: ['high'] })
  })

  it('treats empty values as no filter', () => {
    expect(parseFilters('q=%20%20&status=').data).toEqual({
      q: undefined,
      status: [],
      priority: [],
    })
  })

  it('rejects unknown enum values and over-long queries', () => {
    expect(parseFilters('status=blocked').success).toBe(false)
    expect(parseFilters(`q=${'a'.repeat(101)}`).success).toBe(false)
  })

  it('round-trips through URLSearchParams', () => {
    const filters = { q: 'login', status: ['todo', 'in_progress'] as const, priority: [] }
    const qs = filtersToSearchParams({ ...filters, status: [...filters.status] }).toString()
    expect(qs).toBe('q=login&status=todo%2Cin_progress')
    expect(parseFilters(qs).data).toEqual({
      q: 'login',
      status: ['todo', 'in_progress'],
      priority: [],
    })
  })
})
