/**
 * Customer support contact details (Requirement 39.7).
 *
 * Data source: there is no support contact stored in the booking payload or a
 * shared constants module, so these values are sourced from environment
 * variables (`NEXT_PUBLIC_SUPPORT_*`) with safe generic defaults. The defaults
 * are clearly-labeled placeholders (not invented personal data) so the
 * confirmation screen always has a usable support email/phone in dev, while
 * production can override them via env without a code change.
 *
 * Only the contact *values* live here — all user-facing labels and instruction
 * copy are routed through i18n (see `messages/*.json` `checkout.support.*`).
 */

/** Support email address. Override with NEXT_PUBLIC_SUPPORT_EMAIL. */
export const SUPPORT_EMAIL: string = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@derlg.com'

/**
 * Support phone number in international format (digits, spaces and a leading
 * `+` only). Override with NEXT_PUBLIC_SUPPORT_PHONE.
 */
export const SUPPORT_PHONE: string = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? '+855 23 900 100'

/** Build a `mailto:` href for the support email. */
export function supportMailto(email: string = SUPPORT_EMAIL): string {
  return `mailto:${email}`
}

/**
 * Build a `tel:` href from a display phone number. Strips spaces and any other
 * characters that are not digits or a leading `+`, per the RFC 3966 grammar.
 */
export function supportTel(phone: string = SUPPORT_PHONE): string {
  const normalized = phone.replace(/[^\d+]/g, '')
  return `tel:${normalized}`
}

/**
 * Business hours and FAQ topic identifiers for the Contact & Support page
 * (Task 29.3). Only stable identifiers live here — every user-facing label,
 * day name, hour string and Q&A copy is routed through i18n
 * (`contact.support.*` / `contact.faq.*`), so this list stays language-neutral.
 */

/** Ordered i18n key suffixes for the business-hours rows. */
export const SUPPORT_HOURS_KEYS = ['weekdays', 'weekends', 'holidays'] as const
export type SupportHoursKey = (typeof SUPPORT_HOURS_KEYS)[number]

/** Ordered i18n key suffixes for the FAQ accordion entries. */
export const SUPPORT_FAQ_KEYS = [
  'booking',
  'payment',
  'cancellation',
  'refund',
  'languages',
  'emergency',
] as const
export type SupportFaqKey = (typeof SUPPORT_FAQ_KEYS)[number]
