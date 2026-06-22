import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SuggestionChips from '@/components/vibe-booking/SuggestionChips'
import ChatFeedback from '@/components/vibe-booking/ChatFeedback'
import { useLanguageStore } from '@/lib/i18n'
import { useVibeBookingStore } from '@/stores/vibe-booking.store'

beforeEach(() => {
  useLanguageStore.setState({ locale: 'en' })
  useVibeBookingStore.setState({ messageFeedback: {} })
})

describe('SuggestionChips', () => {
  it('renders each item and a title', () => {
    render(<SuggestionChips items={['Find hotels', 'Best time?']} onSelect={() => {}} title="Try asking" />)
    expect(screen.getByText('Try asking')).toBeInTheDocument()
    expect(screen.getByText('Find hotels')).toBeInTheDocument()
    expect(screen.getByText('Best time?')).toBeInTheDocument()
  })

  it('calls onSelect with the chip text on click', () => {
    const onSelect = vi.fn()
    render(<SuggestionChips items={['Plan a 3-day trip']} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Plan a 3-day trip'))
    expect(onSelect).toHaveBeenCalledWith('Plan a 3-day trip')
  })

  it('renders nothing when empty', () => {
    const { container } = render(<SuggestionChips items={[]} onSelect={() => {}} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('ChatFeedback', () => {
  it('shows the prompt and calls onFeedback(true) on thumbs up', () => {
    const onFeedback = vi.fn()
    render(<ChatFeedback messageId="m1" onFeedback={onFeedback} />)
    expect(screen.getByText('Was this helpful?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes, helpful' }))
    expect(onFeedback).toHaveBeenCalledWith('m1', true)
  })

  it('calls onFeedback(false) on thumbs down', () => {
    const onFeedback = vi.fn()
    render(<ChatFeedback messageId="m2" onFeedback={onFeedback} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not helpful' }))
    expect(onFeedback).toHaveBeenCalledWith('m2', false)
  })

  it('shows a thank-you once a vote is recorded in the store', () => {
    useVibeBookingStore.setState({ messageFeedback: { m3: 'up' } })
    render(<ChatFeedback messageId="m3" onFeedback={() => {}} />)
    expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument()
    expect(screen.queryByText('Was this helpful?')).not.toBeInTheDocument()
  })
})
