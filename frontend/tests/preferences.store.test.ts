import { describe, it, expect, beforeEach } from 'vitest'
import { usePreferencesStore } from '@/stores/preferences.store'

describe('preferences.store', () => {
  beforeEach(() => {
    // Reset to defaults between tests.
    usePreferencesStore.setState({
      currency: null,
      theme: 'system',
      notifications: { push: false, email: true, reminders: true },
    })
  })

  it('defaults to system theme', () => {
    expect(usePreferencesStore.getState().theme).toBe('system')
  })

  it('setTheme updates the theme', () => {
    usePreferencesStore.getState().setTheme('dark')
    expect(usePreferencesStore.getState().theme).toBe('dark')
    usePreferencesStore.getState().setTheme('light')
    expect(usePreferencesStore.getState().theme).toBe('light')
  })

  it('setCurrency sets and clears the display currency', () => {
    usePreferencesStore.getState().setCurrency('KHR')
    expect(usePreferencesStore.getState().currency).toBe('KHR')
    usePreferencesStore.getState().setCurrency(null)
    expect(usePreferencesStore.getState().currency).toBeNull()
  })

  it('setNotification toggles a single key without affecting others', () => {
    usePreferencesStore.getState().setNotification('push', true)
    const { notifications } = usePreferencesStore.getState()
    expect(notifications.push).toBe(true)
    expect(notifications.email).toBe(true)
    expect(notifications.reminders).toBe(true)
  })
})
