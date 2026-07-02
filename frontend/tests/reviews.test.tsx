import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { ApiQueryResult } from '@/lib/use-api-query'
import type { Review, ReviewSummary, ReviewsResponse } from '@/types/domain'

// Drive the section through the project's server-state layer by mocking
// useApiQuery (same pattern as festival-detail / explore-landing).
const useApiQuery = vi.fn()
vi.mock('@/lib/use-api-query', () => ({
  useApiQuery: (...args: unknown[]) => useApiQuery(...args),
}))

import { TripReviews } from '@/components/reviews/TripReviews'
import { ReviewItem } from '@/components/reviews/ReviewItem'
import { ReviewSummaryCard } from '@/components/reviews/ReviewSummaryCard'

function makeReview(over: Partial<Review> = {}): Review {
  return {
    id: 'r1',
    rating: 5,
    text: 'Amazing trip, highly recommend!',
    images: [],
    isVerifiedBooking: true,
    author: { id: 'u1', name: 'Wendy', avatarUrl: null },
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z',
    ...over,
  }
}

const summary: ReviewSummary = {
  averageRating: 4.5,
  reviewCount: 12,
  ratingBreakdown: { '5': 8, '4': 2, '3': 1, '2': 1, '1': 0 },
}

function response(over: Partial<ReviewsResponse> = {}): ReviewsResponse {
  return {
    summary,
    items: [makeReview()],
    page: 1,
    limit: 5,
    total: 1,
    totalPages: 1,
    ...over,
  }
}

function result(over: Partial<ApiQueryResult<ReviewsResponse>>): ApiQueryResult<ReviewsResponse> {
  return { data: null, error: null, isLoading: false, refetch: vi.fn(), ...over }
}

describe('ReviewItem (Req 21.8, 36.6)', () => {
  it('renders author, rating, verified badge, date and text', () => {
    render(<ReviewItem review={makeReview()} />)
    expect(screen.getByText('Wendy')).toBeInTheDocument()
    expect(screen.getByText('Verified booking')).toBeInTheDocument()
    expect(screen.getByText('Amazing trip, highly recommend!')).toBeInTheDocument()
    expect(screen.getByText(/May 1, 2026/)).toBeInTheDocument()
    // Bubble rating is exposed via aria-label.
    expect(screen.getByLabelText(/5.0 of 5 bubbles/)).toBeInTheDocument()
  })

  it('falls back to "Anonymous" when author name is null and hides badge when unverified', () => {
    render(
      <ReviewItem
        review={makeReview({
          author: { id: 'u2', name: null, avatarUrl: null },
          isVerifiedBooking: false,
        })}
      />,
    )
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
    expect(screen.queryByText('Verified booking')).not.toBeInTheDocument()
  })

  it('omits the text paragraph when review text is null', () => {
    const { container } = render(<ReviewItem review={makeReview({ text: null })} />)
    expect(container.querySelector('p.whitespace-pre-line')).toBeNull()
  })
})

describe('ReviewSummaryCard (Req 21.1)', () => {
  it('shows average rating, count and a per-star breakdown', () => {
    const { container } = render(<ReviewSummaryCard summary={summary} />)
    expect(container.querySelector('.text-4xl')).toHaveTextContent('4.5')
    expect(screen.getByText('12 reviews')).toBeInTheDocument()
    const breakdown = screen.getByLabelText('Rating breakdown by stars')
    // 8 five-star reviews shown in the breakdown row.
    expect(within(breakdown).getByText('8')).toBeInTheDocument()
  })

  it('omits the breakdown when ratingBreakdown is absent', () => {
    render(<ReviewSummaryCard summary={{ averageRating: 3, reviewCount: 2 }} />)
    expect(screen.queryByLabelText('Rating breakdown by stars')).not.toBeInTheDocument()
  })
})

describe('TripReviews (Req 21.1, 21.2, 21.6, 21.7, 21.8, 36.6)', () => {
  beforeEach(() => useApiQuery.mockReset())
  afterEach(() => vi.clearAllMocks())

  it('fetches reviews for the subject through the query layer with type+id', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    const path = String(useApiQuery.mock.calls[0][0])
    expect(path).toContain('/v1/reviews')
    expect(path).toContain('type=trip')
    expect(path).toContain('id=trip-1')
    expect(path).toContain('page=1')
    expect(path).toContain('limit=5')
  })

  it('shows skeletons during the initial load', () => {
    useApiQuery.mockReturnValue(result({ isLoading: true }))
    const { container } = render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders the summary and a list of reviews', () => {
    useApiQuery.mockReturnValue(result({ data: response() }))
    const { container } = render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    expect(screen.getByText('Reviews & ratings')).toBeInTheDocument()
    expect(container.querySelector('.text-4xl')).toHaveTextContent('4.5')
    expect(screen.getByText('Amazing trip, highly recommend!')).toBeInTheDocument()
  })

  it('shows the empty state when there are no reviews', () => {
    useApiQuery.mockReturnValue(
      result({
        data: response({
          items: [],
          total: 0,
          summary: { averageRating: 0, reviewCount: 0 },
        }),
      }),
    )
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
  })

  it('shows an error state with a retry action on failure', () => {
    const refetch = vi.fn()
    useApiQuery.mockReturnValue(
      result({ error: Object.assign(new Error('boom'), { status: 500 }) as never, refetch }),
    )
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    expect(screen.getByText("Couldn't load reviews")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('updating the sort control refetches with the new sort and resets to page 1', () => {
    useApiQuery.mockReturnValue(result({ data: response({ total: 10, totalPages: 2 }) }))
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'rating_desc' } })
    const lastPath = String(useApiQuery.mock.calls.at(-1)![0])
    expect(lastPath).toContain('sort=rating_desc')
    expect(lastPath).toContain('page=1')
  })

  it('filtering by rating adds minRating to the request', () => {
    useApiQuery.mockReturnValue(result({ data: response({ total: 10, totalPages: 2 }) }))
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    fireEvent.change(screen.getByLabelText('Filter'), { target: { value: '4' } })
    const lastPath = String(useApiQuery.mock.calls.at(-1)![0])
    expect(lastPath).toContain('minRating=4')
  })

  it('shows a "show more" affordance when more reviews remain and advances the page', () => {
    useApiQuery.mockReturnValue(result({ data: response({ total: 10, totalPages: 2 }) }))
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    const showMore = screen.getByRole('button', { name: 'Show more reviews' })
    fireEvent.click(showMore)
    const lastPath = String(useApiQuery.mock.calls.at(-1)![0])
    expect(lastPath).toContain('page=2')
  })

  it('hides "show more" when all reviews are loaded', () => {
    useApiQuery.mockReturnValue(result({ data: response({ total: 1, totalPages: 1 }) }))
    render(<TripReviews subjectType="trip" subjectId="trip-1" />)
    expect(screen.queryByRole('button', { name: 'Show more reviews' })).not.toBeInTheDocument()
  })
})
