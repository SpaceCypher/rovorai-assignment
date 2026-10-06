import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNowStore } from '@/lib/now'

afterEach(() => vi.useRealTimers())

describe('createNowStore (shared clock for relative times)', () => {
  it('ticks subscribers every minute with a fresh time', () => {
    vi.useFakeTimers({ now: new Date('2026-10-06T12:00:00Z') })
    const store = createNowStore()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const first = store.getSnapshot()

    vi.advanceTimersByTime(59_999)
    expect(listener).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getSnapshot() - first).toBe(60_000)
    unsubscribe()
  })

  it('runs one timer for many subscribers and stops when the last one leaves', () => {
    vi.useFakeTimers()
    const store = createNowStore()
    const offA = store.subscribe(() => {})
    const offB = store.subscribe(() => {})
    expect(vi.getTimerCount()).toBe(1)
    offA()
    expect(store.running).toBe(true)
    offB()
    expect(store.running).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
})
