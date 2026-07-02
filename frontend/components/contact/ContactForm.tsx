'use client'

import { useRef, useState } from 'react'
import { Paperclip, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { useZodForm } from '@/lib/use-zod-form'
import { useTranslations } from '@/lib/i18n'
import {
  contactFormSchema,
  validateContactAttachment,
  CONTACT_ACCEPT_ATTR,
  CONTACT_ATTACHMENT_MAX_BYTES,
  CONTACT_MESSAGE_MAX,
  type ContactFormValues,
} from '@/schemas/contact'
import { submitContactMessage } from '@/lib/contact-api'

/**
 * Contact / support message form (Tasks 29.1 + 29.2 — Section 29).
 *
 * Fields: name, email, subject, message, plus an optional single attachment
 * (≤ 5 MB, validated for type/size). Submits to the assumed `POST /v1/contact`
 * endpoint (see `lib/contact-api.ts`). On success it shows a toast and resets;
 * on failure it degrades gracefully — mapping any field errors and showing a
 * localized toast — and never crashes when the backend endpoint is missing.
 */
export function ContactForm() {
  const t = useTranslations('contact')
  const { values, errors, setValue, setError, validate, clearErrors } =
    useZodForm<ContactFormValues>(contactFormSchema, {
      name: '',
      email: '',
      subject: '',
      message: '',
    })
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function errorText(key: string | undefined): string | undefined {
    if (!key) return undefined
    return t(`form.errors.${key}`)
  }

  function onPickFile(files: FileList | null) {
    setAttachmentError(null)
    const file = files?.[0]
    if (!file) return
    const check = validateContactAttachment(file)
    if (!check.ok) {
      setAttachment(null)
      setAttachmentError(t(`form.attachment.${check.error}`))
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setAttachment(file)
  }

  function removeAttachment() {
    setAttachment(null)
    setAttachmentError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearErrors()
    const data = validate()
    if (!data) return

    setSubmitting(true)
    const result = await submitContactMessage({ ...data, attachment })
    setSubmitting(false)

    if (result.ok) {
      toast({ title: t('form.success'), description: t('form.successDesc'), variant: 'success' })
      setValue('subject', '')
      setValue('message', '')
      removeAttachment()
      return
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        if (message) setError(field as keyof ContactFormValues, message)
      }
    }
    toast({ title: t('form.error'), variant: 'error' })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="contact-name">{t('form.name')}</Label>
        <Input
          id="contact-name"
          autoComplete="name"
          value={values.name}
          onChange={(e) => setValue('name', e.target.value)}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'contact-name-error' : undefined}
        />
        {errors.name ? (
          <p id="contact-name-error" className="text-sm text-destructive">
            {errorText(errors.name)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-email">{t('form.email')}</Label>
        <Input
          id="contact-email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValue('email', e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'contact-email-error' : undefined}
        />
        {errors.email ? (
          <p id="contact-email-error" className="text-sm text-destructive">
            {errorText(errors.email)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-subject">{t('form.subject')}</Label>
        <Input
          id="contact-subject"
          value={values.subject}
          onChange={(e) => setValue('subject', e.target.value)}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
        />
        {errors.subject ? (
          <p id="contact-subject-error" className="text-sm text-destructive">
            {errorText(errors.subject)}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-message">{t('form.message')}</Label>
        <Textarea
          id="contact-message"
          rows={6}
          maxLength={CONTACT_MESSAGE_MAX}
          value={values.message}
          onChange={(e) => setValue('message', e.target.value)}
          placeholder={t('form.messagePlaceholder')}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
        />
        {errors.message ? (
          <p id="contact-message-error" className="text-sm text-destructive">
            {errorText(errors.message)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">
          {t('form.attachmentLabel', { mb: CONTACT_ATTACHMENT_MAX_BYTES / (1024 * 1024) })}
        </span>
        <input
          ref={fileRef}
          type="file"
          accept={CONTACT_ACCEPT_ATTR}
          className="sr-only"
          onChange={(e) => onPickFile(e.target.files)}
        />
        {attachment ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="truncate text-foreground">{attachment.name}</span>
            <button
              type="button"
              onClick={removeAttachment}
              aria-label={t('form.removeAttachment')}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="mr-1.5 h-4 w-4" aria-hidden />
            {t('form.addAttachment')}
          </Button>
        )}
        {attachmentError ? <p className="text-sm text-destructive">{attachmentError}</p> : null}
      </div>

      <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
        {submitting ? <Spinner size="sm" className="text-primary-foreground" /> : t('form.submit')}
      </Button>
    </form>
  )
}
