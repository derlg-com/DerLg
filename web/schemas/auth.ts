import { z } from 'zod'

/**
 * Auth form schemas.
 *
 * Password minimum is 8 characters to match the backend DTO exactly — a looser
 * client rule would let the user submit something the server then rejects.
 */

export const loginSchema = z.object({
  email: z.string().min(1).email(),
  password: z.string().min(1),
})
export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    email: z.string().min(1).email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
    name: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    // Attach to the field the user must change, not to the form root.
    path: ['confirmPassword'],
    message: 'mismatch',
  })
export type RegisterFormValues = z.infer<typeof registerSchema>

/** Rough strength signal for the meter; not a security control. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) return 0
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score += 1
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4
}
