/**
 * Validation schemas for Room operations
 */

import { z } from "zod"

// Opening hours schema - must have all 7 days
const openingHoursSchema = z
  .object({
    mon: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
    tue: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
    wed: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
    thu: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
    fri: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
    sat: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
    sun: z.object({
      open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
      close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
    }),
  })
  .refine(
    data => {
      // Validate that open time is before close time for each day
      const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
      return days.every(day => {
        const open = data[day].open
        const close = data[day].close
        const openMinutes = parseInt(open.split(":")[0]) * 60 + parseInt(open.split(":")[1])
        const closeMinutes = parseInt(close.split(":")[0]) * 60 + parseInt(close.split(":")[1])
        return openMinutes < closeMinutes
      })
    },
    { message: "Opening time must be before closing time for all days" }
  )

export const createRoomSchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
  name: z.string().min(1, "Room name is required").max(100, "Room name too long"),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(100, "Capacity too large"),
  opening: openingHoursSchema,
})

export const updateRoomSchema = z.object({
  id: z.string().min(1, "Room ID is required"),
  name: z.string().min(1, "Room name is required").max(100, "Room name too long").optional(),
  capacity: z
    .number()
    .int()
    .min(1, "Capacity must be at least 1")
    .max(100, "Capacity too large")
    .optional(),
  opening: openingHoursSchema.optional(),
})

export type CreateRoomInput = z.infer<typeof createRoomSchema>
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>
