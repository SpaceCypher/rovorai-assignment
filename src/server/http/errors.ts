import 'server-only'
import type { ApiErrorBody, ErrorCode } from '@/shared/schemas/api'

type Details = NonNullable<ApiErrorBody['error']['details']>

/** Expected failures. Services throw these; `withApi` turns them into HTTP responses. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Details,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (code: ErrorCode, message: string) => new AppError(404, code, message)

export const projectNotFound = () => notFound('PROJECT_NOT_FOUND', 'Project not found')
export const ticketNotFound = () => notFound('TICKET_NOT_FOUND', 'Ticket not found')

export const validationError = (message: string, details?: Details) =>
  new AppError(400, 'VALIDATION_ERROR', message, details)

export const versionConflict = (current: unknown) =>
  new AppError(
    409,
    'VERSION_CONFLICT',
    'This item was changed by someone else. Reload to see the latest version.',
    { current },
  )

export const projectNameTaken = () =>
  new AppError(409, 'PROJECT_NAME_TAKEN', 'A project with this name already exists', {
    fieldErrors: { name: ['A project with this name already exists'] },
  })

/** Postgres error code, looking through Drizzle's DrizzleQueryError wrapper. */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current === 'object' && 'code' in current && typeof current.code === 'string') {
      return current.code
    }
    current = typeof current === 'object' && 'cause' in current ? current.cause : undefined
  }
  return undefined
}
