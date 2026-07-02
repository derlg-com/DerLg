import { z } from 'zod'

/**
 * Review submission / edit form schema (Section 20.3 / 20.4 — Requirements
 * 21.3, 21.4, 21.5). Pure and DOM-free so it is directly unit-testable.
 *
 * Error messages are i18n *keys* (resolved under `reviews.form.errors.*` by the
 * form via `t()`), matching the lightweight controlled-form convention used
 * across the app (e.g. `schemas/auth.ts`).
 */

/** Min/max review text length (Requirement 21.4). */
export const REVIEW_TEXT_MIN = 10
export const REVIEW_TEXT_MAX = 1000
/** Max number of photos attached to a review (Requirement 21.5). */
export const REVIEW_MAX_PHOTOS = 5
/** Allowed rating range (Requirement 21.3). */
export const REVIEW_RATING_MIN = 1
export const REVIEW_RATING_MAX = 5

export const reviewFormSchema = z.object({
  /** 1–5 stars (integer). 0 means "not yet selected" and fails `min`. */
  rating: z
    .number({ message: 'rating' })
    .int('rating')
    .min(REVIEW_RATING_MIN, 'rating')
    .max(REVIEW_RATING_MAX, 'rating'),
  /** 10–1000 characters after trimming. */
  text: z.string().trim().min(REVIEW_TEXT_MIN, 'textMin').max(REVIEW_TEXT_MAX, 'textMax'),
  /** Up to 5 already-uploaded image URLs. */
  images: z.array(z.string()).max(REVIEW_MAX_PHOTOS, 'tooManyPhotos'),
})

export type ReviewFormValues = z.infer<typeof reviewFormSchema>
