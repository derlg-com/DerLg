import { describe, it, expect } from 'vitest'
import { buildShareLink, getSessionFromUrl } from '@/lib/share'

describe('lib/share', () => {
  it('buildShareLink encodes the session id in a vibe-booking URL', () => {
    const link = buildShareLink('abc-123')
    expect(link).toContain('/vibe-booking?session=abc-123')
  })

  it('getSessionFromUrl reads the ?session= param', () => {
    window.history.pushState({}, '', '/vibe-booking?session=shared-xyz')
    expect(getSessionFromUrl()).toBe('shared-xyz')
  })

  it('getSessionFromUrl returns null when absent', () => {
    window.history.pushState({}, '', '/vibe-booking')
    expect(getSessionFromUrl()).toBeNull()
  })
})
