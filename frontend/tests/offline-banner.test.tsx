import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { useShellStore } from '@/stores/shell.store'

/**
 * Tests for offline-mode detection and the connectivity banner
 * (task 9.4, Requirement 11.9: "WHEN a user is offline, THE Frontend_App SHALL
 * display a banner indicating offline mode").
 *
 * Connectivity is driven by `navigator.onLine` plus the `online`/`offline`
 * window events; the banner surfaces it and mirrors the value into the shell
 * store so other surfaces can degrade gracefully.
 */

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  })
}

function goOffline() {
  setNavigatorOnline(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
}

function goOnline() {
  setNavigatorOnline(true)
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
}

describe('OfflineBanner', () => {
  beforeEach(() => {
    setNavigatorOnline(true)
    useShellStore.setState({ online: true })
  })

  afterEach(() => {
    setNavigatorOnline(true)
  })

  it('renders no offline message while online but keeps a persistent live region', () => {
    render(<OfflineBanner />)
    // A stable aria-live region must exist even when online so assistive tech
    // has somewhere to announce the eventual transition.
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'assertive')
    expect(region).toBeEmptyDOMElement()
  })

  it('shows the offline message when navigator starts offline', () => {
    setNavigatorOnline(false)
    render(<OfflineBanner />)
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it('reacts to going offline then back online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()

    goOffline()
    expect(screen.getByText(/offline/i)).toBeInTheDocument()

    goOnline()
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
  })

  it('mirrors connectivity into the shell store', () => {
    render(<OfflineBanner />)
    expect(useShellStore.getState().online).toBe(true)

    goOffline()
    expect(useShellStore.getState().online).toBe(false)

    goOnline()
    expect(useShellStore.getState().online).toBe(true)
  })
})
