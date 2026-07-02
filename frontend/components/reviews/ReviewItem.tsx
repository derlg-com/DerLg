'use client'

import { useState } from 'react'
import { BadgeCheck, Pencil, Trash2 } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { RatingBubbles } from '@/components/ui/rating-bubbles'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { ReviewForm } from './ReviewForm'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatDateShort } from '@/lib/format'
import { useAuthStore } from '@/stores/auth.store'
import { deleteReview } from '@/lib/reviews-api'
import { invalidateApiQuery } from '@/lib/use-api-query'
import type { Review, ReviewSubjectType } from '@/types/domain'

export interface ReviewItemProps {
  review: Review
  /** Subject context, required to enable the edit affordance (reuses ReviewForm). */
  subjectType?: ReviewSubjectType
  subjectId?: string
  /** Notify the parent list after an edit or delete so it can refresh. */
  onChanged?: () => void
}

/**
 * A single review row: author avatar/name, star rating, verified-booking badge,
 * relative date, the review text, and any attached photos (Requirement 21.2).
 *
 * When the review belongs to the signed-in user (`review.author.id` matches the
 * auth store user id), inline Edit/Delete affordances are shown (Task 20.4 —
 * Requirement 21.9): Edit reuses {@link ReviewForm}; Delete opens a confirm
 * dialog and calls `DELETE /v1/reviews/:id`.
 */
export function ReviewItem({ review, subjectType, subjectId, onChanged }: ReviewItemProps) {
  const t = useTranslations('reviews')
  const locale = useLanguageStore((s) => s.locale)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const authorName = review.author.name ?? t('anonymous')
  const isOwn = Boolean(currentUserId) && review.author.id === currentUserId

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    setDeleting(true)
    try {
      await deleteReview(review.id)
      toast({ title: t('actions.deleteSuccess'), variant: 'success' })
      invalidateApiQuery('/v1/reviews')
      setDeleteOpen(false)
      onChanged?.()
    } catch {
      // Backend reviews module may be missing — degrade gracefully.
      toast({ title: t('actions.deleteError'), variant: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="space-y-2 border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Avatar src={review.author.avatarUrl} name={authorName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium text-foreground">{authorName}</p>
            {review.isVerifiedBooking ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                title={t('verifiedHint')}
              >
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                {t('verified')}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <RatingBubbles rating={review.rating} size="sm" />
            <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
              {formatDateShort(review.createdAt, locale)}
            </time>
          </div>
        </div>
        {isOwn ? (
          <div className="flex shrink-0 items-center gap-1">
            {subjectType ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={t('actions.edit')}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t('actions.delete')}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      {review.text ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {review.text}
        </p>
      ) : null}

      {review.images.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pt-1">
          {review.images.map((url) => (
            <li key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element -- user upload from variable CDN host */}
              <img
                src={url}
                alt={t('photoAlt')}
                loading="lazy"
                className="h-20 w-20 rounded-md object-cover"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {isOwn && subjectType ? (
        <ReviewForm
          open={editOpen}
          onOpenChange={setEditOpen}
          subjectType={subjectType}
          subjectId={subjectId}
          review={review}
          onSaved={() => onChanged?.()}
        />
      ) : null}

      {isOwn ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('actions.deleteTitle')}</DialogTitle>
              <DialogDescription>{t('actions.deleteConfirm')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                {t('actions.cancel')}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting ? (
                  <Spinner size="sm" className="text-destructive-foreground" />
                ) : (
                  t('actions.delete')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </article>
  )
}
