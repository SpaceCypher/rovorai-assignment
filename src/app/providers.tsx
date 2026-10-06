'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/lib/api-client'

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Mutations invalidate exactly what they change, so data can be considered fresh briefly.
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Retry once for network/5xx; never for 4xx (a 404 won't fix itself).
        retry: (failureCount, error) =>
          failureCount < 1 && (!(error instanceof ApiError) || error.retryable),
      },
      // Fail fast offline instead of pausing: a paused mutation leaves the submit button spinning
      // forever. Queries keep the default ('online'): they pause and resume on reconnect.
      mutations: { retry: false, networkMode: 'always' },
    },
  })
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; useState keeps it stable across re-renders.
  const [queryClient] = useState(makeQueryClient)
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}
