'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import {
  LIMITS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@/shared/domain'
import { filtersToSearchParams, type TicketFilters } from '@/shared/schemas/filters'

const pick = <T extends string>(allowed: readonly T[], raw: string[]): T[] => {
  const values = raw.flatMap((v) => v.split(',')).map((v) => v.trim())
  return [...new Set(values.filter((v): v is T => (allowed as readonly string[]).includes(v)))]
}

/**
 * Reads filters from the URL leniently: a hand-edited or stale URL (`?status=foo`) drops the
 * bad values instead of erroring. The API stays strict.
 */
export function readFilters(params: URLSearchParams): TicketFilters {
  const q = params.get('q')?.trim().slice(0, LIMITS.searchQuery)
  return {
    q: q || undefined,
    status: pick<TicketStatus>(TICKET_STATUSES, params.getAll('status')),
    priority: pick<TicketPriority>(TICKET_PRIORITIES, params.getAll('priority')),
  }
}

/**
 * Native history API, not router.replace: Next 16 syncs it into useSearchParams without a server
 * round trip (router.replace re-fetched the page payload: ~200 ms per chip click on slow 4G,
 * measured in the Phase 8 speed pass). Replace, not push: no history entry per keystroke.
 */
function replaceUrl(url: string) {
  window.history.replaceState(null, '', url)
}

/** URL is the source of truth for filters: shareable, survives reload and back/forward. */
export function useUrlFilters() {
  const params = useSearchParams()
  const pathname = usePathname()
  const filters = useMemo(() => readFilters(new URLSearchParams(params.toString())), [params])

  const setFilters = useCallback(
    (next: Partial<TicketFilters>) => {
      const qs = filtersToSearchParams({ ...filters, ...next }).toString()
      replaceUrl(qs ? `${pathname}?${qs}` : pathname)
    },
    [filters, pathname],
  )

  const clearFilters = useCallback(() => replaceUrl(pathname), [pathname])

  const hasFilters = Boolean(filters.q || filters.status.length || filters.priority.length)
  return { filters, setFilters, clearFilters, hasFilters }
}
