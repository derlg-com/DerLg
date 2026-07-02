'use client'

import { useEffect } from 'react'
import { usePreferencesStore, type Theme } from '@/stores/preferences.store'

/**
 * Resolve the document theme classes for a given preference. `system` leaves
 * neither class set so the `prefers-color-scheme` media query in globals.css
 * decides; `light`/`dark` set an explicit class that overrides the OS.
 */
export function applyThemeClass(theme: Theme, root: HTMLElement): void {
  root.classList.remove('light', 'dark')
  if (theme === 'light' || theme === 'dark') {
    root.classList.add(theme)
  }
}

/**
 * Applies the persisted theme preference to the `<html>` element on mount and
 * whenever it changes, so an explicit Light/Dark choice takes effect
 * immediately (Requirements 27.6, 27.7). SSR-safe: the effect only runs on the
 * client. Mount this once near the app root.
 */
export function useApplyTheme(): void {
  const theme = usePreferencesStore((s) => s.theme)
  useEffect(() => {
    if (typeof document === 'undefined') return
    applyThemeClass(theme, document.documentElement)
  }, [theme])
}

/** Headless component wrapper around {@link useApplyTheme} for the layout tree. */
export function ThemeSync(): null {
  useApplyTheme()
  return null
}
