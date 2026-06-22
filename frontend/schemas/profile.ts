import { z } from 'zod'

export const updateProfileSchema = z.object({
  name: z.string().max(255).optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{6,20}$/, 'Enter a valid phone number')
    .optional()
    .or(z.literal('')),
  avatarUrl: z.string().url('Enter a valid URL').optional().or(z.literal('')),
})

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
