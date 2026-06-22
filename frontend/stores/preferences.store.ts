'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Currency } from '@/types/api'

export interface NotificationPrefs {
  push: boolean
  email: boolean
  reminders: boolean
}

export type NotificationKey = keyof NotificationPrefs

interface PreferencesState {
  /** Chosen display currency, or null to follow the active locale. */
  currency: Currency | null
  setCurrency: (currency: Currency | null) => void
  notifications: NotificationPrefs
  setNotification: (key: NotificationKey, value: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: null,
      setCurrency: (currency) => set({ currency }),
      notifications: { push: false, email: true, reminders: true },
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
    }),
    { name: 'derlg:preferences' },
  ),
)
