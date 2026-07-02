import { describe, it, expect, beforeEach } from 'vitest'
import { usePreferencesStore } from '@/stores/preferences.store'
import { updateProfileSchema } from '@/schemas/profile'

describe('preferences store', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      currency: null,
      notifications: { push: false, email: true, reminders: true },
    })
    window.localStorage.clear()
  })

  it('toggles notification preferences independently', () => {
    usePreferencesStore.getState().setNotification('push', true)
    expect(usePreferencesStore.getState().notifications.push).toBe(true)
    expect(usePreferencesStore.getState().notifications.email).toBe(true)
    usePreferencesStore.getState().setNotification('email', false)
    expect(usePreferencesStore.getState().notifications.email).toBe(false)
  })

  it('sets and clears currency', () => {
    usePreferencesStore.getState().setCurrency('KHR')
    expect(usePreferencesStore.getState().currency).toBe('KHR')
    usePreferencesStore.getState().setCurrency(null)
    expect(usePreferencesStore.getState().currency).toBeNull()
  })
})

describe('updateProfileSchema', () => {
  it('accepts empty optional fields', () => {
    expect(updateProfileSchema.safeParse({ name: '', phone: '', avatarUrl: '' }).success).toBe(true)
  })
  it('rejects an invalid phone and avatar URL', () => {
    expect(
      updateProfileSchema.safeParse({ name: 'Alice', phone: 'abc', avatarUrl: '' }).success,
    ).toBe(false)
    expect(
      updateProfileSchema.safeParse({ name: 'Alice', phone: '', avatarUrl: 'not-a-url' }).success,
    ).toBe(false)
  })
  it('rejects a name shorter than 2 characters', () => {
    expect(updateProfileSchema.safeParse({ name: 'A', phone: '', avatarUrl: '' }).success).toBe(
      false,
    )
  })
  it('rejects a name longer than 255 characters', () => {
    const long = 'a'.repeat(256)
    expect(updateProfileSchema.safeParse({ name: long, phone: '', avatarUrl: '' }).success).toBe(
      false,
    )
  })
  it('accepts a valid name, phone, and avatar URL', () => {
    expect(
      updateProfileSchema.safeParse({
        name: 'Alice Tan',
        phone: '+855 12 345 678',
        avatarUrl: 'https://example.com/a.png',
      }).success,
    ).toBe(true)
  })
})
