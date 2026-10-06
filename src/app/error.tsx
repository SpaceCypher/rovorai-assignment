'use client'

import { ErrorState } from '@/components/states'

// Last-resort boundary for render errors. Data errors are handled inline by each view.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState title="This page hit an unexpected error" error={error} onRetry={reset} />
}
