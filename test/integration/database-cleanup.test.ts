import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createTestUser, createTestSite, createTestRoom, createTestBooking, cleanDatabase } from '../fixtures'
import { cleanupUserBookings, cleanupOldBookings } from '../../scripts/cleanup-test-data'
import { addDays, setHours, setMinutes } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

const prisma = new PrismaClient()

describe('Database Cleanup Functionality', () => {
  let seedUsers: any[]
  let testUsers: any[]
  let site: any
  let room: any

  beforeEach(async () => {
    await cleanDatabase()

    // Create seed users (should be preserved)
    seedUsers = await Promise.all([
      createTestUser({
        email: 'alice@example.com',
        name: 'Alice User',
        role: 'USER',
        timezone: 'America/New_York',
      }),
      createTestUser({
        email: 'bob@example.com',
        name: 'Bob User',
        role: 'USER',
        timezone: 'America/Los_Angeles',
      }),
      createTestUser({
        email: 'connor@example.com',
        name: 'Connor Admin',
        role: 'ADMIN',
        timezone: 'Europe/London',
      }),
    ])

    // Create test users (should be removed by cleanup)
    testUsers = await Promise.all([
      createTestUser({
        email: 'test1@test.com',
        name: 'Test User 1',
        role: 'USER',
        timezone: 'America/New_York',
      }),
      createTestUser({
        email: 'test2@test.com',
        name: 'Test User 2',
        role: 'USER',
        timezone: 'America/New_York',
      }),
      createTestUser({
        email: 'cleanup.test@test.com',
        name: 'Cleanup Test User',
        role: 'USER',
        timezone: 'America/New_York',
      }),
    ])

    // Create site and room
    site = await createTestSite({
      name: 'Test Site',
      timezone: 'America/New_York',
    })

    room = await createTestRoom({
      siteId: site.id,
      name: 'Test Room',
      capacity: 10,
    })
  })

  afterEach(async () => {
    await cleanDatabase()
    await prisma.$disconnect()
  })

  describe('Test Data Cleanup', () => {
    it('should remove all test user bookings while preserving seed users', async () => {
      // Create bookings for both seed and test users
      const tomorrow = addDays(new Date(), 1)
      const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone)
      const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone)

      // Seed user booking
      const seedBooking = await createTestBooking({
        roomId: room.id,
        ownerId: seedUsers[0].id,
        startUtc,
        endUtc,
      })

      // Test user bookings
      const testBooking1 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 12), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 13), 0), site.timezone),
      })

      const testBooking2 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[1].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 14), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 15), 0), site.timezone),
      })

      // Verify bookings exist
      const bookingsBeforeCleanup = await prisma.booking.count()
      expect(bookingsBeforeCleanup).toBe(3)

      // Clean up test data
      await prisma.$transaction(async (tx) => {
        // Delete test user booking slots
        await tx.bookingSlot.deleteMany({
          where: {
            booking: {
              owner: {
                email: {
                  contains: 'test',
                },
              },
            },
          },
        })

        // Delete test user bookings
        await tx.booking.deleteMany({
          where: {
            owner: {
              email: {
                contains: 'test',
              },
            },
          },
        })

        // Delete test users
        await tx.user.deleteMany({
          where: {
            email: {
              contains: 'test',
            },
          },
        })
      })

      // Verify cleanup results
      const remainingBookings = await prisma.booking.count()
      const remainingUsers = await prisma.user.count()

      expect(remainingBookings).toBe(1) // Only seed user booking
      expect(remainingUsers).toBe(3) // Only seed users

      // Verify seed booking still exists
      const seedBookingExists = await prisma.booking.findUnique({
        where: { id: seedBooking.id },
      })
      expect(seedBookingExists).toBeTruthy()

      // Verify test bookings are gone
      const testBooking1Exists = await prisma.booking.findUnique({
        where: { id: testBooking1.id },
      })
      expect(testBooking1Exists).toBeNull()
    })

    it('should clean up all related data (slots, attendees, activity logs)', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create complex test booking with attendees
      const testBooking = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 12), 0), site.timezone), // 2 hours = 4 slots
      })

      // Add attendees
      await prisma.bookingAttendee.createMany({
        data: [
          { bookingId: testBooking.id, userId: testUsers[1].id },
          { bookingId: testBooking.id, userId: testUsers[2].id },
        ],
      })

      // Add activity log
      await prisma.activityLog.create({
        data: {
          actorId: testUsers[0].id,
          action: 'BOOKING_CREATED',
          entityType: 'booking',
          entityId: testBooking.id,
          metadata: {},
        },
      })

      // Verify all data exists
      const slotsBeforeCleanup = await prisma.bookingSlot.count()
      const attendeesBeforeCleanup = await prisma.bookingAttendee.count()
      const logsBeforeCleanup = await prisma.activityLog.count()

      expect(slotsBeforeCleanup).toBeGreaterThan(0)
      expect(attendeesBeforeCleanup).toBe(2)
      expect(logsBeforeCleanup).toBe(1)

      // Clean up test data
      await prisma.$transaction(async (tx) => {
        await tx.bookingSlot.deleteMany({
          where: {
            booking: {
              owner: {
                email: {
                  contains: 'test',
                },
              },
            },
          },
        })

        await tx.bookingAttendee.deleteMany({
          where: {
            booking: {
              owner: {
                email: {
                  contains: 'test',
                },
              },
            },
          },
        })

        await tx.activityLog.deleteMany({
          where: {
            actor: {
              email: {
                contains: 'test',
              },
            },
          },
        })

        await tx.booking.deleteMany({
          where: {
            owner: {
              email: {
                contains: 'test',
              },
            },
          },
        })
      })

      // Verify all related data is cleaned up
      const slotsAfterCleanup = await prisma.bookingSlot.count()
      const attendeesAfterCleanup = await prisma.bookingAttendee.count()
      const logsAfterCleanup = await prisma.activityLog.count()

      expect(slotsAfterCleanup).toBe(0)
      expect(attendeesAfterCleanup).toBe(0)
      expect(logsAfterCleanup).toBe(0)
    })
  })

  describe('User-specific Cleanup', () => {
    it('should clean up bookings for specific users only', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create bookings for multiple users
      const booking1 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone),
      })

      const booking2 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[1].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 12), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 13), 0), site.timezone),
      })

      const booking3 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[2].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 14), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 15), 0), site.timezone),
      })

      // Clean up bookings for only first user
      const result = await cleanupUserBookings([testUsers[0].id])

      expect(result.bookings).toBe(1)

      // Verify other bookings still exist
      const booking2Exists = await prisma.booking.findUnique({
        where: { id: booking2.id },
      })
      const booking3Exists = await prisma.booking.findUnique({
        where: { id: booking3.id },
      })

      expect(booking2Exists).toBeTruthy()
      expect(booking3Exists).toBeTruthy()
    })

    it('should clean up bookings where user is attendee', async () => {
      const tomorrow = addDays(new Date(), 1)

      // User 1 owns a booking
      const booking1 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone),
      })

      // User 2 owns a booking with User 1 as attendee
      const booking2 = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[1].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 12), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 13), 0), site.timezone),
      })

      await prisma.bookingAttendee.create({
        data: {
          bookingId: booking2.id,
          userId: testUsers[0].id, // User 1 is attendee
        },
      })

      // Clean up User 1's data
      const result = await cleanupUserBookings([testUsers[0].id])

      // Should clean up booking1 (owned) and remove User 1 as attendee from booking2
      expect(result.bookings).toBeGreaterThan(0)
      expect(result.bookingAttendees).toBeGreaterThan(0)

      // Verify booking2 still exists but without User 1 as attendee
      const booking2Attendees = await prisma.bookingAttendee.findMany({
        where: { bookingId: booking2.id },
      })
      expect(booking2Attendees).toHaveLength(0)
    })
  })

  describe('Old Bookings Cleanup', () => {
    it('should clean up bookings older than specified days', async () => {
      // Create bookings with different dates
      const oldDate = addDays(new Date(), -35) // 35 days ago
      const recentDate = addDays(new Date(), -5) // 5 days ago
      const futureDate = addDays(new Date(), 5) // 5 days from now

      const oldBooking = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: oldDate,
        endUtc: addDays(oldDate, 0),
      })

      const recentBooking = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[1].id,
        startUtc: recentDate,
        endUtc: addDays(recentDate, 0),
      })

      const futureBooking = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[2].id,
        startUtc: futureDate,
        endUtc: addDays(futureDate, 0),
      })

      // Clean up bookings older than 30 days
      const result = await cleanupOldBookings(30)

      expect(result.bookings).toBe(1) // Only old booking

      // Verify recent and future bookings still exist
      const recentExists = await prisma.booking.findUnique({
        where: { id: recentBooking.id },
      })
      const futureExists = await prisma.booking.findUnique({
        where: { id: futureBooking.id },
      })
      const oldExists = await prisma.booking.findUnique({
        where: { id: oldBooking.id },
      })

      expect(recentExists).toBeTruthy()
      expect(futureExists).toBeTruthy()
      expect(oldExists).toBeNull()
    })

    it('should handle case when no old bookings exist', async () => {
      // Create only recent bookings
      const tomorrow = addDays(new Date(), 1)

      await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: tomorrow,
        endUtc: addDays(tomorrow, 0),
      })

      // Clean up bookings older than 30 days
      const result = await cleanupOldBookings(30)

      expect(result.cleaned).toBe(0)

      // Verify booking still exists
      const bookingCount = await prisma.booking.count()
      expect(bookingCount).toBe(1)
    })
  })

  describe('Data Integrity', () => {
    it('should preserve sites and rooms during cleanup', async () => {
      const sitesBeforeCleanup = await prisma.site.count()
      const roomsBeforeCleanup = await prisma.room.count()

      // Create and clean up test bookings
      const tomorrow = addDays(new Date(), 1)
      await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone),
      })

      // Clean up all bookings
      await prisma.booking.deleteMany()
      await prisma.bookingSlot.deleteMany()
      await prisma.bookingAttendee.deleteMany()
      await prisma.activityLog.deleteMany()

      // Verify sites and rooms are preserved
      const sitesAfterCleanup = await prisma.site.count()
      const roomsAfterCleanup = await prisma.room.count()

      expect(sitesAfterCleanup).toBe(sitesBeforeCleanup)
      expect(roomsAfterCleanup).toBe(roomsBeforeCleanup)
    })

    it('should handle cleanup in correct dependency order', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create booking with all relationships
      const booking = await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone),
      })

      await prisma.bookingAttendee.create({
        data: {
          bookingId: booking.id,
          userId: testUsers[1].id,
        },
      })

      await prisma.activityLog.create({
        data: {
          actorId: testUsers[0].id,
          action: 'BOOKING_CREATED',
          entityType: 'booking',
          entityId: booking.id,
          metadata: {},
        },
      })

      // Clean up in correct order - should not throw foreign key errors
      const cleanup = async () => {
        await prisma.$transaction(async (tx) => {
          // 1. Activity logs first (references bookings)
          await tx.activityLog.deleteMany()

          // 2. Booking slots (references bookings)
          await tx.bookingSlot.deleteMany()

          // 3. Booking attendees (references bookings)
          await tx.bookingAttendee.deleteMany()

          // 4. Bookings
          await tx.booking.deleteMany()
        })
      }

      await expect(cleanup()).resolves.not.toThrow()

      // Verify all data is cleaned
      const totalData = await prisma.$transaction(async (tx) => {
        const bookings = await tx.booking.count()
        const slots = await tx.bookingSlot.count()
        const attendees = await tx.bookingAttendee.count()
        const logs = await tx.activityLog.count()

        return { bookings, slots, attendees, logs }
      })

      expect(totalData.bookings).toBe(0)
      expect(totalData.slots).toBe(0)
      expect(totalData.attendees).toBe(0)
      expect(totalData.logs).toBe(0)
    })

    it('should be idempotent - running cleanup twice should be safe', async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create test booking
      await createTestBooking({
        roomId: room.id,
        ownerId: testUsers[0].id,
        startUtc: fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone),
        endUtc: fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone),
      })

      // First cleanup
      await cleanupUserBookings([testUsers[0].id])

      // Second cleanup - should not throw
      await expect(cleanupUserBookings([testUsers[0].id])).resolves.not.toThrow()

      // Verify no errors and correct state
      const bookings = await prisma.booking.count()
      expect(bookings).toBe(0)
    })
  })
})