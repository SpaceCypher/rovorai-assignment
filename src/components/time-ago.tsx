'use client'

import { formatAbsolute, formatRelative } from '@/lib/format'
import { useNow } from '@/lib/now'

/** "2 hours ago", kept current by a shared 1-minute clock; exact local time on hover. */
export function TimeAgo({ iso, prefix }: { iso: string; prefix?: string }) {
  const now = useNow()
  return (
    <time dateTime={iso} title={formatAbsolute(iso)}>
      {prefix && `${prefix} `}
      {formatRelative(iso, new Date(now))}
    </time>
  )
}
