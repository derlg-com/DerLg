'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuid } from 'uuid'

/**
 * In-app notification center (task 26.3, Requirements 19.6–19.8).
 *
 * A persisted Zustand store of recent notifications with read/unread state.
 * Notifications can be pushed from anywhere in the app (booking status changes,
 * festival reminders, incoming web-push messages forwarded from the service
 * worker) via {@link useNotificationsStore.getState().push}. Persisted to
 * localStorage so the center survives reloads. Capped to keep storage bounded.
 */

export interface AppNotification {
  id: string
  title: string
  body?: string
  /** Optional in-app route to navigate to when the notification is tapped. */
  href?: string
  /** Epoch ms the notification was created. */
  createdAt: number
  read: boolean
}

/** Max notifications retained (oldest dropped past this). */
const MAX_NOTIFICATIONS = 50

export interface NewNotification {
  title: string
  body?: string
  href?: string
}

interface NotificationsState {
  notifications: AppNotification[]
  /** Add a notification (unread). Returns the new id. */
  push: (n: NewNotification) => string
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
  unreadCount: () => number
}

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set, get) => ({
      notifications: [],
      push: ({ title, body, href }) => {
        const id = uuid()
        set((s) => ({
          notifications: [
            { id, title, body, href, createdAt: Date.now(), read: false },
            ...s.notifications,
          ].slice(0, MAX_NOTIFICATIONS),
        }))
        return id
      },
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      remove: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      clear: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: 'derlg:notifications' },
  ),
)

/** Imperative helper to push an in-app notification from non-React code. */
export function pushAppNotification(n: NewNotification): string {
  return useNotificationsStore.getState().push(n)
}
