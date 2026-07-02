import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(255, 'Name must be 255 characters or fewer')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{6,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  avatarUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
