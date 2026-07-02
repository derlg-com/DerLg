'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { StarRatingInput } from './StarRatingInput'
import { useZodForm } from '@/lib/use-zod-form'
import { useTranslations } from '@/lib/i18n'
import { useAuthStore } from '@/stores/auth.store'
import {
  reviewFormSchema,
  type ReviewFormValues,
  REVIEW_TEXT_MAX,
  REVIEW_MAX_PHOTOS,
} from '@/schemas/review'
import { createReview, updateReview, type CreateReviewPayload } from '@/lib/reviews-api'
import {
  validateImageFile,
  uploadReviewPhoto,
  ACCEPT_ATTR,
  type ImageValidationError,
} from '@/lib/image-upload'
import { invalidateApiQuery } from '@/lib/use-api-query'
import type { Review, ReviewSubjectType } from '@/types/domain'

export interface ReviewFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Subject the review is about. */
  subjectType: ReviewSubjectType
  /** Subject id (trip/hotel/guide), when known. */
  subjectId?: string
  /** Originating completed booking (required to create; carried through on edit). */
  bookingId?: string
  /** When provided, the form edits this review instead of creating a new one. */
  review?: Review
  /** Called after a successful create/edit so callers can refresh their list. */
  onSaved?: (review: Review) => void
}

function emptyValues(review?: Review): ReviewFormValues {
  return {
    rating: review?.rating ?? 0,
    text: review?.text ?? '',
    images: review?.images ?? [],
  }
}

/**
 * Reusable review submission / edit dialog (Tasks 20.3, 20.4 — Requirements
 * 21.3, 21.4, 21.5, 21.9). Provides a 1–5 star selector, a text area with a
 * live character count (10–1000), and up to five photo uploads, all validated
 * against {@link reviewFormSchema} via {@link useZodForm}.
 *
 * In *create* mode a `bookingId` (proof of a completed booking) is required; in
 * *edit* mode an existing `review` is supplied and the call targets
 * `PATCH /v1/reviews/:id`. The backend reviews module does not exist yet, so a
 * failed submit degrades gracefully to an inline toast (see `lib/reviews-api`).
 */
export function ReviewForm({
  open,
  onOpenChange,
  subjectType,
  subjectId,
  bookingId,
  review,
  onSaved,
}: ReviewFormProps) {
  const t = useTranslations('reviews')
  const token = useAuthStore((s) => s.accessToken)
  const isEdit = Boolean(review)

  const { values, errors, setValue, validate, setError, clearErrors } =
    useZodForm<ReviewFormValues>(reviewFormSchema, emptyValues(review))
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    clearErrors()
    setValue('rating', review?.rating ?? 0)
    setValue('text', review?.text ?? '')
    setValue('images', review?.images ?? [])
    setSubmitting(false)
    setUploading(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function errorText(key: string | undefined): string | undefined {
    if (!key) return undefined
    // Schema messages are i18n keys under reviews.form.errors.*
    return t(`form.errors.${key}`)
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    clearErrors()
    const remaining = REVIEW_MAX_PHOTOS - values.images.length
    if (remaining <= 0) {
      setError('images', t('form.errors.tooManyPhotos'))
      return
    }
    const picked = Array.from(files).slice(0, remaining)
    setUploading(true)
    const uploaded: string[] = []
    for (const file of picked) {
      const check = validateImageFile(file)
      if (!check.ok) {
        const err = check.error as ImageValidationError
        toast({ title: t(`form.upload.${err}`), variant: 'error' })
        continue
      }
      try {
        const url = await uploadReviewPhoto(file, { token })
        uploaded.push(url)
      } catch {
        // Backend endpoint may not exist yet — degrade gracefully.
        toast({ title: t('form.upload.failed'), variant: 'error' })
      }
    }
    if (uploaded.length > 0) {
      setValue('images', [...values.images, ...uploaded].slice(0, REVIEW_MAX_PHOTOS))
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removePhoto(url: string) {
    setValue(
      'images',
      values.images.filter((u) => u !== url),
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const data = validate()
    if (!data) return

    setSubmitting(true)
    try {
      let saved: Review
      if (isEdit && review) {
        saved = await updateReview(review.id, {
          rating: data.rating,
          text: data.text,
          images: data.images,
        })
      } else {
        if (!bookingId) {
          // Create requires a completed booking reference.
          setSubmitting(false)
          toast({ title: t('form.errors.noBooking'), variant: 'error' })
          return
        }
        const payload: CreateReviewPayload = {
          type: subjectType,
          subjectId,
          bookingId,
          rating: data.rating,
          text: data.text,
          images: data.images,
        }
        saved = await createReview(payload, bookingId)
      }
      toast({ title: isEdit ? t('form.editSuccess') : t('form.success'), variant: 'success' })
      // Refresh any review lists for this subject.
      invalidateApiQuery('/v1/reviews')
      onSaved?.(saved)
      handleOpenChange(false)
    } catch {
      setSubmitting(false)
      // Backend reviews module may be missing — surface inline, don't crash.
      toast({ title: t('form.error'), variant: 'error' })
    }
  }

  const remaining = REVIEW_TEXT_MAX - values.text.length
  const atPhotoLimit = values.images.length >= REVIEW_MAX_PHOTOS

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('form.editTitle') : t('form.title')}</DialogTitle>
          <DialogDescription>{t('form.subtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-foreground">
              {t('form.ratingLabel')}
            </span>
            <StarRatingInput
              value={values.rating}
              onChange={(n) => setValue('rating', n)}
              label={t('form.ratingLabel')}
              starLabel={(n) => t('filter.stars', { n })}
              disabled={submitting}
            />
            {errors.rating ? (
              <p className="text-sm text-destructive">{errorText(errors.rating)}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="review-text" className="block text-sm font-medium text-foreground">
              {t('form.textLabel')}
            </label>
            <Textarea
              id="review-text"
              rows={5}
              maxLength={REVIEW_TEXT_MAX}
              value={values.text}
              onChange={(e) => setValue('text', e.target.value)}
              placeholder={t('form.textPlaceholder')}
              aria-invalid={Boolean(errors.text)}
              aria-describedby="review-text-count"
              disabled={submitting}
            />
            <div className="flex items-center justify-between">
              {errors.text ? (
                <p className="text-sm text-destructive">{errorText(errors.text)}</p>
              ) : (
                <span />
              )}
              <span id="review-text-count" className="text-xs tabular-nums text-muted-foreground">
                {t('form.charCount', { remaining })}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-foreground">
              {t('form.photosLabel', { max: REVIEW_MAX_PHOTOS })}
            </span>
            {values.images.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {values.images.map((url) => (
                  <li key={url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user upload from variable CDN host */}
                    <img
                      src={url}
                      alt={t('form.photoAlt')}
                      className="h-16 w-16 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(url)}
                      aria-label={t('form.removePhoto')}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground/80 p-0.5 text-background"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="sr-only"
              onChange={(e) => onPickFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting || uploading || atPhotoLimit}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              {atPhotoLimit ? t('form.photoLimitReached') : t('form.addPhotos')}
            </Button>
            {errors.images ? (
              <p className="text-sm text-destructive">{errorText(errors.images)}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('form.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || uploading}>
              {submitting ? (
                <Spinner size="sm" className="text-primary-foreground" />
              ) : isEdit ? (
                t('form.saveEdit')
              ) : (
                t('form.submit')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
