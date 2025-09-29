/**
 * Handle conflicts when admin changes room opening hours with existing bookings
 */

import { prisma } from "@/lib/db"
import { formatInTimezone, localToUtc, utcToLocal } from "./time"
import { isWithinOpeningHours } from "./opening-hours"
import { addDays, startOfDay } from "date-fns"
import { fromZonedTime } from "date-fns-tz"

export interface BookingConflict {
  bookingId: string
  ownerId: string
  ownerName: string
  startUtc: Date
  endUtc: Date
  action: "cancel" | "truncate"
  newEndUtc?: Date // For truncate action
  reason: string
}

export interface OpeningHoursChangeResult {
  canProceed: boolean
  conflicts: BookingConflict[]
  warnings: string[]
}

/**
 * Analyze what would happen if room opening hours change
 */
export async function analyzeOpeningHoursChange(
  roomId: string,
  newOpening: any,
  timezone: string
): Promise<OpeningHoursChangeResult> {
  // Get all future bookings for this room
  const futureBookings = await prisma.booking.findMany({
    where: {
      roomId,
      startUtc: { gte: new Date() },
      canceledAt: null,
    },
    include: {
      owner: true,
      slots: true,
    },
    orderBy: { startUtc: "asc" },
  })

  const conflicts: BookingConflict[] = []
  const warnings: string[] = []

  for (const booking of futureBookings) {
    const startLocal = utcToLocal(booking.startUtc, timezone)
    const endLocal = utcToLocal(booking.endUtc, timezone)

    // Check if booking is within new opening hours
    if (!isWithinOpeningHours(booking.startUtc, booking.endUtc, newOpening, timezone)) {
      // Check if booking starts within new hours but extends beyond
      const dayOfBooking = startOfDay(startLocal)
      const endOfDayLocal = addDays(dayOfBooking, 1)

      // Test if just the start time is within hours
      const testEnd = new Date(booking.startUtc.getTime() + 30 * 60 * 1000) // 30 min after start
      const startsWithinHours = isWithinOpeningHours(
        booking.startUtc,
        testEnd,
        newOpening,
        timezone
      )

      if (startsWithinHours) {
        // Booking starts within hours but extends beyond - TRUNCATE
        const weekday = startLocal
          .toLocaleDateString("en", { weekday: "short" })
          .toLowerCase() as keyof typeof newOpening
        const closeTime = newOpening[weekday]?.close

        if (closeTime) {
          const [closeHour, closeMin] = closeTime.split(":").map(Number)
          const newEndLocal = new Date(startLocal)
          newEndLocal.setHours(closeHour, closeMin, 0, 0)
          const newEndUtc = fromZonedTime(newEndLocal, timezone)

          conflicts.push({
            bookingId: booking.id,
            ownerId: booking.ownerId,
            ownerName: booking.owner.name,
            startUtc: booking.startUtc,
            endUtc: booking.endUtc,
            action: "truncate",
            newEndUtc,
            reason: `Booking extends beyond new closing time (${closeTime}). Will be shortened to end at ${closeTime}.`,
          })
        }
      } else {
        // Booking is completely outside new hours - CANCEL
        conflicts.push({
          bookingId: booking.id,
          ownerId: booking.ownerId,
          ownerName: booking.owner.name,
          startUtc: booking.startUtc,
          endUtc: booking.endUtc,
          action: "cancel",
          reason: `Booking is completely outside new operating hours. Will be canceled.`,
        })
      }
    }
  }

  // Check for potential issues (warnings)
  if (conflicts.some(c => c.action === "cancel")) {
    warnings.push("Some bookings will be completely canceled.")
  }
  if (conflicts.some(c => c.action === "truncate")) {
    warnings.push("Some bookings will be shortened to fit new hours.")
  }
  if (conflicts.length > 5) {
    warnings.push(
      `${conflicts.length} bookings will be affected. Consider notifying users in advance.`
    )
  }

  return {
    canProceed: true, // We allow the change but with consequences
    conflicts,
    warnings,
  }
}

/**
 * Apply the opening hours changes and handle booking conflicts
 */
export async function applyOpeningHoursChange(
  roomId: string,
  conflicts: BookingConflict[],
  actorId: string
): Promise<void> {
  for (const conflict of conflicts) {
    if (conflict.action === "cancel") {
      // Cancel the entire booking
      await prisma.$transaction(async tx => {
        // Mark booking as canceled
        await tx.booking.update({
          where: { id: conflict.bookingId },
          data: { canceledAt: new Date() },
        })

        // Remove future slots
        await tx.bookingSlot.deleteMany({
          where: {
            bookingId: conflict.bookingId,
            slotStartUtc: { gte: new Date() },
          },
        })

        // Log activity
        await tx.activityLog.create({
          data: {
            actorId,
            action: "BOOKING_CANCELED",
            entityType: "booking",
            entityId: conflict.bookingId,
            metadata: {
              reason: "Room hours changed by admin",
              originalStart: conflict.startUtc.toISOString(),
              originalEnd: conflict.endUtc.toISOString(),
              canceledBy: "system",
            },
          },
        })
      })
    } else if (conflict.action === "truncate" && conflict.newEndUtc) {
      // Truncate the booking
      await prisma.$transaction(async tx => {
        // Update booking end time
        await tx.booking.update({
          where: { id: conflict.bookingId },
          data: { endUtc: conflict.newEndUtc },
        })

        // Remove slots that are now beyond the new end time
        await tx.bookingSlot.deleteMany({
          where: {
            bookingId: conflict.bookingId,
            slotStartUtc: { gte: conflict.newEndUtc },
          },
        })

        // Log activity
        await tx.activityLog.create({
          data: {
            actorId,
            action: "BOOKING_UPDATED",
            entityType: "booking",
            entityId: conflict.bookingId,
            metadata: {
              reason: "Room hours changed by admin - booking truncated",
              originalEnd: conflict.endUtc.toISOString(),
              newEnd: conflict.newEndUtc.toISOString(),
              modifiedBy: "system",
            },
          },
        })
      })
    }
  }
}
