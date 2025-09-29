/**
 * Data access layer for bookings
 */

import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"

/**
 * Get booked slots for rooms in a date range
 * @param roomIds - Array of room IDs
 * @param startDate - Start date (UTC)
 * @param endDate - End date (UTC)
 * @param currentUserId - Optional current user ID to mark own bookings
 * @returns Map of room ID to map of slot times to booking info
 */
export async function getBookedSlots(
  roomIds: string[],
  startDate: Date,
  endDate: Date,
  currentUserId?: string
): Promise<Map<string, Map<string, { isOwnBooking?: boolean; isAttending?: boolean }>>> {
  const slots = await prisma.bookingSlot.findMany({
    where: {
      roomId: { in: roomIds },
      slotStartUtc: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      roomId: true,
      slotStartUtc: true,
      booking: {
        select: {
          ownerId: true,
          attendees: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  })

  // Group by room ID
  const bookedByRoom = new Map<
    string,
    Map<string, { isOwnBooking?: boolean; isAttending?: boolean }>
  >()

  for (const roomId of roomIds) {
    bookedByRoom.set(roomId, new Map())
  }

  for (const slot of slots) {
    const roomSlots = bookedByRoom.get(slot.roomId)
    if (roomSlots) {
      const slotKey = slot.slotStartUtc.toISOString()
      const isOwnBooking = currentUserId ? slot.booking.ownerId === currentUserId : false
      const isAttending = currentUserId
        ? slot.booking.attendees.some(a => a.userId === currentUserId)
        : false
      roomSlots.set(slotKey, { isOwnBooking, isAttending })
    }
  }

  return bookedByRoom
}

/**
 * Get bookings for a user
 * @param userId - User ID
 * @param scope - 'upcoming' or 'past'
 */
export async function getUserBookings(userId: string, scope: "upcoming" | "past" = "upcoming") {
  const now = new Date()

  const where: Prisma.BookingWhereInput = {
    OR: [{ ownerId: userId }, { attendees: { some: { userId } } }],
    // Include cancelled bookings so users can see their booking history
    // canceledAt can be null or have a value
  }

  if (scope === "upcoming") {
    // For upcoming, show all bookings that haven't ended yet (including cancelled)
    where.endUtc = { gt: now }
  } else {
    // For past, show all bookings that have ended (including cancelled)
    where.endUtc = { lte: now }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      room: {
        include: {
          site: true,
        },
      },
      owner: true,
      attendees: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      startUtc: scope === "upcoming" ? "asc" : "desc",
    },
  })

  return bookings
}

/**
 * Get a single booking by ID
 * @param bookingId - Booking ID
 */
export async function getBookingById(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: {
        include: {
          site: true,
        },
      },
      owner: true,
      attendees: {
        include: {
          user: true,
        },
      },
      slots: true,
    },
  })

  return booking
}

/**
 * Create a new booking with slots
 * @param data - Booking data
 * @returns Created booking or error
 */
export async function createBooking(data: {
  roomId: string
  ownerId: string
  startUtc: Date
  endUtc: Date
  slots: Date[]
  attendeeIds?: string[]
  notes?: string
}) {
  const MAX_RETRIES = 3
  let lastError: any

  // Retry logic for handling deadlocks
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const booking = await prisma.$transaction(async tx => {
        // Create the booking
        const newBooking = await tx.booking.create({
          data: {
            roomId: data.roomId,
            ownerId: data.ownerId,
            startUtc: data.startUtc,
            endUtc: data.endUtc,
            notes: data.notes,
          },
        })

        // Create booking slots (unique constraint will prevent double booking)
        await tx.bookingSlot.createMany({
          data: data.slots.map(slotStart => ({
            bookingId: newBooking.id,
            roomId: data.roomId,
            slotStartUtc: slotStart,
          })),
        })

        // Add attendees if provided
        if (data.attendeeIds && data.attendeeIds.length > 0) {
          await tx.bookingAttendee.createMany({
            data: data.attendeeIds.map(userId => ({
              bookingId: newBooking.id,
              userId,
            })),
          })
        }

        // Log activity
        await tx.activityLog.create({
          data: {
            actorId: data.ownerId,
            action: "BOOKING_CREATED",
            entityType: "booking",
            entityId: newBooking.id,
            metadata: {
              roomId: data.roomId,
              startUtc: data.startUtc.toISOString(),
              endUtc: data.endUtc.toISOString(),
              attendeeIds: data.attendeeIds || [],
            },
        },
      })

        // Return the complete booking
        return await tx.booking.findUnique({
          where: { id: newBooking.id },
          include: {
            room: {
              include: {
                site: true,
              },
            },
            owner: true,
            attendees: {
              include: {
                user: true,
              },
            },
          },
        })
      })

      return { success: true, booking }
    } catch (error) {
      lastError = error

      // Check if it's a unique constraint violation (double booking)
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return {
            success: false,
            error: "Room is already booked for one or more of the selected time slots",
          }
        }
        // Check if it's a deadlock error - retry if we have attempts left
        if (error.code === "P2034" && attempt < MAX_RETRIES) {
          // Add exponential backoff delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)))
          continue
        }
      }
      // For non-retryable errors or last attempt, throw immediately
      if (attempt === MAX_RETRIES) {
        throw error
      }
    }
  }

  // If we exhausted all retries, throw the last error
  throw lastError
}

/**
 * Cancel a booking
 * @param bookingId - Booking ID
 * @param userId - User ID performing the cancellation
 */
export async function cancelBooking(bookingId: string, userId: string) {
  const now = new Date()

  try {
    const result = await prisma.$transaction(async tx => {
      // Get the booking
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          owner: true,
        },
      })

      if (!booking) {
        return { success: false, error: "Booking not found" }
      }

      // Check if already canceled
      if (booking.canceledAt) {
        return { success: false, error: "Booking is already canceled" }
      }

      // Update booking with canceledAt
      await tx.booking.update({
        where: { id: bookingId },
        data: { canceledAt: now },
      })

      // Delete future slots to free them up
      await tx.bookingSlot.deleteMany({
        where: {
          bookingId,
          slotStartUtc: { gte: now },
        },
      })

      // Log activity
      await tx.activityLog.create({
        data: {
          actorId: userId,
          action: "BOOKING_CANCELED",
          entityType: "booking",
          entityId: bookingId,
          metadata: {
            canceledAt: now.toISOString(),
            futureSlots: "freed",
          },
        },
      })

      return { success: true }
    })

    return result
  } catch (error) {
    throw error
  }
}

/**
 * Get all bookings (admin)
 * @param filters - Optional filters
 */
export async function getAllBookings(filters?: {
  siteId?: string
  roomId?: string
  userId?: string
  from?: Date
  to?: Date
}) {
  const where: Prisma.BookingWhereInput = {}

  if (filters?.roomId) {
    where.roomId = filters.roomId
  } else if (filters?.siteId) {
    where.room = {
      siteId: filters.siteId,
    }
  }

  if (filters?.userId) {
    where.OR = [{ ownerId: filters.userId }, { attendees: { some: { userId: filters.userId } } }]
  }

  if (filters?.from || filters?.to) {
    where.startUtc = {}
    if (filters.from) {
      where.startUtc.gte = filters.from
    }
    if (filters.to) {
      where.startUtc.lte = filters.to
    }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      room: {
        include: {
          site: true,
        },
      },
      owner: true,
      attendees: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      startUtc: "desc",
    },
  })

  return bookings
}

/**
 * Check if a user can modify a booking
 * @param bookingId - Booking ID
 * @param userId - User ID
 * @param userRole - User role
 */
export async function canUserModifyBooking(
  bookingId: string,
  userId: string,
  userRole: "USER" | "ADMIN"
): Promise<boolean> {
  // Admins can modify any booking
  if (userRole === "ADMIN") {
    return true
  }

  // Check if user is the owner
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { ownerId: true },
  })

  return booking?.ownerId === userId
}
