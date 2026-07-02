import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SupportInfo } from '@/components/checkout/SupportInfo'
import { useLanguageStore } from '@/lib/i18n'
import { SUPPORT_EMAIL, SUPPORT_PHONE, supportTel } from '@/lib/support'

// Task 13.3 — Display contact and support info (Requirement 39.7).
//
// The confirmation page must show how to reach support (email + phone with
// service hours) and instructions for making changes/cancellations. All copy is
// i18n-driven; the contact values come from `@/lib/support` (env-overridable).

describe('SupportInfo (Task 13.3)', () => {
  afterEach(() => {
    useLanguageStore.setState({ locale: 'en' })
  })

  it('renders the support email as a mailto link', () => {
    render(<SupportInfo />)
    const link = screen.getByRole('link', { name: SUPPORT_EMAIL })
    expect(link).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  it('renders the support phone as a tel link with a normalized href', () => {
    render(<SupportInfo />)
    const link = screen.getByRole('link', { name: SUPPORT_PHONE })
    expect(link).toHaveAttribute('href', supportTel())
    // tel: href must contain only digits and an optional leading '+'.
    expect(link.getAttribute('href')).toMatch(/^tel:\+?\d+$/)
  })

  it('shows service hours and change/cancellation instructions (39.7)', () => {
    render(<SupportInfo />)
    expect(screen.getByText('Contact & support')).toBeInTheDocument()
    expect(screen.getByText(/Daily, 8:00 AM/)).toBeInTheDocument()
    expect(screen.getByText(/change or cancel this booking/i)).toBeInTheDocument()
  })

  it('is hidden from the printed confirmation (print-hidden)', () => {
    render(<SupportInfo />)
    expect(screen.getByTestId('support-info')).toHaveClass('print-hidden')
  })

  it('translates the heading when the locale changes', () => {
    useLanguageStore.setState({ locale: 'zh' })
    render(<SupportInfo />)
    expect(screen.getByText('联系与支持')).toBeInTheDocument()
    // Contact values are not translated — only the labels/copy are.
    expect(screen.getByRole('link', { name: SUPPORT_EMAIL })).toBeInTheDocument()
  })
})
