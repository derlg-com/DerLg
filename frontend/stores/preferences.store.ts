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

/**
 * Display theme. `system` follows the OS `prefers-color-scheme` (the current
 * default behaviour); `light`/`dark` force a fixed theme.
 */
export type Theme = 'system' | 'light' | 'dark'

interface PreferencesState {
  /** Chosen display currency, or null to follow the active locale. */
  currency: Currency | null
  setCurrency: (currency: Currency | null) => void
  /** Chosen colour theme (defaults to following the OS preference). */
  theme: Theme
  setTheme: (theme: Theme) => void
  notifications: NotificationPrefs
  setNotification: (key: NotificationKey, value: boolean) => void
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      currency: null,
      setCurrency: (currency) => set({ currency }),
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      notifications: { push: false, email: true, reminders: true },
      setNotification: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
    }),
    { name: 'derlg:preferences' },
  ),
)
