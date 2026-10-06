'use client'

import { WifiOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** Detect and say so (skill §4, offline). Queries resume automatically on reconnect. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // server render: assume online
  )
  if (online) return null
  return (
    <div role="status" className="border-b border-warning/40 bg-warning/10">
      <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm sm:px-6">
        <WifiOff className="size-4 shrink-0 text-priority-medium" aria-hidden />
        You’re offline. Changes can’t be saved until you reconnect.
      </p>
    </div>
  )
}
