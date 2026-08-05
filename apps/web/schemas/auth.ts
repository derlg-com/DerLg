import { z } from 'zod';

/** Mirrors the API's RegisterDto so the browser rejects what the server would. */
export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'validation.nameTooShort')
    .max(120, 'validation.nameTooLong'),
  email: z.string().trim().toLowerCase().email('validation.emailInvalid').max(254),
  password: z
    .string()
    .min(8, 'validation.passwordTooShort')
    .max(128, 'validation.passwordTooLong')
    .regex(/[a-z]/, 'validation.passwordNeedsLower')
    .regex(/[A-Z]/, 'validation.passwordNeedsUpper')
    .regex(/\d/, 'validation.passwordNeedsNumber'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('validation.emailInvalid').max(254),
  password: z.string().min(1, 'validation.passwordRequired').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Rough strength signal for the password meter (0-4). */
export function passwordStrength(password: string): number {
  if (!password) {
    return 0;
  }
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}
