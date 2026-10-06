'use client'

import { useSyncExternalStore } from 'react'

const TICK_MS = 60_000

/**
 * One shared clock for every relative timestamp: a single interval, running only while at least
 * one subscriber is mounted, so "just now" becomes "1 minute ago" in a tab left open.
 */
export function createNowStore(tickMs = TICK_MS) {
  let now = Date.now()
  let timer: ReturnType<typeof setInterval> | undefined
  const listeners = new Set<() => void>()

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      if (!timer) {
        now = Date.now()
        timer = setInterval(() => {
          now = Date.now()
          listeners.forEach((l) => l())
        }, tickMs)
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer) {
          clearInterval(timer)
          timer = undefined
        }
      }
    },
    getSnapshot: () => now,
    get running() {
      return timer !== undefined
    },
  }
}

const store = createNowStore()

export function useNow(): number {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
