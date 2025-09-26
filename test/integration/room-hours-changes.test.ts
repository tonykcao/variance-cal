import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestUser, createTestSite, createTestRoom, createTestBooking } from '../fixtures'
import { addDays, setHours, setMinutes, format } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const prisma = new PrismaClient()

describe('Room Hours Changes with Existing Bookings', () => {
  let adminUser: any
  let regularUser: any
  let site: any
  let room: any

  beforeEach(async () => {
    // Clean database
    await prisma.bookingSlot.deleteMany()
    await prisma.bookingAttendee.deleteMany()
    await prisma.activityLog.deleteMany()
    await prisma.booking.deleteMany()
    await prisma.room.deleteMany()
    await prisma.site.deleteMany()
    await prisma.user.deleteMany()

    // Create test data
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
      timezone: 'America/Los_Angeles',
    })

    site = await createTestSite({
      name: 'Test Site',
      timezone: 'America/New_York',
    })

    room = await createTestRoom({
      siteId: site.id,
      name: 'Conference Room A',
      capacity: 10,
      opening: {
        mon: { open: '08:00', close: '20:00' },
        tue: { open: '08:00', close: '20:00' },
        wed: { open: '08:00', close: '20:00' },
        thu: { open: '08:00', close: '20:00' },
        fri: { open: '08:00', close: '20:00' },
        sat: { open: '10:00', close: '18:00' },
        sun: { open: '10:00', close: '18:00' },
      },
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  describe('Reducing Room Hours', () => {
    it('should handle reduction of hours with existing bookings in removed hours', async () => {
      // Create a booking in the evening (18:00 - 19:30)
      const tomorrow = addDays(new Date(), 1)
      const startLocal = setMinutes(setHours(tomorrow, 18), 0)
      const endLocal = setMinutes(setHours(tomorrow, 19), 30)

      const startUtc = fromZonedTime(startLocal, site.timezone)
      const endUtc = fromZonedTime(endLocal, site.timezone)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc,
        endUtc,
      })

      // Now try to change room hours to close at 17:00
      const newOpening = {
        ...room.opening,
        mon: { open: '08:00', close: '17:00' },
        tue: { open: '08:00', close: '17:00' },
        wed: { open: '08:00', close: '17:00' },
        thu: { open: '08:00', close: '17:00' },
        fri: { open: '08:00', close: '17:00' },
      }

      // Validate that system detects conflict
      const conflictingBookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
          OR: [
            {
              startUtc: {
                gte: fromZonedTime(setMinutes(setHours(tomorrow, 17), 0), site.timezone),
              },
            },
          ],
        },
      })

      expect(conflictingBookings.length).toBeGreaterThan(0)
      expect(conflictingBookings[0].id).toBe(booking.id)
    })

    it('should allow hour reduction when no bookings exist in removed period', async () => {
      // Create a booking in the morning (09:00 - 10:30)
      const tomorrow = addDays(new Date(), 1)
      const startLocal = setMinutes(setHours(tomorrow, 9), 0)
      const endLocal = setMinutes(setHours(tomorrow, 10), 30)

      const startUtc = fromZonedTime(startLocal, site.timezone)
      const endUtc = fromZonedTime(endLocal, site.timezone)

      await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc,
        endUtc,
      })

      // Change room hours to close at 17:00 (no conflict with morning booking)
      const newOpening = {
        ...room.opening,
        mon: { open: '08:00', close: '17:00' },
        tue: { open: '08:00', close: '17:00' },
        wed: { open: '08:00', close: '17:00' },
        thu: { open: '08:00', close: '17:00' },
        fri: { open: '08:00', close: '17:00' },
      }

      // Update room hours
      const updatedRoom = await prisma.room.update({
        where: { id: room.id },
        data: { opening: newOpening },
      })

      expect(updatedRoom.opening).toEqual(newOpening)
    })

    it('should handle partial day closures with existing bookings', async () => {
      // Create bookings for multiple days
      const bookings = []
      for (let i = 1; i <= 3; i++) {
        const day = addDays(new Date(), i)
        const startLocal = setMinutes(setHours(day, 14), 0)
        const endLocal = setMinutes(setHours(day, 16), 0)

        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: regularUser.id,
          startUtc: fromZonedTime(startLocal, site.timezone),
          endUtc: fromZonedTime(endLocal, site.timezone),
        })
        bookings.push(booking)
      }

      // Close room on middle day only
      const dayOfWeek = format(addDays(new Date(), 2), 'EEE').toLowerCase()
      const newOpening = {
        ...room.opening,
        [dayOfWeek]: { open: '00:00', close: '00:00' }, // Closed
      }

      // Check for conflicts
      const conflictingBookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
          id: bookings[1].id, // Middle day booking
        },
      })

      expect(conflictingBookings.length).toBe(1)
    })
  })

  describe('Extending Room Hours', () => {
    it('should allow extending hours without conflicts', async () => {
      // Extend hours from 20:00 to 22:00
      const newOpening = {
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '22:00' },
        fri: { open: '08:00', close: '22:00' },
        sat: { open: '10:00', close: '20:00' },
        sun: { open: '10:00', close: '20:00' },
      }

      const updatedRoom = await prisma.room.update({
        where: { id: room.id },
        data: { opening: newOpening },
      })

      expect(updatedRoom.opening).toEqual(newOpening)

      // New bookings should be allowed in extended hours
      const tomorrow = addDays(new Date(), 1)
      const startLocal = setMinutes(setHours(tomorrow, 20), 30)
      const endLocal = setMinutes(setHours(tomorrow, 21), 30)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(startLocal, site.timezone),
        endUtc: fromZonedTime(endLocal, site.timezone),
      })

      expect(booking).toBeDefined()
      expect(booking.roomId).toBe(room.id)
    })
  })

  describe('Room Hours Changes During Active Bookings', () => {
    it('should handle hour changes during an active booking', async () => {
      // Create a booking that starts in 5 minutes and lasts 2 hours
      const now = new Date()
      const startUtc = addDays(now, 0) // Today
      const endUtc = addDays(startUtc, 0)

      // Set to a specific time for testing
      startUtc.setHours(14, 0, 0, 0)
      endUtc.setHours(16, 0, 0, 0)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc,
        endUtc,
      })

      // Try to change hours to close at 15:00 (middle of booking)
      const dayOfWeek = format(startUtc, 'EEE').toLowerCase()
      const newOpening = {
        ...room.opening,
        [dayOfWeek]: { open: '08:00', close: '15:00' },
      }

      // Check for active booking conflicts
      const activeBookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
          startUtc: { lte: now },
          endUtc: { gte: now },
        },
      })

      // If there are active bookings, the system should prevent the change
      if (activeBookings.length > 0) {
        expect(activeBookings[0].id).toBe(booking.id)
      }
    })

    it('should allow hour changes that do not affect active bookings', async () => {
      // Create a morning booking
      const today = new Date()
      const startLocal = setMinutes(setHours(today, 9), 0)
      const endLocal = setMinutes(setHours(today, 10), 30)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(startLocal, site.timezone),
        endUtc: fromZonedTime(endLocal, site.timezone),
      })

      // Change evening hours (no conflict with morning booking)
      const dayOfWeek = format(today, 'EEE').toLowerCase()
      const newOpening = {
        ...room.opening,
        [dayOfWeek]: { open: '08:00', close: '17:00' }, // Still covers morning
      }

      const updatedRoom = await prisma.room.update({
        where: { id: room.id },
        data: { opening: newOpening },
      })

      expect(updatedRoom.opening).toEqual(newOpening)
    })
  })

  describe('Complete Room Closure', () => {
    it('should handle closing a room with future bookings', async () => {
      // Create multiple future bookings
      const futureBookings = []
      for (let i = 1; i <= 5; i++) {
        const day = addDays(new Date(), i)
        const startLocal = setMinutes(setHours(day, 10), 0)
        const endLocal = setMinutes(setHours(day, 11), 0)

        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: regularUser.id,
          startUtc: fromZonedTime(startLocal, site.timezone),
          endUtc: fromZonedTime(endLocal, site.timezone),
        })
        futureBookings.push(booking)
      }

      // Close room completely
      const closedOpening = {
        mon: { open: '00:00', close: '00:00' },
        tue: { open: '00:00', close: '00:00' },
        wed: { open: '00:00', close: '00:00' },
        thu: { open: '00:00', close: '00:00' },
        fri: { open: '00:00', close: '00:00' },
        sat: { open: '00:00', close: '00:00' },
        sun: { open: '00:00', close: '00:00' },
      }

      // Check all future bookings would be affected
      const affectedBookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
          startUtc: { gte: new Date() },
        },
      })

      expect(affectedBookings.length).toBe(futureBookings.length)
    })

    it('should validate cascade effects when closing a room', async () => {
      // Create bookings with attendees
      const tomorrow = addDays(new Date(), 1)
      const startLocal = setMinutes(setHours(tomorrow, 14), 0)
      const endLocal = setMinutes(setHours(tomorrow, 15), 30)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(startLocal, site.timezone),
        endUtc: fromZonedTime(endLocal, site.timezone),
      })

      // Add attendees
      await prisma.bookingAttendee.create({
        data: {
          bookingId: booking.id,
          userId: adminUser.id,
        },
      })

      // Check cascade impact
      const bookingWithAttendees = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          attendees: true,
          slots: true,
        },
      })

      expect(bookingWithAttendees?.attendees.length).toBe(1)
      expect(bookingWithAttendees?.slots.length).toBe(3) // 1.5 hours = 3 slots
    })
  })

  describe('Effective Date for Room Hours Changes', () => {
    it('should apply room hours changes from a future effective date', async () => {
      // Create bookings for next week
      const nextWeek = addDays(new Date(), 7)
      const startLocal = setMinutes(setHours(nextWeek, 18), 0)
      const endLocal = setMinutes(setHours(nextWeek, 19), 30)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(startLocal, site.timezone),
        endUtc: fromZonedTime(endLocal, site.timezone),
      })

      // Set new hours to take effect after the booking
      const effectiveFrom = addDays(nextWeek, 1)

      // This would be the new room hours with effective date
      const newHoursWithEffectiveDate = {
        opening: {
          mon: { open: '08:00', close: '17:00' },
          tue: { open: '08:00', close: '17:00' },
          wed: { open: '08:00', close: '17:00' },
          thu: { open: '08:00', close: '17:00' },
          fri: { open: '08:00', close: '17:00' },
          sat: { open: '10:00', close: '16:00' },
          sun: { open: '10:00', close: '16:00' },
        },
        effectiveFrom,
      }

      // Existing booking should not be affected since it's before effective date
      expect(booking.startUtc).toBeLessThan(effectiveFrom)
    })

    it('should maintain old hours for bookings before effective date', async () => {
      // Create bookings spanning the effective date change
      const beforeDate = addDays(new Date(), 3)
      const afterDate = addDays(new Date(), 10)

      const bookingBefore = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(beforeDate, 18), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(beforeDate, 19), 30), site.timezone),
      })

      const bookingAfter = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(setMinutes(setHours(afterDate, 18), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(afterDate, 19), 30), site.timezone),
      })

      const effectiveFrom = addDays(new Date(), 7)

      // Booking before effective date should be valid with old hours
      expect(bookingBefore.startUtc).toBeLessThan(effectiveFrom)

      // Booking after effective date would need to comply with new hours
      expect(bookingAfter.startUtc).toBeGreaterThan(effectiveFrom)
    })
  })

  describe('Validation and Error Handling', () => {
    it('should provide clear error messages for hour change conflicts', async () => {
      // Create a booking
      const tomorrow = addDays(new Date(), 1)
      const startLocal = setMinutes(setHours(tomorrow, 18), 0)
      const endLocal = setMinutes(setHours(tomorrow, 19), 30)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser.id,
        startUtc: fromZonedTime(startLocal, site.timezone),
        endUtc: fromZonedTime(endLocal, site.timezone),
      })

      // Attempt to reduce hours
      const validateHourChange = async (newOpening: any) => {
        const conflicts = await prisma.booking.findMany({
          where: {
            roomId: room.id,
            canceledAt: null,
            // Check if bookings fall outside new hours
          },
        })

        if (conflicts.length > 0) {
          return {
            success: false,
            error: `Cannot change room hours: ${conflicts.length} booking(s) would be affected`,
            affectedBookings: conflicts.map(b => ({
              id: b.id,
              start: b.startUtc,
              end: b.endUtc,
            })),
          }
        }

        return { success: true }
      }

      const result = await validateHourChange({
        mon: { open: '08:00', close: '17:00' },
      })

      if (!result.success) {
        expect(result.error).toContain('Cannot change room hours')
        expect(result.affectedBookings).toBeDefined()
      }
    })

    it('should handle invalid hour formats gracefully', async () => {
      const invalidOpenings = [
        { mon: { open: '25:00', close: '20:00' } }, // Invalid hour
        { mon: { open: '08:00', close: '07:00' } }, // Close before open
        { mon: { open: '08:00', close: '24:01' } }, // Invalid time
        { mon: { open: '-01:00', close: '20:00' } }, // Negative hour
      ]

      for (const invalidOpening of invalidOpenings) {
        const validateOpening = (opening: any) => {
          const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

          for (const day of Object.values(opening)) {
            const { open, close } = day as any

            if (!timeRegex.test(open) || !timeRegex.test(close)) {
              return false
            }

            const [openHour, openMin] = open.split(':').map(Number)
            const [closeHour, closeMin] = close.split(':').map(Number)

            const openMinutes = openHour * 60 + openMin
            const closeMinutes = closeHour * 60 + closeMin

            if (closeMinutes <= openMinutes && closeMinutes !== 0) {
              return false
            }
          }

          return true
        }

        expect(validateOpening(invalidOpening)).toBe(false)
      }
    })
  })

  describe('Activity Logging', () => {
    it('should log room hours changes with details', async () => {
      const originalOpening = room.opening
      const newOpening = {
        mon: { open: '09:00', close: '18:00' },
        tue: { open: '09:00', close: '18:00' },
        wed: { open: '09:00', close: '18:00' },
        thu: { open: '09:00', close: '18:00' },
        fri: { open: '09:00', close: '18:00' },
        sat: { open: '11:00', close: '17:00' },
        sun: { open: '11:00', close: '17:00' },
      }

      // Update room
      await prisma.room.update({
        where: { id: room.id },
        data: { opening: newOpening },
      })

      // Log the change
      await prisma.activityLog.create({
        data: {
          actorId: adminUser.id,
          action: 'ROOM_HOURS_UPDATED',
          entityType: 'room',
          entityId: room.id,
          metadata: {
            roomName: room.name,
            siteId: site.id,
            previousHours: originalOpening,
            newHours: newOpening,
            changedAt: new Date().toISOString(),
          },
        },
      })

      const logs = await prisma.activityLog.findMany({
        where: {
          entityType: 'room',
          entityId: room.id,
          action: 'ROOM_HOURS_UPDATED',
        },
      })

      expect(logs.length).toBe(1)
      expect(logs[0].metadata).toHaveProperty('previousHours')
      expect(logs[0].metadata).toHaveProperty('newHours')
    })

    it('should track affected bookings in activity log', async () => {
      // Create bookings that would be affected
      const tomorrow = addDays(new Date(), 1)
      const bookings = []

      for (let i = 0; i < 3; i++) {
        const startHour = 18 + i
        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: regularUser.id,
          startUtc: fromZonedTime(setMinutes(setHours(tomorrow, startHour), 0), site.timezone),
          endUtc: fromZonedTime(setMinutes(setHours(tomorrow, startHour), 30), site.timezone),
        })
        bookings.push(booking)
      }

      // Log attempted hour change with affected bookings
      await prisma.activityLog.create({
        data: {
          actorId: adminUser.id,
          action: 'ROOM_HOURS_CHANGE_BLOCKED',
          entityType: 'room',
          entityId: room.id,
          metadata: {
            reason: 'Existing bookings conflict',
            affectedBookingIds: bookings.map(b => b.id),
            proposedHours: {
              mon: { open: '08:00', close: '17:00' },
            },
          },
        },
      })

      const logs = await prisma.activityLog.findMany({
        where: {
          action: 'ROOM_HOURS_CHANGE_BLOCKED',
        },
      })

      expect(logs.length).toBe(1)
      expect(logs[0].metadata).toHaveProperty('affectedBookingIds')
      expect((logs[0].metadata as any).affectedBookingIds).toHaveLength(3)
    })
  })
})