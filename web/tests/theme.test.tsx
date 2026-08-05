import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ThemeToggle } from '@/components/layout/theme-toggle'
import {
  applyTheme,
  getThemeSnapshot,
  resetThemeStoreForTests,
  resolveTheme,
  setTheme,
  THEME_STORAGE_KEY,
} from '@/lib/theme'

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    resetThemeStoreForTests()
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    resetThemeStoreForTests()
  })

  it('defaults to following the system preference', () => {
    expect(getThemeSnapshot()).toBe('system')
  })

  it('persists an explicit preference', () => {
    setTheme('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(getThemeSnapshot()).toBe('dark')
  })

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'neon')
    resetThemeStoreForTests()
    expect(getThemeSnapshot()).toBe('system')
  })

  it('resolves explicit preferences without consulting the OS', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('toggles the dark class on the document element', () => {
    applyTheme('dark')
    expect(document.documentElement).toHaveClass('dark')

    applyTheme('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })
})

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    resetThemeStoreForTests()
    document.documentElement.classList.remove('dark')
  })

  it('renders the three preferences with system selected by default', () => {
    render(<ThemeToggle />)
    expect(screen.getByRole('radiogroup', { name: 'Colour theme' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
  })

  it('switches to dark and applies the class', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('switches back to light', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))

    expect(document.documentElement).not.toHaveClass('dark')
  })
})
