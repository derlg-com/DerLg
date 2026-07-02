import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCountdown } from '@/hooks/use-countdown'

// Task 15.2 — 5-second cancellable countdown before the alert is sent
// (Requirements 10.7, 10.8). Uses fake timers to assert both branches:
// completion fires onComplete; cancellation (active=false) never does.

afterEach(() => {
  vi.useRealTimers()
})

describe('useCountdown (Task 15.2)', () => {
  it('counts down and fires onComplete once when it reaches zero (send on completion)', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const { result } = renderHook(() => useCountdown({ seconds: 5, active: true, onComplete }))

    expect(result.current.remaining).toBe(5)

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.remaining).toBe(0)
    expect(onComplete).toHaveBeenCalledTimes(1)

    // No further fires after reaching zero.
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onComplete when cancelled before completion (cancel before send)', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const { rerender, result } = renderHook(
      ({ active }: { active: boolean }) => useCountdown({ seconds: 5, active, onComplete }),
      { initialProps: { active: true } },
    )

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.remaining).toBe(2)

    // User cancels: deactivate the countdown.
    rerender({ active: false })

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(onComplete).not.toHaveBeenCalled()
    // Resets back to the initial value when inactive.
    expect(result.current.remaining).toBe(5)
  })

  it('does not run while inactive', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    renderHook(() => useCountdown({ seconds: 5, active: false, onComplete }))
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(onComplete).not.toHaveBeenCalled()
  })
})
