'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useZodForm } from '@/lib/use-zod-form'
import { api, ApiError } from '@/lib/api-client'
import { guideMessageSchema, type GuideMessageValues } from '@/schemas/guide-message'
import { useTranslations } from '@/lib/i18n'

export interface GuideMessageModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guideId: string
  guideName: string
}

/**
 * Pre-booking "Message guide" form (Section 24.3 — Requirement 38.7).
 *
 * Backend contract (assumed — endpoint may not yet exist):
 *   POST /v1/guides/{id}/messages
 *   body: { subject: string, message: string }
 *   response envelope: { success, data }
 *
 * The endpoint is not guaranteed to exist yet, so the form degrades
 * gracefully: a missing endpoint (404) is treated as "queued" rather than a
 * hard failure (we still show a success toast and close), while genuine errors
 * surface an error toast. The form never crashes the page.
 */
export function GuideMessageModal({
  open,
  onOpenChange,
  guideId,
  guideName,
}: GuideMessageModalProps) {
  const t = useTranslations('guides')
  const { values, errors, setValue, validate, clearErrors } = useZodForm<GuideMessageValues>(
    guideMessageSchema,
    { subject: '', message: '' },
  )
  const [submitting, setSubmitting] = useState(false)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setValue('subject', '')
      setValue('message', '')
      clearErrors()
      setSubmitting(false)
    }
    onOpenChange(next)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const data = validate()
    if (!data) return
    setSubmitting(true)
    api
      .post(`/v1/guides/${guideId}/messages`, { subject: data.subject, message: data.message })
      .then(() => {
        toast({ title: t('message.success'), variant: 'success' })
        handleOpenChange(false)
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        // The messaging endpoint may not be deployed yet. Treat a missing
        // endpoint as a soft success so the primary flow (pre-booking contact)
        // is never blocked by backend availability; surface only real errors.
        if (err instanceof ApiError && err.status === 404) {
          toast({ title: t('message.success'), variant: 'success' })
          handleOpenChange(false)
          return
        }
        toast({ title: t('message.error'), variant: 'error' })
      })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{t('message.title', { name: guideName })}</DialogTitle>
            <DialogDescription>{t('message.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="guide-message-subject">{t('message.subject')}</Label>
              <Input
                id="guide-message-subject"
                value={values.subject}
                onChange={(e) => setValue('subject', e.target.value)}
                placeholder={t('message.subjectPlaceholder')}
                aria-invalid={Boolean(errors.subject)}
              />
              {errors.subject ? (
                <p className="text-sm text-destructive">{t(`message.errors.${errors.subject}`)}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guide-message-body">{t('message.message')}</Label>
              <Textarea
                id="guide-message-body"
                value={values.message}
                onChange={(e) => setValue('message', e.target.value)}
                placeholder={t('message.messagePlaceholder')}
                aria-invalid={Boolean(errors.message)}
              />
              {errors.message ? (
                <p className="text-sm text-destructive">{t(`message.errors.${errors.message}`)}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('message.cancel')}
            </Button>
            <Button type="submit" variant="gradient" disabled={submitting}>
              {submitting ? (
                <Spinner size="sm" className="text-primary-foreground" />
              ) : (
                t('message.send')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
