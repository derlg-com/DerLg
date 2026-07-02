import { z } from 'zod'

/**
 * Admin support-message reply schema (Section 31.4 — Requirement 45.5).
 * DOM-free and unit-testable. Error messages are i18n *keys* resolved under
 * `admin.support.errors.*` by the form, matching the app's controlled-form
 * convention.
 */

export const ADMIN_REPLY_MIN = 2
export const ADMIN_REPLY_MAX = 2000

export const adminReplySchema = z.object({
  reply: z.string().trim().min(ADMIN_REPLY_MIN, 'replyRequired').max(ADMIN_REPLY_MAX, 'replyMax'),
})

export type AdminReplyValues = z.infer<typeof adminReplySchema>
