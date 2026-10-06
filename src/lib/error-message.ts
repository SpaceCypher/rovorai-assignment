import { ApiError } from './api-client'

/** Human, specific, no blame (skill §12). Server messages are already written for users. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Try again.'
}
