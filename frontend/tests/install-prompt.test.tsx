import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstallPrompt } from '@/components/shared/InstallPrompt'
import { INSTALL_DISMISSED_KEY } from '@/lib/pwa-install'

/**
 * Tests for the PWA install affordance (task 19.4, Requirements 12.6, 12.7):
 * visibility on a captured beforeinstallprompt, dismissal persistence, and the
 * iOS manual-instructions fallback.
 */

function setUserAgent(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    get: () => ua,
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    get: () => maxTouchPoints,
  })
}

/** Build a fake beforeinstallprompt event with a stubbed user choice. */
function makeBipEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: string; platform: string }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  return event
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.removeItem(INSTALL_DISMISSED_KEY)
    // Default: a normal desktop/Android browser (not iOS, not standalone).
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120', 5)
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    )
  })

  afterEach(() => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120', 5)
  })

  it('renders nothing until a beforeinstallprompt is captured (non-iOS)', () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the install button after beforeinstallprompt fires', () => {
    render(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(makeBipEvent())
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument()
  })

  it('dismissing hides the prompt and persists the dismissal', async () => {
    const user = userEvent.setup()
    render(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(makeBipEvent())
    })

    await user.click(screen.getByRole('button', { name: /not now/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(INSTALL_DISMISSED_KEY)).toBe('1')
  })

  it('does not show again once dismissal is persisted', () => {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1')
    render(<InstallPrompt />)
    act(() => {
      window.dispatchEvent(makeBipEvent())
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows iOS Add-to-Home-Screen instructions on iOS Safari (no install button)', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari', 5)
    render(<InstallPrompt />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument()
  })
})
