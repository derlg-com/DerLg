import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BottomNav } from '@/components/layout/bottom-nav'
import { CurrencySwitcher } from '@/components/layout/currency-switcher'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { CURRENCY_STORAGE_KEY, resetCurrencyStoreForTests } from '@/lib/currency'

import { renderWithProviders } from './helpers/render'

let pathname = '/'

vi.mock('@/lib/i18n/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

beforeEach(() => {
  pathname = '/'
  resetCurrencyStoreForTests()
})

describe('BottomNav', () => {
  it('exposes a labelled navigation landmark', () => {
    renderWithProviders(<BottomNav />)
    expect(screen.getByRole('navigation', { name: 'Primary sections' })).toBeInTheDocument()
  })

  it('renders exactly five destinations, the maximum for a bottom bar', () => {
    renderWithProviders(<BottomNav />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })

  it('marks the current route with aria-current', () => {
    pathname = '/explore'
    renderWithProviders(<BottomNav />)

    expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('treats a nested route as active for its section', () => {
    pathname = '/bookings/abc-123'
    renderWithProviders(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark home active on every route, despite its "/" href', () => {
    pathname = '/explore'
    renderWithProviders(<BottomNav />)
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('translates labels for the active locale', () => {
    renderWithProviders(<BottomNav />, { locale: 'km' })
    const labels = screen.getAllByRole('link').map((link) => link.textContent ?? '')
    expect(labels.join(' ')).toMatch(/[\u1780-\u17ff]/)
  })
})

describe('OfflineBanner', () => {
  const originalOnLine = window.navigator.onLine

  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: originalOnLine,
      configurable: true,
    })
  })

  function setOnLine(value: boolean) {
    Object.defineProperty(window.navigator, 'onLine', { value, configurable: true })
  }

  it('says nothing while online', () => {
    setOnLine(true)
    renderWithProviders(<OfflineBanner />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('announces assertively when offline, since it changes what the user can do', () => {
    setOnLine(false)
    renderWithProviders(<OfflineBanner />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'assertive')
    expect(status).toHaveTextContent(/offline/i)
  })

  it('clears the message when connectivity returns', async () => {
    setOnLine(false)
    renderWithProviders(<OfflineBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i)

    setOnLine(true)
    window.dispatchEvent(new Event('online'))

    await vi.waitFor(() => expect(screen.getByRole('status')).toBeEmptyDOMElement())
  })
})

describe('CurrencySwitcher', () => {
  it('defaults to USD, the currency the backend quotes', async () => {
    renderWithProviders(<CurrencySwitcher />)
    expect(await screen.findByRole('button', { name: /USD/ })).toBeInTheDocument()
  })

  it('switches and persists the display currency', async () => {
    renderWithProviders(<CurrencySwitcher />)

    await userEvent.click(await screen.findByRole('button', { name: /USD/ }))
    // Scope to the popover: once KHR is chosen the trigger shows it too.
    const options = screen.getByRole('dialog', { name: 'Currency' })
    await userEvent.click(within(options).getByRole('button', { name: /KHR/ }))

    expect(localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe('KHR')
    expect(await screen.findByRole('button', { name: /KHR/ })).toBeInTheDocument()
  })

  it('closes the menu after a selection', async () => {
    renderWithProviders(<CurrencySwitcher />)

    await userEvent.click(await screen.findByRole('button', { name: /USD/ }))
    const options = screen.getByRole('dialog', { name: 'Currency' })
    await userEvent.click(within(options).getByRole('button', { name: /KHR/ }))

    expect(screen.queryByRole('dialog', { name: 'Currency' })).not.toBeInTheDocument()
  })

  it('restores a persisted currency', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'CNY')
    resetCurrencyStoreForTests()

    renderWithProviders(<CurrencySwitcher />)
    expect(await screen.findByRole('button', { name: /CNY/ })).toBeInTheDocument()
  })

  it('ignores a corrupted stored value', async () => {
    localStorage.setItem(CURRENCY_STORAGE_KEY, 'DOGE')
    resetCurrencyStoreForTests()

    renderWithProviders(<CurrencySwitcher />)
    expect(await screen.findByRole('button', { name: /USD/ })).toBeInTheDocument()
  })

  it('marks the active currency for assistive tech', async () => {
    renderWithProviders(<CurrencySwitcher />)
    await userEvent.click(await screen.findByRole('button', { name: /USD/ }))

    const options = screen.getByRole('dialog', { name: 'Currency' })
    expect(options.querySelector('[aria-current="true"]')?.textContent).toContain('USD')
  })
})
