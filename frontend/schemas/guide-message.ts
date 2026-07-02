import { z } from 'zod'

/**
 * Guide pre-booking message form schema (Section 24.3 — Requirement 38.7).
 * Pure and DOM-free so it is directly unit-testable. Error messages are i18n
 * *keys* (resolved under `guides.message.errors.*` by the form via `t()`),
 * matching the lightweight controlled-form convention used across the app.
 */

export const GUIDE_MESSAGE_SUBJECT_MAX = 120
export const GUIDE_MESSAGE_BODY_MIN = 10
export const GUIDE_MESSAGE_BODY_MAX = 1000

export const guideMessageSchema = z.object({
  subject: z.string().trim().min(1, 'subjectRequired').max(GUIDE_MESSAGE_SUBJECT_MAX, 'subjectMax'),
  message: z
    .string()
    .trim()
    .min(GUIDE_MESSAGE_BODY_MIN, 'messageMin')
    .max(GUIDE_MESSAGE_BODY_MAX, 'messageMax'),
})

export type GuideMessageValues = z.infer<typeof guideMessageSchema>
