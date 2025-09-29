import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { createTestUser, createTestSite, createTestRoom, cleanDatabase, getUniqueTestId } from "../fixtures"
import { addDays, setHours, setMinutes } from "date-fns"
import { fromZonedTime } from "date-fns-tz"
import { getTestPrismaClient } from "../helpers/db"

const prisma = getTestPrismaClient()

describe("Concurrency Integration Tests", () => {
  let users: any[] = []
  let site: any
  let room: any

  beforeEach(async () => {
    await cleanDatabase()

    // Use unique IDs to avoid conflicts
    const testId = getUniqueTestId()

    // Create test users with unique emails
    users = await Promise.all([
      createTestUser({
        email: `user1_${testId}@test.com`,
        name: `User 1 ${testId}`,
        role: "USER",
        timezone: "America/New_York",
      }),
      createTestUser({
        email: `user2_${testId}@test.com`,
        name: `User 2 ${testId}`,
        role: "USER",
        timezone: "America/New_York",
      }),
      createTestUser({
        email: `user3_${testId}@test.com`,
        name: `User 3 ${testId}`,
        role: "USER",
        timezone: "America/New_York",
      }),
      createTestUser({
        email: `admin_${testId}@test.com`,
        name: `Admin ${testId}`,
        role: "ADMIN",
        timezone: "America/New_York",
      }),
    ])

    // Create test site and room with unique names
    site = await createTestSite({
      name: `Test Site ${testId}`,
      timezone: "America/New_York",
    })

    room = await createTestRoom({
      siteId: site.id,
      name: `Conference Room ${testId}`,
      capacity: 10,
    })
  })

  afterEach(async () => {
    await cleanDatabase()
    // Don't disconnect shared client
  })

  describe("Double-Booking Prevention", () => {
    it("should prevent double-booking when multiple users book simultaneously", async () => {
      const tomorrow = addDays(new Date(), 1)
      const startTime = setMinutes(setHours(tomorrow, 14), 0)
      const endTime = setMinutes(setHours(tomorrow, 15), 30)

      const startUtc = fromZonedTime(startTime, site.timezone)
      const endUtc = fromZonedTime(endTime, site.timezone)

      // Calculate slots
      const slots = []
      let currentSlot = new Date(startUtc)
      while (currentSlot < endUtc) {
        slots.push(new Date(currentSlot))
        currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000)
      }

      // Simulate concurrent booking attempts
      const bookingPromises = users.slice(0, 3).map(user =>
        prisma
          .$transaction(async tx => {
            // Create booking
            const booking = await tx.booking.create({
              data: {
                roomId: room.id,
                ownerId: user.id,
                startUtc,
                endUtc,
              },
            })

            // Create slots - this will fail for duplicates
            await tx.bookingSlot.createMany({
              data: slots.map(slotStartUtc => ({
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc,
              })),
            })

            // Log success
            await tx.activityLog.create({
              data: {
                actorId: user.id,
                action: "BOOKING_CREATED",
                entityType: "booking",
                entityId: booking.id,
                metadata: { concurrent: true },
              },
            })

            return { success: true, booking }
          })
          .catch(error => {
            return { success: false, error: (error as Error).message }
          })
      )

      const results = await Promise.all(bookingPromises)

      // Exactly one should succeed
      const successes = results.filter(r => r.success)
      const failures = results.filter(r => !r.success)

      expect(successes).toHaveLength(1)
      expect(failures).toHaveLength(2)

      // Verify database state
      const bookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          startUtc,
          endUtc,
          canceledAt: null,
        },
      })

      expect(bookings).toHaveLength(1)
    })

    it("should handle rapid sequential booking attempts", async () => {
      const tomorrow = addDays(new Date(), 1)
      const results = []

      // Attempt bookings for different time slots rapidly
      for (let hour = 9; hour < 17; hour++) {
        const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 0), site.timezone)
        const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 30), site.timezone)

        const userIndex = (hour - 9) % 3

        try {
          const booking = await prisma.$transaction(async tx => {
            const booking = await tx.booking.create({
              data: {
                roomId: room.id,
                ownerId: users[userIndex].id,
                startUtc,
                endUtc,
              },
            })

            await tx.bookingSlot.create({
              data: {
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: startUtc,
              },
            })

            return booking
          })

          results.push({ hour, success: true, bookingId: booking.id })
        } catch (error) {
          results.push({ hour, success: false, error: (error as Error).message })
        }
      }

      // All should succeed as they're different time slots
      const successes = results.filter(r => r.success)
      expect(successes).toHaveLength(8) // 9-17 = 8 hours
    })
  })

  describe("Concurrent Cancellations", () => {
    it("should handle concurrent cancellation attempts gracefully", async () => {
      // Create a booking
      const tomorrow = addDays(new Date(), 1)
      const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone)
      const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone)

      const booking = await prisma.$transaction(async tx => {
        const booking = await tx.booking.create({
          data: {
            roomId: room.id,
            ownerId: users[0].id,
            startUtc,
            endUtc,
          },
        })

        await tx.bookingSlot.createMany({
          data: [
            { bookingId: booking.id, roomId: room.id, slotStartUtc: startUtc },
            {
              bookingId: booking.id,
              roomId: room.id,
              slotStartUtc: new Date(startUtc.getTime() + 30 * 60 * 1000),
            },
          ],
        })

        return booking
      })

      // Multiple users try to cancel simultaneously
      const cancellationPromises = [users[0], users[3]].map(user =>
        prisma
          .$transaction(async tx => {
            // Check if already cancelled
            const currentBooking = await tx.booking.findUnique({
              where: { id: booking.id },
            })

            if (currentBooking?.canceledAt) {
              return { success: false, reason: "Already cancelled" }
            }

            // Cancel booking
            const cancelled = await tx.booking.update({
              where: { id: booking.id },
              data: { canceledAt: new Date() },
            })

            // Delete future slots
            await tx.bookingSlot.deleteMany({
              where: {
                bookingId: booking.id,
                slotStartUtc: { gte: new Date() },
              },
            })

            return { success: true, cancelled }
          })
          .catch(error => {
            return { success: false, error: (error as Error).message }
          })
      )

      const results = await Promise.all(cancellationPromises)

      // At least one should succeed (both might succeed if they run sequentially fast enough)
      const successes = results.filter(r => r.success)
      expect(successes.length).toBeGreaterThanOrEqual(1)
      expect(successes.length).toBeLessThanOrEqual(2)

      // Verify booking is cancelled
      const cancelledBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      })
      expect(cancelledBooking?.canceledAt).toBeTruthy()
    })
  })

  describe("Boundary Slot Conflicts", () => {
    it("should handle adjacent bookings without conflicts", async () => {
      const tomorrow = addDays(new Date(), 1)

      // Create adjacent bookings
      const bookingPromises = []
      for (let hour = 9; hour < 12; hour++) {
        const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 0), site.timezone)
        const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour + 1), 0), site.timezone)

        bookingPromises.push(
          prisma.$transaction(async tx => {
            const booking = await tx.booking.create({
              data: {
                roomId: room.id,
                ownerId: users[hour - 9].id,
                startUtc,
                endUtc,
              },
            })

            // Create 2 slots for 1-hour booking
            const slots = []
            let slotTime = new Date(startUtc)
            while (slotTime < endUtc) {
              slots.push({
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: new Date(slotTime),
              })
              slotTime = new Date(slotTime.getTime() + 30 * 60 * 1000)
            }

            await tx.bookingSlot.createMany({ data: slots })
            return booking
          })
        )
      }

      const bookings = await Promise.all(bookingPromises)

      // All should succeed
      expect(bookings).toHaveLength(3)

      // Verify no overlaps in database
      const allSlots = await prisma.bookingSlot.findMany({
        where: { roomId: room.id },
        orderBy: { slotStartUtc: "asc" },
      })

      // Check for duplicates
      const slotTimes = allSlots.map(s => s.slotStartUtc.getTime())
      const uniqueSlotTimes = [...new Set(slotTimes)]
      expect(slotTimes).toHaveLength(uniqueSlotTimes.length)
    })

    it("should detect and prevent overlapping bookings", async () => {
      const tomorrow = addDays(new Date(), 1)

      // First booking: 10:00-11:30
      const booking1Start = fromZonedTime(setMinutes(setHours(tomorrow, 10), 0), site.timezone)
      const booking1End = fromZonedTime(setMinutes(setHours(tomorrow, 11), 30), site.timezone)

      await prisma.$transaction(async tx => {
        const booking = await tx.booking.create({
          data: {
            roomId: room.id,
            ownerId: users[0].id,
            startUtc: booking1Start,
            endUtc: booking1End,
          },
        })

        const slots = []
        let slotTime = new Date(booking1Start)
        while (slotTime < booking1End) {
          slots.push({
            bookingId: booking.id,
            roomId: room.id,
            slotStartUtc: new Date(slotTime),
          })
          slotTime = new Date(slotTime.getTime() + 30 * 60 * 1000)
        }

        await tx.bookingSlot.createMany({ data: slots })
      })

      // Attempt overlapping booking: 11:00-12:00
      const booking2Start = fromZonedTime(setMinutes(setHours(tomorrow, 11), 0), site.timezone)
      const booking2End = fromZonedTime(setMinutes(setHours(tomorrow, 12), 0), site.timezone)

      const attemptOverlap = prisma.$transaction(async tx => {
        const booking = await tx.booking.create({
          data: {
            roomId: room.id,
            ownerId: users[1].id,
            startUtc: booking2Start,
            endUtc: booking2End,
          },
        })

        // This should fail due to unique constraint
        await tx.bookingSlot.create({
          data: {
            bookingId: booking.id,
            roomId: room.id,
            slotStartUtc: booking2Start, // 11:00 slot already taken
          },
        })

        return booking
      })

      await expect(attemptOverlap).rejects.toThrow()
    })
  })

  describe("Transaction Rollback", () => {
    it("should rollback entire transaction on slot conflict", async () => {
      const tomorrow = addDays(new Date(), 1)
      const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, 15), 0), site.timezone)
      const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, 16), 0), site.timezone)

      // Create first booking successfully
      const firstBooking = await prisma.$transaction(async tx => {
        const booking = await tx.booking.create({
          data: {
            roomId: room.id,
            ownerId: users[0].id,
            startUtc,
            endUtc,
          },
        })

        await tx.bookingSlot.createMany({
          data: [
            { bookingId: booking.id, roomId: room.id, slotStartUtc: startUtc },
            {
              bookingId: booking.id,
              roomId: room.id,
              slotStartUtc: new Date(startUtc.getTime() + 30 * 60 * 1000),
            },
          ],
        })

        return booking
      })

      expect(firstBooking).toBeTruthy()

      // Attempt second booking that should fail and rollback
      let bookingIdBeforeRollback: string | null = null

      try {
        await prisma.$transaction(async tx => {
          const booking = await tx.booking.create({
            data: {
              roomId: room.id,
              ownerId: users[1].id,
              startUtc,
              endUtc,
            },
          })

          bookingIdBeforeRollback = booking.id

          // This should fail due to unique constraint
          await tx.bookingSlot.createMany({
            data: [
              { bookingId: booking.id, roomId: room.id, slotStartUtc: startUtc },
              {
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: new Date(startUtc.getTime() + 30 * 60 * 1000),
              },
            ],
          })

          return booking
        })
      } catch (error) {
        // Transaction should have rolled back
      }

      // Verify no orphaned booking exists
      if (bookingIdBeforeRollback) {
        const orphanedBooking = await prisma.booking.findUnique({
          where: { id: bookingIdBeforeRollback },
        })
        expect(orphanedBooking).toBeNull()
      }

      // Verify only first booking exists
      const bookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          startUtc,
          endUtc,
        },
      })

      expect(bookings).toHaveLength(1)
      expect(bookings[0].id).toBe(firstBooking.id)
    })
  })

  describe("High Concurrency Simulation", () => {
    it("should handle 10 concurrent booking attempts for different slots", async () => {
      const tomorrow = addDays(new Date(), 1)
      const bookingPromises = []

      // 10 users trying to book 10 different time slots
      for (let i = 0; i < 10; i++) {
        const hour = 8 + i
        const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 0), site.timezone)
        const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 30), site.timezone)

        // Create more users if needed
        if (i >= users.length) {
          const user = await createTestUser({
            email: `user${i + 1}@test.com`,
            name: `User ${i + 1}`,
            role: "USER",
            timezone: "America/New_York",
          })
          users.push(user)
        }

        bookingPromises.push(
          prisma.$transaction(async tx => {
            const booking = await tx.booking.create({
              data: {
                roomId: room.id,
                ownerId: users[i].id,
                startUtc,
                endUtc,
              },
            })

            await tx.bookingSlot.create({
              data: {
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: startUtc,
              },
            })

            return booking
          })
        )
      }

      const bookings = await Promise.all(bookingPromises)

      // All should succeed as they're different slots
      expect(bookings).toHaveLength(10)

      // Verify database integrity
      const totalBookings = await prisma.booking.count({
        where: {
          roomId: room.id,
          canceledAt: null,
        },
      })

      expect(totalBookings).toBe(10)

      // Verify no duplicate slots
      const slots = await prisma.bookingSlot.groupBy({
        by: ["slotStartUtc"],
        where: { roomId: room.id },
        _count: true,
      })

      slots.forEach(slot => {
        expect(slot._count).toBe(1)
      })
    })

    it("should maintain data integrity under mixed operations", async () => {
      const tomorrow = addDays(new Date(), 1)
      const operations = []

      // Create some initial bookings
      for (let hour = 9; hour < 12; hour++) {
        const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 0), site.timezone)
        const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, hour), 30), site.timezone)

        const booking = await prisma.$transaction(async tx => {
          const booking = await tx.booking.create({
            data: {
              roomId: room.id,
              ownerId: users[hour - 9].id,
              startUtc,
              endUtc,
            },
          })

          await tx.bookingSlot.create({
            data: {
              bookingId: booking.id,
              roomId: room.id,
              slotStartUtc: startUtc,
            },
          })

          return booking
        })

        operations.push({ type: "create", booking })
      }

      // Mix of operations: create, cancel, query
      const mixedOps = []

      // New booking attempt
      mixedOps.push(
        prisma.$transaction(async tx => {
          const startUtc = fromZonedTime(setMinutes(setHours(tomorrow, 13), 0), site.timezone)
          const endUtc = fromZonedTime(setMinutes(setHours(tomorrow, 14), 0), site.timezone)

          const booking = await tx.booking.create({
            data: {
              roomId: room.id,
              ownerId: users[0].id,
              startUtc,
              endUtc,
            },
          })

          await tx.bookingSlot.createMany({
            data: [
              { bookingId: booking.id, roomId: room.id, slotStartUtc: startUtc },
              {
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: new Date(startUtc.getTime() + 30 * 60 * 1000),
              },
            ],
          })

          return { type: "create", success: true }
        })
      )

      // Cancellation
      mixedOps.push(
        prisma.booking
          .update({
            where: { id: operations[0].booking.id },
            data: { canceledAt: new Date() },
          })
          .then(() => ({ type: "cancel", success: true }))
      )

      // Query availability
      mixedOps.push(
        prisma.bookingSlot
          .findMany({
            where: {
              roomId: room.id,
              slotStartUtc: {
                gte: fromZonedTime(setMinutes(setHours(tomorrow, 8), 0), site.timezone),
                lte: fromZonedTime(setMinutes(setHours(tomorrow, 18), 0), site.timezone),
              },
            },
          })
          .then(slots => ({ type: "query", count: slots.length }))
      )

      const results = await Promise.all(mixedOps)

      // Verify all operations completed
      expect(results).toHaveLength(3)
      expect(results[0]).toHaveProperty("success", true)
      expect(results[1]).toHaveProperty("success", true)
      expect(results[2]).toHaveProperty("count")

      // Verify final state
      const finalBookings = await prisma.booking.findMany({
        where: {
          roomId: room.id,
          canceledAt: null,
        },
      })

      // 3 initial - 1 cancelled + 1 new = 3
      expect(finalBookings).toHaveLength(3)
    })
  })
})
