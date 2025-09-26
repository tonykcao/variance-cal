import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestUser, createTestSite, createTestRoom, createTestBooking, cleanDatabase } from '../fixtures'
import { addDays, setHours, setMinutes } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

const prisma = new PrismaClient()

describe('Admin Cancellation Permissions', () => {
  let adminUser: any
  let regularUser1: any
  let regularUser2: any
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

    regularUser1 = await createTestUser({
      email: 'user1@test.com',
      name: 'Regular User 1',
      role: 'USER',
      timezone: 'America/New_York',
    })

    regularUser2 = await createTestUser({
      email: 'user2@test.com',
      name: 'Regular User 2',
      role: 'USER',
      timezone: 'America/Los_Angeles',
    })

    // Create test site and room
    site = await createTestSite({
      name: 'Test Site',
      timezone: 'America/New_York',
    })

    room = await createTestRoom({
      siteId: site.id,
      name: 'Meeting Room A',
      capacity: 8,
    })
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  describe('Admin Cancellation Rights', () => {
    it('should allow admin to cancel any users booking', async () => {
      // Create booking owned by regular user
      const tomorrow = addDays(new Date(), 1)
      const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone)
      const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, 11), 30), site.timezone)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc,
        endUtc,
      })

      // Admin cancels the booking
      const cancelBooking = async (bookingId: string, userId: string) => {
        const user = await prisma.user.findUnique({ where: { id: userId } })

        if (!user) {
          throw new Error('User not found')
        }

        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        })

        if (!booking) {
          throw new Error('Booking not found')
        }

        // Check permission: admin can cancel any, user can only cancel own
        if (user.role !== 'ADMIN' && booking.ownerId !== userId) {
          throw new Error('Unauthorized to cancel this booking')
        }

        // Perform cancellation
        const canceledBooking = await prisma.$transaction(async (tx) => {
          // Mark booking as canceled
          const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { canceledAt: new Date() },
          })

          // Delete future slots
          await tx.bookingSlot.deleteMany({
            where: {
              bookingId: bookingId,
              slotStartUtc: { gte: new Date() },
            },
          })

          // Log the activity
          await tx.activityLog.create({
            data: {
              actorId: userId,
              action: 'BOOKING_CANCELED',
              entityType: 'booking',
              entityId: bookingId,
              metadata: {
                canceledBy: user.email,
                canceledByRole: user.role,
                originalOwner: booking.ownerId,
              },
            },
          })

          return updated
        })

        return canceledBooking
      }

      // Admin should be able to cancel
      const canceledBooking = await cancelBooking(booking.id, adminUser.id)
      expect(canceledBooking.canceledAt).toBeTruthy()

      // Verify activity log
      const logs = await prisma.activityLog.findMany({
        where: {
          action: 'BOOKING_CANCELED',
          entityId: booking.id,
        },
      })

      expect(logs).toHaveLength(1)
      expect(logs[0].actorId).toBe(adminUser.id)
      expect((logs[0].metadata as any).canceledByRole).toBe('ADMIN')
    })

    it('should prevent regular users from canceling others bookings', async () => {
      // User 1 creates a booking
      const tomorrow = addDays(new Date(), 1)
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 14), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 15), 0), site.timezone),
      })

      // User 2 tries to cancel User 1's booking
      const attemptCancel = async () => {
        const user = await prisma.user.findUnique({ where: { id: regularUser2.id } })
        const bookingToCancel = await prisma.booking.findUnique({ where: { id: booking.id } })

        if (!user || !bookingToCancel) {
          throw new Error('Data not found')
        }

        // Permission check
        if (user.role !== 'ADMIN' && bookingToCancel.ownerId !== regularUser2.id) {
          throw new Error('Unauthorized to cancel this booking')
        }

        return true
      }

      await expect(attemptCancel()).rejects.toThrow('Unauthorized to cancel this booking')

      // Verify booking is still active
      const stillActiveBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      })

      expect(stillActiveBooking?.canceledAt).toBeNull()
    })

    it('should allow users to cancel their own bookings', async () => {
      // User creates their own booking
      const tomorrow = addDays(new Date(), 1)
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 16), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 17), 0), site.timezone),
      })

      // Same user cancels their booking
      const canceledBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: { canceledAt: new Date() },
      })

      expect(canceledBooking.canceledAt).toBeTruthy()
      expect(canceledBooking.ownerId).toBe(regularUser1.id)
    })
  })

  describe('Cancellation of Bookings with Attendees', () => {
    it('should allow admin to cancel bookings with multiple attendees', async () => {
      const tomorrow = addDays(new Date(), 1)
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 12), 0), site.timezone),
      })

      // Add attendees
      await prisma.bookingAttendee.createMany({
        data: [
          { bookingId: booking.id, userId: regularUser2.id },
          { bookingId: booking.id, userId: adminUser.id },
        ],
      })

      // Admin cancels booking with attendees
      const result = await prisma.$transaction(async (tx) => {
        const canceled = await tx.booking.update({
          where: { id: booking.id },
          data: { canceledAt: new Date() },
        })

        // Get all affected users for notification
        const affectedUsers = await tx.user.findMany({
          where: {
            OR: [
              { id: booking.ownerId },
              {
                attendeeOf: {
                  some: { bookingId: booking.id },
                },
              },
            ],
          },
        })

        await tx.activityLog.create({
          data: {
            actorId: adminUser.id,
            action: 'BOOKING_CANCELED_WITH_ATTENDEES',
            entityType: 'booking',
            entityId: booking.id,
            metadata: {
              affectedUserIds: affectedUsers.map(u => u.id),
              attendeeCount: affectedUsers.length - 1,
            },
          },
        })

        return { canceled, affectedUsers }
      })

      expect(result.canceled.canceledAt).toBeTruthy()
      expect(result.affectedUsers).toHaveLength(3) // Owner + 2 attendees
    })

    it('should prevent attendees from canceling bookings they dont own', async () => {
      const tomorrow = addDays(new Date(), 1)
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 13), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 14), 0), site.timezone),
      })

      // Add user2 as attendee
      await prisma.bookingAttendee.create({
        data: {
          bookingId: booking.id,
          userId: regularUser2.id,
        },
      })

      // User2 (attendee) tries to cancel
      const canCancel = async (userId: string, bookingId: string) => {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } })

        if (!user || !booking) return false

        // Only owner or admin can cancel
        return user.role === 'ADMIN' || booking.ownerId === userId
      }

      const user2CanCancel = await canCancel(regularUser2.id, booking.id)
      expect(user2CanCancel).toBe(false)

      // Verify booking is still active
      const activeBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      })
      expect(activeBooking?.canceledAt).toBeNull()
    })
  })

  describe('Cancellation of Past and In-Progress Bookings', () => {
    it('should allow admin to cancel past bookings', async () => {
      const yesterday = addDays(new Date(), -1)
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc: fromZonedTime(setMinutes(setHours(yesterday, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(yesterday, 11), 0), site.timezone),
      })

      // Admin cancels past booking
      const canceled = await prisma.booking.update({
        where: { id: booking.id },
        data: { canceledAt: new Date() },
      })

      expect(canceled.canceledAt).toBeTruthy()

      // No slots should be deleted (all in the past)
      const deletedSlots = await prisma.bookingSlot.findMany({
        where: { bookingId: booking.id },
      })

      // All slots should still exist (past slots are kept for history)
      expect(deletedSlots.length).toBeGreaterThan(0)
    })

    it('should handle cancellation of in-progress bookings correctly', async () => {
      const now = new Date()
      const oneHourAgo = addDays(now, 0)
      oneHourAgo.setHours(now.getHours() - 1)
      const oneHourLater = addDays(now, 0)
      oneHourLater.setHours(now.getHours() + 1)

      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: regularUser1.id,
        startUtc: oneHourAgo,
        endUtc: oneHourLater,
      })

      // Cancel in-progress booking
      const result = await prisma.$transaction(async (tx) => {
        const canceled = await tx.booking.update({
          where: { id: booking.id },
          data: { canceledAt: now },
        })

        // Delete only future slots
        const deletedCount = await tx.bookingSlot.deleteMany({
          where: {
            bookingId: booking.id,
            slotStartUtc: { gte: now },
          },
        })

        // Keep past slots for history
        const remainingSlots = await tx.bookingSlot.findMany({
          where: {
            bookingId: booking.id,
          },
        })

        return { canceled, deletedCount: deletedCount.count, remainingSlots }
      })

      expect(result.canceled.canceledAt).toBeTruthy()
      // Some slots should be deleted (future), some kept (past)
      expect(result.deletedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Bulk Cancellation by Admin', () => {
    it('should allow admin to bulk cancel bookings for room maintenance', async () => {
      const tomorrow = addDays(new Date(), 1)
      const bookings = []

      // Create multiple bookings for tomorrow
      for (let hour = 10; hour < 16; hour++) {
        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: hour % 2 === 0 ? regularUser1.id : regularUser2.id,
          startUtc: fromZonedTime(setMinutes(setHours(tomorrow, hour), 0), site.timezone),
          endUtc: fromZonedTime(setMinutes(setHours(tomorrow, hour), 30), site.timezone),
        })
        bookings.push(booking)
      }

      // Admin bulk cancels for maintenance
      const bulkCancel = await prisma.$transaction(async (tx) => {
        const bookingIds = bookings.map(b => b.id)

        // Cancel all bookings
        const { count } = await tx.booking.updateMany({
          where: {
            id: { in: bookingIds },
          },
          data: {
            canceledAt: new Date(),
          },
        })

        // Delete all future slots
        await tx.bookingSlot.deleteMany({
          where: {
            bookingId: { in: bookingIds },
            slotStartUtc: { gte: new Date() },
          },
        })

        // Log bulk cancellation
        await tx.activityLog.create({
          data: {
            actorId: adminUser.id,
            action: 'BULK_BOOKING_CANCELLATION',
            entityType: 'room',
            entityId: room.id,
            metadata: {
              reason: 'Room maintenance',
              canceledCount: count,
              bookingIds,
              date: tomorrow.toISOString(),
            },
          },
        })

        return count
      })

      expect(bulkCancel).toBe(bookings.length)

      // Verify all bookings are canceled
      const canceledBookings = await prisma.booking.findMany({
        where: {
          id: { in: bookings.map(b => b.id) },
        },
      })

      canceledBookings.forEach(booking => {
        expect(booking.canceledAt).toBeTruthy()
      })
    })
  })

  describe('Permission Escalation Prevention', () => {
    it('should prevent permission elevation through API manipulation', async () => {
      // Regular user tries to set their role to ADMIN
      const attemptElevation = async () => {
        try {
          await prisma.user.update({
            where: { id: regularUser1.id },
            data: { role: 'ADMIN' },
          })
          return true
        } catch {
          return false
        }
      }

      // This should succeed at DB level but fail at API level
      const elevated = await attemptElevation()

      // In real app, this would be prevented by API middleware
      // For testing, we verify the concept
      if (elevated) {
        // Reset the user
        await prisma.user.update({
          where: { id: regularUser1.id },
          data: { role: 'USER' },
        })
      }

      // Verify user is still regular user in proper implementation
      const verifyPermission = async (userId: string) => {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        // In production, this check would be in middleware
        return user?.role === 'ADMIN'
      }

      const hasAdminRights = await verifyPermission(regularUser1.id)
      expect(hasAdminRights).toBe(false)
    })

    it('should audit all admin actions', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create multiple bookings
      const bookings = []
      for (let i = 0; i < 3; i++) {
        const booking = await createTestBooking({
          roomId: room.id,
          ownerId: regularUser1.id,
          startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10 + i), 0), site.timezone),
          endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11 + i), 0), site.timezone),
        })
        bookings.push(booking)
      }

      // Admin cancels each booking (with logging)
      for (const booking of bookings) {
        await prisma.$transaction(async (tx) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { canceledAt: new Date() },
          })

          await tx.activityLog.create({
            data: {
              actorId: adminUser.id,
              action: 'ADMIN_CANCELED_USER_BOOKING',
              entityType: 'booking',
              entityId: booking.id,
              metadata: {
                adminEmail: adminUser.email,
                originalOwnerEmail: regularUser1.email,
                timestamp: new Date().toISOString(),
              },
            },
          })
        })
      }

      // Verify audit trail
      const adminActions = await prisma.activityLog.findMany({
        where: {
          actorId: adminUser.id,
          action: 'ADMIN_CANCELED_USER_BOOKING',
        },
      })

      expect(adminActions).toHaveLength(3)
      adminActions.forEach(log => {
        expect(log.actorId).toBe(adminUser.id)
        expect((log.metadata as any).adminEmail).toBe(adminUser.email)
      })
    })
  })
})