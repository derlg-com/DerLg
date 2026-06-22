import { z } from 'zod'

const optionalNotes = z.string().max(1000).optional().or(z.literal(''))

export const tripBookingSchema = z.object({
  startDate: z.string().min(1),
  adults: z.number().int().min(1).max(50),
  children: z.number().int().min(0).max(50),
  specialRequests: optionalNotes,
})

export const hotelBookingSchema = z
  .object({
    checkInDate: z.string().min(1),
    checkOutDate: z.string().min(1),
    guestsAdults: z.number().int().min(1).max(20),
    guestsChildren: z.number().int().min(0).max(20),
    specialRequests: optionalNotes,
  })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    path: ['checkOutDate'],
    message: 'Check-out must be after check-in',
  })

export const guideBookingSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    specialRequests: optionalNotes,
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after start date',
  })

export const transportBookingSchema = z
  .object({
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    pickupLocation: z.string().min(1).max(500),
    dropoffLocation: z.string().min(1).max(500),
    specialRequests: optionalNotes,
  })
  .refine((d) => d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after start date',
  })

export type TripBookingValues = z.infer<typeof tripBookingSchema>
export type HotelBookingValues = z.infer<typeof hotelBookingSchema>
export type GuideBookingValues = z.infer<typeof guideBookingSchema>
export type TransportBookingValues = z.infer<typeof transportBookingSchema>
