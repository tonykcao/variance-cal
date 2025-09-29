/**
 * Booking validation schemas
 */

import { z } from "zod"

/**
 * Schema for creating a booking
 */
export const createBookingSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  startLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Start time must be in format YYYY-MM-DDTHH:mm"),
  endLocal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "End time must be in format YYYY-MM-DDTHH:mm"),
  attendees: z.array(z.string()).max(3, "Maximum 3 attendees allowed").optional(),
  notes: z.string().max(1000, "Notes must be less than 1000 characters").optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

/**
 * Schema for availability query
 */
export const availabilityQuerySchema = z.object({
  sites: z.array(z.string()).optional(),
  capacityMin: z.number().min(1).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  windowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  windowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
})

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>

/**
 * Schema for calendar date validation
 */
export const calendarDateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in format YYYY-MM-DD")
    .refine(date => {
      const selectedDate = new Date(date + "T00:00:00Z")
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return selectedDate >= today
    }, "Cannot select dates in the past"),
  timezone: z.string().optional(),
  roomId: z.string().optional(),
})

export type CalendarDateInput = z.infer<typeof calendarDateSchema>

/**
 * Schema for calendar query parameters
 */
export const calendarQuerySchema = z.object({
  sites: z.array(z.string()).optional(),
  capacityMin: z.number().min(1).optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export type CalendarQuery = z.infer<typeof calendarQuerySchema>
