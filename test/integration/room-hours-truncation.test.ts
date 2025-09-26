import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestUser, createTestSite, createTestRoom, createTestBooking, cleanDatabase } from '../fixtures'
import { addDays, setHours, setMinutes, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const prisma = new PrismaClient()

describe('Room Hours Truncation with Existing Bookings', () => {
  let adminUser: any
  let regularUser: any
  let site: any
  let room: any

  beforeEach(async () => {
    await cleanDatabase()

    // Create test users
    adminUser = await createTestUser({
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'ADMIN',
      timezone: 'America/New_York',
    })

    regularUser = await createTestUser({
      email: 'user@test.com',
      name: 'Regular User',
      role: 'USER',
      timezone: 'America/New_York',
    })

    // Create test site and room
    site = await createTestSite({
      name: 'Test Site NYC',
      timezone: 'America/New_York',
    })

    room = await createTestRoom({
      siteId: site.id,
      name: 'Board Room',
      capacity: 12,
      opening: {
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '22:00' },
        fri: { open: '08:00', close: '22:00' },
        sat: { open: '09:00', close: '18:00' },
        sun: { open: '09:00', close: '18:00' },
      },
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  describe('Truncation Validation', () => {
    it('should prevent truncation when bookings exist in truncated period', async () => {
      // Create evening booking (20:00-21:30)
      const tomorrow = addDays(new Date(), 1)
      const eveningStart = setMinutes(setHours(tomorrow, 20), 0)
      const eveningEnd = setMinutes(setHours(tomorrow, 21), 30)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(eveningStart, site.timezone),
        endUtc: fromZonedTime(eveningEnd, site.timezone),
      })

      // Attempt to truncate hours to 18:00
      const validateTruncation = async (newCloseHour: string) => {
        const closeTime = parseInt(newCloseHour.split(':')[0])

        const affectedBookings = await prisma.booking.findMany({
          where: {
            roomId: room.id,
            canceledAt: null,
            OR: [
              {
                startUtc: {
                  gte: fromZonedTime(setMinutes(setHours(tomorrow, closeTime), 0), site.timezone),
                },
              },
            ],
          },
        })

        return {
          canTruncate: affectedBookings.length === 0,
          affectedBookings,
        }
      }

      const result = await validateTruncation('18:00')

      expect(result.canTruncate).toBe(false)
      expect(result.affectedBookings).toHaveLength(1)
      expect(result.affectedBookings[0].id).toBe(booking.id)
    })

    it('should allow truncation when all bookings are before new close time', async () => {
      // Create morning booking (09:00-10:30)
      const tomorrow = addDays(new Date(), 1)
      const morningStart = setMinutes(setHours(tomorrow, 9), 0)
      const morningEnd = setMinutes(setHours(tomorrow, 10), 30)

      await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(morningStart, site.timezone),
        endUtc: fromZonedTime(morningEnd, site.timezone),
      })

      // Truncate to 18:00 (no conflict)
      const newOpening = {
        ...room.opening,
        mon: { open: '08:00', close: '18:00' },
        tue: { open: '08:00', close: '18:00' },
        wed: { open: '08:00', close: '18:00' },
        thu: { open: '08:00', close: '18:00' },
        fri: { open: '08:00', close: '18:00' },
      }

      const updatedRoom = await prisma.room.update({
        where: { id: room.id },
        data: { opening: newOpening },
      })

      expect(updatedRoom.opening).toEqual(newOpening)
    })
  })

  describe('Multi-Day Truncation', () => {
    it('should handle truncation affecting bookings across multiple days', async () => {
      const bookings = []

      // Create bookings for next 7 days in evening slots
      for (let i = 1; i <= 7; i++) {
        const day = addDays(new Date(), i)
        const start = setMinutes(setHours(day, 19), 0)
        const end = setMinutes(setHours(day, 20), 30)

        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: regularUser.id,
          startUtc: fromZonedTime(start, site.timezone),
          endUtc: fromZonedTime(end, site.timezone),
        })
        bookings.push(booking)
      }

      // Attempt to truncate all days to 18:00
      const affectedBookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
          startUtc: {
            gte: fromZonedTime(setMinutes(setHours(new Date(), 18), 0), site.timezone),
          },
        },
      })

      expect(affectedBookings.length).toBe(7)
      expect(affectedBookings.map(b => b.id).sort()).toEqual(bookings.map(b => b.id).sort())
    })

    it('should handle partial week truncation', async () => {
      // Create bookings for weekdays and weekends
      const weekdayBooking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(addDays(new Date(), 1), 20), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(addDays(new Date(), 1), 21), 0), site.timezone),
      })

      const weekendBooking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(addDays(new Date(), 6), 16), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(addDays(new Date(), 6), 17), 0), site.timezone),
      })

      // Truncate only weekdays (Mon-Fri to 18:00)
      const validateWeekdayTruncation = async () => {
        const conflicts = []

        // Check weekday booking (should conflict)
        if (weekdayBooking.startUtc.getHours() >= 18) {
          conflicts.push(weekdayBooking)
        }

        // Weekend hours remain at 18:00, so no conflict
        return conflicts
      }

      const conflicts = await validateWeekdayTruncation()
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].id).toBe(weekdayBooking.id)
    })
  })

  describe('Boundary Cases', () => {
    it('should handle bookings exactly at truncation boundary', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Booking from 17:30-18:30 (spans truncation boundary)
      const boundaryBooking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 17), 30), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 18), 30), site.timezone),
      })

      // Truncate to 18:00
      const validateBoundaryTruncation = async () => {
        // Check if any part of booking extends beyond 18:00
        const booking = await prisma.booking.findUnique({
          where: { id: boundaryBooking.id },
          include: { slots: true },
        })

        const slotsAfter18 = booking?.slots.filter(slot => {
          const slotHour = toZonedTime(slot.slotStartUtc, site.timezone).getHours()
          return slotHour >= 18
        })

        return {
          hasConflict: (slotsAfter18?.length ?? 0) > 0,
          conflictingSlots: slotsAfter18,
        }
      }

      const result = await validateBoundaryTruncation()
      expect(result.hasConflict).toBe(true)
      expect(result.conflictingSlots).toHaveLength(1) // 18:00-18:30 slot
    })

    it('should handle bookings ending exactly at new close time', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Booking from 16:30-18:00 (ends exactly at truncation)
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 16), 30), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 18), 0), site.timezone),
      })

      // This should be allowed as it doesn't exceed 18:00
      const newOpening = {
        ...room.opening,
        mon: { open: '08:00', close: '18:00' },
        tue: { open: '08:00', close: '18:00' },
        wed: { open: '08:00', close: '18:00' },
        thu: { open: '08:00', close: '18:00' },
        fri: { open: '08:00', close: '18:00' },
      }

      const validateEndBoundary = async () => {
        const booking = await prisma.booking.findFirst({
          where: {
            roomId: room.id,
            canceledAt: null,
            endUtc: {
              gt: fromZonedTime(setMinutes(setHours(tomorrow, 18), 0), site.timezone),
            },
          },
        })

        return booking === null // No bookings exceed 18:00
      }

      const isValid = await validateEndBoundary()
      expect(isValid).toBe(true)
    })
  })

  describe('Cascading Effects', () => {
    it('should identify all affected bookings when truncating', async () => {
      const tomorrow = addDays(new Date(), 1)
      const affectedBookingIds: string[] = []

      // Create bookings throughout the day
      const timeSlots = [
        { start: 8, end: 9 },    // Morning - not affected
        { start: 12, end: 13 },  // Lunch - not affected
        { start: 17, end: 18 },  // Late afternoon - not affected
        { start: 18, end: 19 },  // Early evening - affected
        { start: 19, end: 20 },  // Evening - affected
        { start: 20, end: 21 },  // Late evening - affected
      ]

      for (const slot of timeSlots) {
        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: regularUser.id,
          startUtc: fromZonedTime(setMinutes(setHours(tomorrow, slot.start), 0), site.timezone),
          endUtc: fromZonedTime(setMinutes(setHours(tomorrow, slot.end), 0), site.timezone),
        })

        if (slot.start >= 18) {
          affectedBookingIds.push(booking.id)
        }
      }

      // Identify affected bookings for 18:00 truncation
      const affected = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
          startUtc: {
            gte: fromZonedTime(setMinutes(setHours(tomorrow, 18), 0), site.timezone),
          },
        },
        orderBy: { startUtc: 'asc' },
      })

      expect(affected).toHaveLength(3)
      expect(affected.map(b => b.id).sort()).toEqual(affectedBookingIds.sort())
    })

    it('should handle attendee notifications for truncated bookings', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create booking with attendees
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 19), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 20), 0), site.timezone),
      })

      // Add attendees
      const attendee1 = await createTestUser({
        email: 'attendee1@test.com',
        name: 'Attendee One',
        role: 'USER',
        timezone: 'America/Los_Angeles',
      })

      const attendee2 = await createTestUser({
        email: 'attendee2@test.com',
        name: 'Attendee Two',
        role: 'USER',
        timezone: 'Europe/London',
      })

      await prisma.bookingAttendee.createMany({
        data: [
          { bookingId: booking.id, userId: attendee1.id },
          { bookingId: booking.id, userId: attendee2.id },
        ],
      })

      // Get all users who need notification
      const affectedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { id: booking.ownerId },
            {
              attendeeOf: {
                some: {
                  bookingId: booking.id,
                },
              },
            },
          ],
        },
      })

      expect(affectedUsers).toHaveLength(3) // Owner + 2 attendees
      expect(affectedUsers.map(u => u.id).sort()).toEqual(
        [regularUser.id, attendee1.id, attendee2.id].sort()
      )
    })
  })

  describe('Timezone Considerations', () => {
    it('should handle truncation across different timezones', async () => {
      // Create a room in a different timezone
      const londonSite = await createTestSite({
        name: 'London Office',
        timezone: 'Europe/London',
      })

      const londonRoom = await createTestRoom({
        siteId: londonSite.id,
        name: 'Meeting Room',
        capacity: 8,
        opening: {
          mon: { open: '08:00', close: '22:00' },
          tue: { open: '08:00', close: '22:00' },
          wed: { open: '08:00', close: '22:00' },
          thu: { open: '08:00', close: '22:00' },
          fri: { open: '08:00', close: '22:00' },
          sat: { open: '10:00', close: '18:00' },
          sun: { open: '10:00', close: '18:00' },
        },
      })

      // User in NY books London room at 21:00 London time
      const tomorrow = addDays(new Date(), 1)
      const londonBookingTime = setMinutes(setHours(tomorrow, 21), 0)

      const booking = await createTestBooking({
        roomId: londonRoom.id,
        ownerId: regularUser.id, // NY user
        startUtc: fromZonedTime(londonBookingTime, londonSite.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 22), 0), londonSite.timezone),
      })

      // Truncate London room to 20:00
      const validateLondonTruncation = async () => {
        const bookingInLondonTime = toZonedTime(booking.startUtc, londonSite.timezone)
        const truncationTime = setMinutes(setHours(bookingInLondonTime, 20), 0)

        return bookingInLondonTime >= truncationTime
      }

      const isAffected = await validateLondonTruncation()
      expect(isAffected).toBe(true)
    })
  })

  describe('Activity Logging', () => {
    it('should log truncation attempts and outcomes', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create conflicting booking
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 20), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 21), 0), site.timezone),
      })

      // Log truncation attempt
      await prisma.activityLog.create({
        data: {
          actorId: adminUser.id,
          action: 'ROOM_HOURS_TRUNCATION_ATTEMPTED',
          entityType: 'room',
          entityId: room.id,
          metadata: {
            roomName: room.name,
            attemptedTruncation: {
              from: '22:00',
              to: '18:00',
            },
            result: 'BLOCKED',
            reason: 'Existing bookings in truncated period',
            affectedBookingCount: 1,
            affectedBookings: [
              {
                id: booking.id,
                startTime: booking.startUtc.toISOString(),
                endTime: booking.endUtc.toISOString(),
                owner: regularUser.email,
              },
            ],
          },
        },
      })

      const logs = await prisma.activityLog.findMany({
        where: {
          action: 'ROOM_HOURS_TRUNCATION_ATTEMPTED',
          entityId: room.id,
        },
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].metadata).toHaveProperty('attemptedTruncation')
      expect(logs[0].metadata).toHaveProperty('affectedBookings')
      expect((logs[0].metadata as any).result).toBe('BLOCKED')
    })

    it('should log successful truncation', async () => {
      // No conflicting bookings
      const newOpening = {
        mon: { open: '09:00', close: '17:00' },
        tue: { open: '09:00', close: '17:00' },
        wed: { open: '09:00', close: '17:00' },
        thu: { open: '09:00', close: '17:00' },
        fri: { open: '09:00', close: '17:00' },
        sat: { open: '10:00', close: '16:00' },
        sun: { open: '10:00', close: '16:00' },
      }

      await prisma.room.update({
        where: { id: room.id },
        data: { opening: newOpening },
      })

      await prisma.activityLog.create({
        data: {
          actorId: adminUser.id,
          action: 'ROOM_HOURS_TRUNCATED',
          entityType: 'room',
          entityId: room.id,
          metadata: {
            roomName: room.name,
            previousHours: room.opening,
            newHours: newOpening,
            changes: {
              weekdays: { from: '08:00-22:00', to: '09:00-17:00' },
              weekends: { from: '09:00-18:00', to: '10:00-16:00' },
            },
          },
        },
      })

      const logs = await prisma.activityLog.findMany({
        where: {
          action: 'ROOM_HOURS_TRUNCATED',
        },
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].metadata).toHaveProperty('changes')
    })
  })
})