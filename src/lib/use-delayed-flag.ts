'use client'

import { useEffect, useState } from 'react'

/**
 * True only after `active` has stayed true for `delayMs`. Fast loads never flash a skeleton
 * (skill §4: show nothing for the first ~200ms).
 */
export function useDelayedFlag(active: boolean, delayMs = 200): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setShown(true), delayMs)
    return () => {
      clearTimeout(timer)
      setShown(false) // reset when loading stops, so the next load waits again
    }
  }, [active, delayMs])
  return active && shown
}
