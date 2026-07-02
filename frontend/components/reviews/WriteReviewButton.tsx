'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ReviewForm } from './ReviewForm'
import { useTranslations } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { isReviewableBookingStatus, bookingTypeToReviewSubject } from '@/lib/reviews-api'

export interface WriteReviewButtonProps {
  bookingId: string
  /** Booking type (`trip` | `hotel` | `guide` | `transportation`). */
  bookingType: string
  /** Booking status — only COMPLETED bookings are reviewable (Requirement 21.3). */
  status: string
  className?: string
}

/**
 * Entry point for writing a review (Task 20.3 — Requirement 21.3). Renders a
 * "Write a review" button only when:
 *  - the user is authenticated,
 *  - the booking is COMPLETED, and
 *  - the booking type maps to a reviewable subject (trip/hotel/guide).
 *
 * Clicking opens the reusable {@link ReviewForm} pre-wired with the booking id
 * (proof of completion) and the derived subject type. Renders nothing when the
 * booking is not yet reviewable.
 */
export function WriteReviewButton({
  bookingId,
  bookingType,
  status,
  className,
}: WriteReviewButtonProps) {
  const t = useTranslations('reviews')
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [open, setOpen] = useState(false)

  const subjectType = bookingTypeToReviewSubject(bookingType)
  const canReview = isAuthenticated && isReviewableBookingStatus(status) && subjectType !== null

  if (!canReview || !subjectType) return null

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <Star className="mr-1.5 h-4 w-4" aria-hidden />
        {t('actions.write')}
      </Button>
      <ReviewForm
        open={open}
        onOpenChange={setOpen}
        subjectType={subjectType}
        bookingId={bookingId}
      />
    </>
  )
}
