import { describe, it, expect } from 'vitest'

import {
  reviewFormSchema,
  REVIEW_TEXT_MIN,
  REVIEW_TEXT_MAX,
  REVIEW_MAX_PHOTOS,
} from '@/schemas/review'
import { isReviewableBookingStatus, bookingTypeToReviewSubject } from '@/lib/reviews-api'
import { parseUploadedUrl } from '@/lib/image-upload'

/** First Zod issue message for a given field, or undefined when valid. */
function fieldError(
  values: { rating: number; text: string; images: string[] },
  field: 'rating' | 'text' | 'images',
): string | undefined {
  const res = reviewFormSchema.safeParse(values)
  if (res.success) return undefined
  return res.error.issues.find((i) => i.path[0] === field)?.message
}

const base = { rating: 5, text: 'A'.repeat(20), images: [] as string[] }

describe('reviewFormSchema (Req 21.3, 21.4, 21.5)', () => {
  it('accepts a valid review', () => {
    expect(reviewFormSchema.safeParse(base).success).toBe(true)
  })

  // --- Rating range (Requirement 21.3) ---
  it('rejects rating 0 (not yet selected)', () => {
    expect(fieldError({ ...base, rating: 0 }, 'rating')).toBe('rating')
  })

  it.each([1, 2, 3, 4, 5])('accepts in-range rating %i', (rating) => {
    expect(fieldError({ ...base, rating }, 'rating')).toBeUndefined()
  })

  it.each([0, 6, -1])('rejects out-of-range rating %i', (rating) => {
    expect(fieldError({ ...base, rating }, 'rating')).toBe('rating')
  })

  it('rejects a non-integer rating', () => {
    expect(fieldError({ ...base, rating: 3.5 }, 'rating')).toBe('rating')
  })

  // --- Text length 10–1000 (Requirement 21.4) ---
  it(`rejects text shorter than ${REVIEW_TEXT_MIN} chars`, () => {
    expect(fieldError({ ...base, text: 'too short' }, 'text')).toBe('textMin')
  })

  it(`accepts text at exactly ${REVIEW_TEXT_MIN} chars`, () => {
    expect(fieldError({ ...base, text: 'a'.repeat(REVIEW_TEXT_MIN) }, 'text')).toBeUndefined()
  })

  it(`accepts text at exactly ${REVIEW_TEXT_MAX} chars`, () => {
    expect(fieldError({ ...base, text: 'a'.repeat(REVIEW_TEXT_MAX) }, 'text')).toBeUndefined()
  })

  it(`rejects text longer than ${REVIEW_TEXT_MAX} chars`, () => {
    expect(fieldError({ ...base, text: 'a'.repeat(REVIEW_TEXT_MAX + 1) }, 'text')).toBe('textMax')
  })

  it('trims surrounding whitespace before measuring length', () => {
    // 9 real chars + padding -> still under the minimum after trim.
    expect(fieldError({ ...base, text: '   short   ' }, 'text')).toBe('textMin')
  })

  // --- Photo count max 5 (Requirement 21.5) ---
  it(`accepts up to ${REVIEW_MAX_PHOTOS} photos`, () => {
    const images = Array.from({ length: REVIEW_MAX_PHOTOS }, (_, i) => `p${i}.jpg`)
    expect(fieldError({ ...base, images }, 'images')).toBeUndefined()
  })

  it(`rejects more than ${REVIEW_MAX_PHOTOS} photos`, () => {
    const images = Array.from({ length: REVIEW_MAX_PHOTOS + 1 }, (_, i) => `p${i}.jpg`)
    expect(fieldError({ ...base, images }, 'images')).toBe('tooManyPhotos')
  })
})

describe('isReviewableBookingStatus (Req 21.3 — completed only)', () => {
  it('allows COMPLETED (case-insensitive)', () => {
    expect(isReviewableBookingStatus('COMPLETED')).toBe(true)
    expect(isReviewableBookingStatus('completed')).toBe(true)
  })

  it.each(['CONFIRMED', 'PENDING_PAYMENT', 'HOLD', 'CANCELLED', 'EXPIRED', '', null, undefined])(
    'rejects non-completed status %s',
    (status) => {
      expect(isReviewableBookingStatus(status as string)).toBe(false)
    },
  )
})

describe('bookingTypeToReviewSubject', () => {
  it.each([
    ['trip', 'trip'],
    ['hotel', 'hotel'],
    ['guide', 'guide'],
    ['TRIP', 'trip'],
  ])('maps %s -> %s', (type, expected) => {
    expect(bookingTypeToReviewSubject(type)).toBe(expected)
  })

  it.each(['transportation', 'unknown', '', null, undefined])(
    'returns null for non-reviewable type %s',
    (type) => {
      expect(bookingTypeToReviewSubject(type as string)).toBeNull()
    },
  )
})

describe('parseUploadedUrl', () => {
  it('reads url from the { success, data } envelope', () => {
    expect(parseUploadedUrl({ success: true, data: { url: 'https://x/p.jpg' } })).toBe(
      'https://x/p.jpg',
    )
  })

  it('reads url from a bare body', () => {
    expect(parseUploadedUrl({ url: 'https://x/p.jpg' })).toBe('https://x/p.jpg')
  })

  it('accepts imageUrl / avatarUrl aliases', () => {
    expect(parseUploadedUrl({ data: { imageUrl: 'https://x/i.jpg' } })).toBe('https://x/i.jpg')
    expect(parseUploadedUrl({ avatarUrl: 'https://x/a.jpg' })).toBe('https://x/a.jpg')
  })

  it('returns null when no url is present', () => {
    expect(parseUploadedUrl({ data: {} })).toBeNull()
    expect(parseUploadedUrl(null)).toBeNull()
    expect(parseUploadedUrl('nope')).toBeNull()
  })
})
