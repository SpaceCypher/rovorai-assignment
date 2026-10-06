import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from './api-client'
import { errorMessage } from './error-message'

/**
 * Puts server field errors (e.g. "name already exists", "repo not found") on the matching
 * inputs. Returns a message for anything that isn't field-specific, for a toast.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | undefined {
  if (error instanceof ApiError) {
    let applied = false
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if ((fields as readonly string[]).includes(field) && messages[0]) {
        setError(
          field as Path<T>,
          { type: 'server', message: messages[0] },
          { shouldFocus: !applied },
        )
        applied = true
      }
    }
    if (applied) return undefined
  }
  return errorMessage(error)
}
