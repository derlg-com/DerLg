import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

import type { Review } from '@/types/domain'

// --- Module mocks -----------------------------------------------------------
const createReview = vi.fn()
const updateReview = vi.fn()
const deleteReview = vi.fn()
vi.mock('@/lib/reviews-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/reviews-api')>('@/lib/reviews-api')
  return {
    ...actual,
    createReview: (...a: unknown[]) => createReview(...a),
    updateReview: (...a: unknown[]) => updateReview(...a),
    deleteReview: (...a: unknown[]) => deleteReview(...a),
  }
})

const uploadReviewPhoto = vi.fn()
vi.mock('@/lib/image-upload', async () => {
  const actual = await vi.importActual<typeof import('@/lib/image-upload')>('@/lib/image-upload')
  return { ...actual, uploadReviewPhoto: (...a: unknown[]) => uploadReviewPhoto(...a) }
})

const toast = vi.fn()
vi.mock('@/components/ui/toast', () => ({ toast: (...a: unknown[]) => toast(...a) }))

const invalidateApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  invalidateApiQuery: (...a: unknown[]) => invalidateApiQuery(...a),
}))

import { ReviewForm } from '@/components/reviews/ReviewForm'
import { ReviewItem } from '@/components/reviews/ReviewItem'
import { WriteReviewButton } from '@/components/reviews/WriteReviewButton'
import { useAuthStore } from '@/stores/auth.store'

function makeReview(over: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    rating: 4,
    text: 'Solid experience, would book again for sure.',
    images: [],
    isVerifiedBooking: true,
    author: { id: 'u1', name: 'Wendy', avatarUrl: null },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...over,
  }
}

function signIn(id = 'u1') {
  useAuthStore.getState().setSession('test-token', {
    id,
    email: 'wendy@example.com',
    name: 'Wendy',
    role: 'user',
  })
  useAuthStore.getState().setRehydrated(true)
}

beforeEach(() => {
  createReview.mockReset()
  updateReview.mockReset()
  deleteReview.mockReset()
  uploadReviewPhoto.mockReset()
  toast.mockReset()
  invalidateApiQuery.mockReset()
  useAuthStore.getState().clearSession()
})
afterEach(() => vi.clearAllMocks())

describe('ReviewForm — create (Req 21.3, 21.4)', () => {
  it('blocks submission and shows field errors when rating/text are invalid', () => {
    signIn()
    render(
      <ReviewForm open onOpenChange={vi.fn()} subjectType="trip" subjectId="t1" bookingId="b1" />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))
    expect(createReview).not.toHaveBeenCalled()
    // No rating selected and empty text -> two field errors surface.
    expect(screen.getByText('Select a rating from 1 to 5 stars.')).toBeInTheDocument()
    expect(screen.getByText('Review must be at least 10 characters.')).toBeInTheDocument()
  })

  it('submits a valid review with the booking id and derived subject type', async () => {
    signIn()
    createReview.mockResolvedValue(makeReview())
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <ReviewForm
        open
        onOpenChange={onOpenChange}
        subjectType="trip"
        subjectId="t1"
        bookingId="b1"
        onSaved={onSaved}
      />,
    )
    // Pick 4 stars.
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    fireEvent.change(screen.getByLabelText('Your review'), {
      target: { value: 'Great trip, highly recommend to everyone!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))

    await waitFor(() => expect(createReview).toHaveBeenCalled())
    const [payload, idem] = createReview.mock.calls[0]
    expect(payload).toMatchObject({
      type: 'trip',
      subjectId: 't1',
      bookingId: 'b1',
      rating: 4,
      text: 'Great trip, highly recommend to everyone!',
      images: [],
    })
    expect(idem).toBe('b1')
    expect(invalidateApiQuery).toHaveBeenCalledWith('/v1/reviews')
    expect(onSaved).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('surfaces an inline error toast when the backend endpoint is unavailable', async () => {
    signIn()
    createReview.mockRejectedValue(new Error('404'))
    render(
      <ReviewForm open onOpenChange={vi.fn()} subjectType="trip" subjectId="t1" bookingId="b1" />,
    )
    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }))
    fireEvent.change(screen.getByLabelText('Your review'), {
      target: { value: 'An unforgettable experience all around.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })),
    )
  })

  it('shows a live character count', () => {
    signIn()
    render(
      <ReviewForm open onOpenChange={vi.fn()} subjectType="trip" subjectId="t1" bookingId="b1" />,
    )
    fireEvent.change(screen.getByLabelText('Your review'), { target: { value: 'Hello' } })
    expect(screen.getByText('995 characters left')).toBeInTheDocument()
  })
})

describe('ReviewForm — edit (Req 21.9)', () => {
  it('pre-fills from the review and PATCHes via updateReview', async () => {
    signIn()
    updateReview.mockResolvedValue(makeReview({ rating: 3, text: 'Edited review text here.' }))
    render(
      <ReviewForm
        open
        onOpenChange={vi.fn()}
        subjectType="trip"
        subjectId="t1"
        review={makeReview()}
      />,
    )
    // Pre-filled text from the existing review.
    const textarea = screen.getByLabelText('Your review') as HTMLTextAreaElement
    expect(textarea.value).toBe('Solid experience, would book again for sure.')

    fireEvent.change(textarea, { target: { value: 'Edited review text here too.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(updateReview).toHaveBeenCalled())
    const [id, payload] = updateReview.mock.calls[0]
    expect(id).toBe('r1')
    expect(payload).toMatchObject({ rating: 4, text: 'Edited review text here too.' })
    expect(createReview).not.toHaveBeenCalled()
  })
})

describe('ReviewItem — own-review affordances (Req 21.9)', () => {
  it('shows edit/delete only for the current user’s review', () => {
    signIn('u1')
    const { rerender } = render(
      <ReviewItem
        review={makeReview({ author: { id: 'u1', name: 'Wendy', avatarUrl: null } })}
        subjectType="trip"
        subjectId="t1"
      />,
    )
    expect(screen.getByRole('button', { name: 'Edit review' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete review' })).toBeInTheDocument()

    rerender(
      <ReviewItem
        review={makeReview({ author: { id: 'someone-else', name: 'Ben', avatarUrl: null } })}
        subjectType="trip"
        subjectId="t1"
      />,
    )
    expect(screen.queryByRole('button', { name: 'Edit review' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete review' })).not.toBeInTheDocument()
  })

  it('confirms then deletes the review and invalidates the list', async () => {
    signIn('u1')
    deleteReview.mockResolvedValue(undefined)
    const onChanged = vi.fn()
    render(
      <ReviewItem review={makeReview()} subjectType="trip" subjectId="t1" onChanged={onChanged} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete review' }))
    // Confirm dialog appears.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete review?')).toBeInTheDocument()
    // Click the confirm button inside the dialog (labelled "Delete review").
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete review' }))

    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith('r1'))
    expect(invalidateApiQuery).toHaveBeenCalledWith('/v1/reviews')
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})

describe('WriteReviewButton — gating (Req 21.3)', () => {
  it('renders nothing when not authenticated', () => {
    const { container } = render(
      <WriteReviewButton bookingId="b1" bookingType="trip" status="COMPLETED" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a non-completed booking', () => {
    signIn()
    const { container } = render(
      <WriteReviewButton bookingId="b1" bookingType="trip" status="CONFIRMED" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a non-reviewable booking type', () => {
    signIn()
    const { container } = render(
      <WriteReviewButton bookingId="b1" bookingType="transportation" status="COMPLETED" />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the entry point for an authenticated, completed, reviewable booking', () => {
    signIn()
    render(<WriteReviewButton bookingId="b1" bookingType="trip" status="COMPLETED" />)
    expect(screen.getByRole('button', { name: 'Write a review' })).toBeInTheDocument()
  })
})
