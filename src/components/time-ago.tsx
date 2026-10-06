'use client'

import { formatAbsolute, formatRelative } from '@/lib/format'

/** "2 hours ago", with the exact local timestamp on hover and for assistive tech. */
export function TimeAgo({ iso, prefix }: { iso: string; prefix?: string }) {
  const absolute = formatAbsolute(iso)
  return (
    <time dateTime={iso} title={absolute}>
      {prefix && `${prefix} `}
      {formatRelative(iso)}
    </time>
  )
}
