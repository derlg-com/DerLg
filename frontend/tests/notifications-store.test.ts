import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationsStore, pushAppNotification } from '@/stores/notifications.store'
import { useFestivalRemindersStore } from '@/stores/festival-reminders.store'

beforeEach(() => {
  useNotificationsStore.setState({ notifications: [] })
  useFestivalRemindersStore.setState({ reminders: {} })
})

describe('notifications store', () => {
  it('pushes unread notifications and tracks unread count', () => {
    const id = pushAppNotification({ title: 'Hello', body: 'World' })
    const s = useNotificationsStore.getState()
    expect(s.notifications).toHaveLength(1)
    expect(s.notifications[0].id).toBe(id)
    expect(s.notifications[0].read).toBe(false)
    expect(s.unreadCount()).toBe(1)
  })

  it('marks a single notification read', () => {
    const id = pushAppNotification({ title: 'A' })
    useNotificationsStore.getState().markRead(id)
    expect(useNotificationsStore.getState().unreadCount()).toBe(0)
  })

  it('marks all read', () => {
    pushAppNotification({ title: 'A' })
    pushAppNotification({ title: 'B' })
    useNotificationsStore.getState().markAllRead()
    expect(useNotificationsStore.getState().unreadCount()).toBe(0)
  })

  it('removes and clears notifications', () => {
    const id = pushAppNotification({ title: 'A' })
    pushAppNotification({ title: 'B' })
    useNotificationsStore.getState().remove(id)
    expect(useNotificationsStore.getState().notifications).toHaveLength(1)
    useNotificationsStore.getState().clear()
    expect(useNotificationsStore.getState().notifications).toHaveLength(0)
  })

  it('caps stored notifications at the max', () => {
    for (let i = 0; i < 60; i++) pushAppNotification({ title: `n${i}` })
    expect(useNotificationsStore.getState().notifications.length).toBeLessThanOrEqual(50)
    // Newest first.
    expect(useNotificationsStore.getState().notifications[0].title).toBe('n59')
  })
})

describe('festival reminders store', () => {
  it('toggles reminder intent on and off', () => {
    const store = useFestivalRemindersStore.getState()
    expect(store.has('f1')).toBe(false)
    const on = store.toggle('f1', '2026-04-13')
    expect(on).toBe(true)
    expect(useFestivalRemindersStore.getState().has('f1')).toBe(true)
    const off = useFestivalRemindersStore.getState().toggle('f1', '2026-04-13')
    expect(off).toBe(false)
    expect(useFestivalRemindersStore.getState().has('f1')).toBe(false)
  })

  it('lists active reminders', () => {
    useFestivalRemindersStore.getState().toggle('f1', '2026-04-13')
    useFestivalRemindersStore.getState().toggle('f2', '2026-05-01')
    expect(useFestivalRemindersStore.getState().list()).toHaveLength(2)
  })
})
