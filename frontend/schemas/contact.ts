import { z } from 'zod'

/**
 * Contact / support message form schema (Task 29.1 — Section 29 Contact & Support).
 *
 * Validation messages are i18n keys (resolved under `contact.form.errors.*` in
 * the UI), mirroring the project convention used by `schemas/review.ts`.
 */

/** Max attachment size: 5 MB (Task 29.1). */
export const CONTACT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024

/** Allowed attachment MIME types (images, PDF, plain text). */
export const CONTACT_ALLOWED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
] as const

/** `accept` attribute for the attachment file picker. */
export const CONTACT_ACCEPT_ATTR = CONTACT_ALLOWED_ATTACHMENT_TYPES.join(',')

export const CONTACT_SUBJECT_MAX = 150
export const CONTACT_MESSAGE_MIN = 10
export const CONTACT_MESSAGE_MAX = 2000

export const contactFormSchema = z.object({
  name: z.string().trim().min(1, 'nameRequired').max(100, 'nameTooLong'),
  email: z.string().trim().min(1, 'emailRequired').email('emailInvalid'),
  subject: z.string().trim().min(1, 'subjectRequired').max(CONTACT_SUBJECT_MAX, 'subjectTooLong'),
  message: z
    .string()
    .trim()
    .min(CONTACT_MESSAGE_MIN, 'messageTooShort')
    .max(CONTACT_MESSAGE_MAX, 'messageTooLong'),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>

/** Reason an attachment was rejected; maps 1:1 to an i18n key. */
export type ContactAttachmentError = 'type' | 'size' | 'empty'

export interface ContactAttachmentValidation {
  ok: boolean
  error?: ContactAttachmentError
}

/**
 * Validate a single contact attachment against the allowed type set and the
 * 5 MB size limit (Task 29.1). Pure and DOM-free so it is unit-testable.
 */
export function validateContactAttachment(file: File): ContactAttachmentValidation {
  if (!file || file.size === 0) return { ok: false, error: 'empty' }
  if (!(CONTACT_ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'type' }
  }
  if (file.size > CONTACT_ATTACHMENT_MAX_BYTES) return { ok: false, error: 'size' }
  return { ok: true }
}
