'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Festival reminder intents (Requirement 41.8).
 *
 * BACKEND-CONTRACT / FCM GAP: the backend exposes no festival-reminder
 * scheduling endpoint, and push delivery requires Firebase config that may be
 * absent (see hooks/use-push-notifications.ts). So reminder *intent* is stored
 * locally here: when a user enables a reminder for a favorited festival we
 * record the festival id (plus its start date for local scheduling). The push
 * layer degrades gracefully — if notifications are permitted a local
 * notification can be shown/scheduled; otherwise the intent is simply kept so
 * the toggle state survives reloads and can be synced once a backend endpoint
 * exists.
 */

interface FestivalReminderEntry {
  festivalId: string
  /** Festival start date (ISO) the reminder is anchored to. */
  startDate: string
  /** Epoch ms the reminder intent was created. */
  createdAt: number
}

interface FestivalRemindersState {
  reminders: Record<string, FestivalReminderEntry>
  has: (festivalId: string) => boolean
  toggle: (festivalId: string, startDate: string) => boolean
  remove: (festivalId: string) => void
  list: () => FestivalReminderEntry[]
}

export const useFestivalRemindersStore = create<FestivalRemindersState>()(
  persist(
    (set, get) => ({
      reminders: {},
      has: (festivalId) => Boolean(get().reminders[festivalId]),
      toggle: (festivalId, startDate) => {
        const exists = Boolean(get().reminders[festivalId])
        set((s) => {
          const next = { ...s.reminders }
          if (exists) {
            delete next[festivalId]
          } else {
            next[festivalId] = { festivalId, startDate, createdAt: Date.now() }
          }
          return { reminders: next }
        })
        // Return the new enabled state.
        return !exists
      },
      remove: (festivalId) =>
        set((s) => {
          if (!s.reminders[festivalId]) return s
          const next = { ...s.reminders }
          delete next[festivalId]
          return { reminders: next }
        }),
      list: () => Object.values(get().reminders),
    }),
    { name: 'derlg:festival-reminders' },
  ),
)
