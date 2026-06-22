import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { pageContextLabel } from '@/lib/vibe-content'

// Mock the WebSocket hook (jsdom has no WebSocket) and the heavy chat children.
const sendMessage = vi.fn()
vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ sendMessage, sendAction: vi.fn(), sendFeedback: vi.fn(), reauth: vi.fn() }),
}))
vi.mock('@/components/vibe-booking/ContentStage', () => ({
  default: () => <div data-testid="content-stage" />,
}))
vi.mock('@/components/vibe-booking/ChatPanel', () => ({
  default: () => <div data-testid="chat-panel" />,
}))
vi.mock('@/components/vibe-booking/LoginModal', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({ usePathname: () => '/search' }))
// Render framer-motion elements synchronously (no enter/exit animation deferral).
vi.mock('framer-motion', async () => {
  const React = await import('react')
  const strip = (p: Record<string, unknown>) => {
    const { initial, animate, exit, transition, ...rest } = p
    void initial
    void animate
    void exit
    void transition
    return rest
  }
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get:
          (_t, tag: string) =>
          ({ children, ...props }: { children?: React.ReactNode }) =>
            React.createElement(tag, strip(props as Record<string, unknown>), children),
      },
    ),
  }
})

import ChatLauncher from '@/components/vibe-booking/ChatLauncher'
import { useLanguageStore } from '@/lib/i18n'

beforeEach(() => {
  useLanguageStore.setState({ locale: 'en' })
  sendMessage.mockClear()
})

describe('pageContextLabel', () => {
  it('maps known app routes to friendly labels', () => {
    expect(pageContextLabel('/')).toBe('Home')
    expect(pageContextLabel('/search')).toBe('Explore')
    expect(pageContextLabel('/bookings')).toBe('My Trips')
    expect(pageContextLabel('/profile')).toBe('Profile')
    expect(pageContextLabel('/trips/abc-123')).toBe('Trip details')
    expect(pageContextLabel('/hotels/x')).toBe('Hotels')
  })
  it('falls back to DerLg for unknown routes', () => {
    expect(pageContextLabel('/something-else')).toBe('DerLg')
  })
})

describe('ChatLauncher', () => {
  it('shows the bubble and opens the dock with page context on click', () => {
    render(<ChatLauncher />)
    const bubble = screen.getByRole('button', { name: 'Ask the AI travel concierge' })
    expect(bubble).toBeInTheDocument()

    fireEvent.click(bubble)
    const dialog = screen.getByRole('dialog', { name: 'AI Concierge' })
    expect(dialog).toBeInTheDocument()
    // Page context derived from pathname '/search' → 'Explore'
    expect(screen.getByText('Asked while viewing Explore')).toBeInTheDocument()
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.getByTestId('content-stage')).toBeInTheDocument()
  })

  it('closes the dock when the close button is clicked', () => {
    render(<ChatLauncher />)
    fireEvent.click(screen.getByRole('button', { name: 'Ask the AI travel concierge' }))
    expect(screen.getByRole('dialog', { name: 'AI Concierge' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close concierge' }))
    expect(screen.queryByRole('dialog', { name: 'AI Concierge' })).not.toBeInTheDocument()
  })
})
