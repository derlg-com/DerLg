import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OFFLINE_QUEUE_KEY,
  OFFLINE_QUEUE_VERSION,
  type QueuedAction,
  clearQueue,
  enqueueAction,
  flushQueue,
  loadQueue,
  queueSize,
  removeAction,
} from '@/lib/offline-queue'

describe('offline action queue (Req 12.9, 48.6)', () => {
  beforeEach(() => {
    window.localStorage.removeItem(OFFLINE_QUEUE_KEY)
  })

  it('enqueues actions with generated id + createdAt and persists them', () => {
    const action = enqueueAction('profile-update', { name: 'Sok' })
    expect(action).not.toBeNull()
    expect(action?.id).toBeTruthy()
    expect(action?.createdAt).toBeTypeOf('number')

    const loaded = loadQueue()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].type).toBe('profile-update')
    expect(loaded[0].payload).toEqual({ name: 'Sok' })
  })

  it('preserves FIFO order across multiple enqueues', () => {
    enqueueAction('profile-update', { n: 1 })
    enqueueAction('booking-cancel', { bookingId: 'b1' })
    enqueueAction('review-submit', { rating: 5 })

    expect(loadQueue().map((a) => a.type)).toEqual([
      'profile-update',
      'booking-cancel',
      'review-submit',
    ])
  })

  it('removeAction deletes only the matching action', () => {
    const a = enqueueAction('profile-update', {})
    const b = enqueueAction('booking-cancel', { bookingId: 'b1' })
    removeAction(a!.id)
    const remaining = loadQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(b!.id)
  })

  it('clearQueue empties the queue', () => {
    enqueueAction('profile-update', {})
    clearQueue()
    expect(queueSize()).toBe(0)
  })

  it('ignores a stored snapshot with a mismatched version', () => {
    window.localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify({ version: OFFLINE_QUEUE_VERSION + 1, actions: [{ id: 'x' }] }),
    )
    expect(loadQueue()).toEqual([])
  })

  it('returns [] for malformed JSON', () => {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, '{not json')
    expect(loadQueue()).toEqual([])
  })

  it('filters out individually invalid entries', () => {
    const good: QueuedAction = {
      id: 'good',
      type: 'profile-update',
      payload: {},
      createdAt: Date.now(),
    }
    window.localStorage.setItem(
      OFFLINE_QUEUE_KEY,
      JSON.stringify({
        version: OFFLINE_QUEUE_VERSION,
        actions: [good, { id: 'bad', type: 'nope' }, null, 42],
      }),
    )
    const loaded = loadQueue()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('good')
  })

  it('flushQueue replays in order and removes synced actions', async () => {
    enqueueAction('profile-update', { n: 1 })
    enqueueAction('booking-cancel', { bookingId: 'b1' })
    const replay = vi.fn().mockResolvedValue(undefined)

    const result = await flushQueue(replay)

    expect(replay).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ synced: 2, remaining: 0 })
    expect(queueSize()).toBe(0)
  })

  it('flushQueue stops on first failure and keeps remaining actions queued', async () => {
    enqueueAction('profile-update', { n: 1 })
    enqueueAction('booking-cancel', { bookingId: 'b1' })
    enqueueAction('review-submit', { rating: 5 })

    // First succeeds, second throws -> stop; third must remain.
    const replay = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network'))

    const result = await flushQueue(replay)

    expect(replay).toHaveBeenCalledTimes(2)
    expect(result.synced).toBe(1)
    expect(result.remaining).toBe(2)
    const remaining = loadQueue().map((a) => a.type)
    expect(remaining).toEqual(['booking-cancel', 'review-submit'])
  })
})
