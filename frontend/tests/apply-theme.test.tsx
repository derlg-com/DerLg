import { describe, it, expect, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { applyThemeClass, ThemeSync } from '@/hooks/use-apply-theme'
import { usePreferencesStore } from '@/stores/preferences.store'

// Theme application: an explicit Light/Dark choice sets a class on <html> that
// overrides the OS preference; `system` leaves no class so the
// prefers-color-scheme media query decides (Requirements 27.6, 27.7).
describe('applyThemeClass (Req 27.6, 27.7)', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('html')
  })

  it('adds the "dark" class for the dark theme', () => {
    applyThemeClass('dark', root)
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.classList.contains('light')).toBe(false)
  })

  it('adds the "light" class for the light theme', () => {
    applyThemeClass('light', root)
    expect(root.classList.contains('light')).toBe(true)
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('leaves no theme class for the system theme', () => {
    applyThemeClass('system', root)
    expect(root.classList.contains('light')).toBe(false)
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('replaces a previously applied class when switching themes', () => {
    applyThemeClass('dark', root)
    applyThemeClass('light', root)
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.classList.contains('light')).toBe(true)

    applyThemeClass('system', root)
    expect(root.classList.contains('light')).toBe(false)
    expect(root.classList.contains('dark')).toBe(false)
  })
})

describe('ThemeSync (Req 27.6, 27.7) — applies persisted theme to <html>', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('light', 'dark')
    usePreferencesStore.setState({ theme: 'system' })
  })

  it('applies the dark class on mount when the store theme is dark', () => {
    usePreferencesStore.setState({ theme: 'dark' })
    render(<ThemeSync />)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('updates the html class immediately when the theme changes', () => {
    render(<ThemeSync />)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => usePreferencesStore.getState().setTheme('dark'))
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => usePreferencesStore.getState().setTheme('light'))
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    act(() => usePreferencesStore.getState().setTheme('system'))
    expect(document.documentElement.classList.contains('light')).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
