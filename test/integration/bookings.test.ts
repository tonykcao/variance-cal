/**
 * Integration tests for the Bookings API
 * Focus on coworking space constraints (operating hours, no overnight, etc.)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { POST, DELETE, GET } from "@/app/api/bookings/route"
import { NextRequest } from "next/server"
import { getTestPrismaClient } from "../helpers/db"
import { createTestUser, createTestSite, createTestRoom, cleanDatabase, getUniqueTestId } from "../fixtures"
import { format, addDays } from "date-fns"
import { localToUtc } from "@/core/time"

const prisma = getTestPrismaClient()

describe("Bookings API Integration Tests", () => {
  let testUser: any
  let testRoom: any
  let testSite: any

  // Helper to create request with authentication
  function createRequest(method: string, body?: any, headers: Record<string, string> = {}) {
    const url = new URL("http://localhost:3000/api/bookings")
    const init: any = {
      method,
      headers: {
        "x-user-id": testUser.id,
        ...headers,
      },
    }

    if (body) {
      init.body = JSON.stringify(body)
      init.headers["content-type"] = "application/json"
    }

    return new NextRequest(url, init)
  }

  async function createBookingRequest(body: any) {
    const request = createRequest("POST", body)
    const response = await POST(request)
    return response.json()
  }

  beforeAll(async () => {
    console.log("[TEST SETUP] Setting up test data for bookings")

    // Clean database and create fresh test data
    await cleanDatabase()

    const testId = getUniqueTestId()

    // Create test user
    testUser = await createTestUser({
      email: `test-bookings_${testId}@example.com`,
      name: `Test User ${testId}`,
      timezone: "America/New_York",
      role: "USER",
    })

    // Create test site
    testSite = await createTestSite({
      name: `San Francisco ${testId}`,
      timezone: "America/Los_Angeles",
    })

    // Create test room
    testRoom = await createTestRoom({
      siteId: testSite.id,
      name: `Oak ${testId}`,
      capacity: 6,
      opening: {
        mon: { open: "08:00", close: "20:00" },
        tue: { open: "08:00", close: "20:00" },
        wed: { open: "08:00", close: "20:00" },
        thu: { open: "08:00", close: "20:00" },
        fri: { open: "08:00", close: "20:00" },
        sat: { open: "10:00", close: "18:00" },
        sun: { open: "10:00", close: "18:00" },
      },
    })

    // Refetch room with site included
    testRoom = await prisma.room.findUnique({
      where: { id: testRoom.id },
      include: { site: true },
    })

    console.log("[TEST SETUP] Test room:", testRoom.name, "in", testSite.name)
  })

  afterAll(async () => {
    console.log("[TEST CLEANUP] Cleaning up test bookings")
    await cleanDatabase()
  })

  beforeEach(async () => {
    // Clean up any existing bookings between tests
    if (testUser?.id) {
      await prisma.$transaction([
        prisma.bookingSlot.deleteMany({
          where: { booking: { ownerId: testUser.id } },
        }),
        prisma.bookingAttendee.deleteMany({
          where: { booking: { ownerId: testUser.id } },
        }),
        prisma.booking.deleteMany({
          where: { ownerId: testUser.id },
        }),
      ])
    }
  })

  describe("Successful Booking Creation", () => {
    it("should create a booking during operating hours", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:30`,
        attendees: [],
      })

      expect(data.booking).toBeDefined()
      expect(data.booking.id).toBeDefined()
      expect(data.booking.roomId).toBe(testRoom.id)

      // Verify booking was created in database
      const booking = await prisma.booking.findUnique({
        where: { id: data.booking.id },
        include: { slots: true },
      })

      expect(booking).toBeDefined()
      expect(booking!.slots).toHaveLength(3) // 10:00, 10:30, 11:00
    })

    it("should create a booking with attendees", async () => {
      // Use unique emails for test attendees
      const testId = getUniqueTestId()
      const attendee1Email = `attendee1_${testId}@test.com`
      const attendee2Email = `attendee2_${testId}@test.com`

      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T14:00`,
        endLocal: `${tomorrow}T15:00`,
        attendees: [attendee1Email, attendee2Email], // Pass emails, not IDs
      })

      expect(data.booking.id).toBeDefined()

      // Verify attendees were added
      const attendees = await prisma.bookingAttendee.findMany({
        where: { bookingId: data.booking.id },
        include: { user: true }
      })

      expect(attendees).toHaveLength(2)

      // Verify the attendee emails match what we requested
      const attendeeEmails = attendees.map(a => a.user.email).sort()
      expect(attendeeEmails).toEqual([attendee1Email, attendee2Email].sort())

      // Clean up test attendees - delete attendee relationships first, then users
      const attendeeIds = attendees.map(a => a.userId)

      // Delete attendee relationships first
      await prisma.bookingAttendee.deleteMany({
        where: { bookingId: data.booking.id }
      })

      // Delete the auto-created users
      await prisma.user.deleteMany({
        where: { id: { in: attendeeIds } },
      })
    })

    it("should handle edge of operating hours", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Book right at opening (8:00) and right before closing (19:30-20:00)
      const morningBooking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T08:00`,
        endLocal: `${tomorrow}T08:30`,
      })

      const eveningBooking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T19:30`,
        endLocal: `${tomorrow}T20:00`,
      })

      expect(morningBooking.booking.id).toBeDefined()
      expect(eveningBooking.booking.id).toBeDefined()
    })
  })

  describe("Operating Hours Validation", () => {
    it("should reject booking outside operating hours", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Try to book after closing time (20:00)
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T20:30`,
        endLocal: `${tomorrow}T21:00`,
      })

      expect(data.error).toContain("outside of room opening hours")
    })

    it("should reject booking that spans closing time", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Try to book across closing time (19:00-21:00)
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T19:00`,
        endLocal: `${tomorrow}T21:00`,
      })

      expect(data.error).toContain("outside of room opening hours")
    })

    it("should reject overnight booking attempts", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")
      const nextDay = format(addDays(new Date(), 2), "yyyy-MM-dd")

      // Try to book across midnight
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T19:00`,
        endLocal: `${nextDay}T09:00`,
      })

      expect(data.error).toBeDefined()
      // This crosses day boundary which isn't supported
    })

    it("should reject booking before opening hours", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Try to book before 8:00 AM
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T06:00`,
        endLocal: `${tomorrow}T07:30`,
      })

      expect(data.error).toContain("outside of room opening hours")
    })
  })

  describe("Time Boundary Validation", () => {
    it("should reject non-30-minute aligned bookings", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Try 10:15 instead of 10:00 or 10:30
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:15`,
        endLocal: `${tomorrow}T11:00`,
      })

      expect(data.error).toContain("30-minute boundaries")
    })

    it("should reject bookings in the past", async () => {
      const yesterday = format(addDays(new Date(), -1), "yyyy-MM-dd")

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${yesterday}T10:00`,
        endLocal: `${yesterday}T11:00`,
      })

      expect(data.error).toContain("past")
    })

    it("should enforce maximum booking duration", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Try to book more than 8 hours
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T08:00`,
        endLocal: `${tomorrow}T17:00`, // 9 hours
      })

      expect(data.error).toContain("Booking duration cannot exceed 8 hours")
    })
  })

  describe("Conflict Detection", () => {
    it("should prevent double-booking the same slot", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // First booking should succeed
      const booking1 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      expect(booking1.booking.id).toBeDefined()

      // Second booking for same time should fail
      const booking2 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      expect(booking2.error).toContain("already booked")
    })

    it("should prevent overlapping bookings", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // First booking: 10:00-11:00
      const booking1 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      expect(booking1.booking.id).toBeDefined()

      // Try overlapping booking: 10:30-11:30
      const booking2 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:30`,
        endLocal: `${tomorrow}T11:30`,
      })

      expect(booking2.error).toContain("already booked")
    })

    it("should allow adjacent bookings", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // First booking: 10:00-11:00
      const booking1 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      expect(booking1.booking.id).toBeDefined()

      // Adjacent booking: 11:00-12:00 (should succeed)
      const booking2 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T11:00`,
        endLocal: `${tomorrow}T12:00`,
      })

      expect(booking2.booking.id).toBeDefined()
      expect(booking2.error).toBeUndefined()
    })
  })

  describe("Attendee Validation", () => {
    it("should reject more than 3 attendees", async () => {
      const testId = getUniqueTestId()
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Try to add 4 attendees (exceeds limit of 3)
      const attendeeEmails = [
        `attendee1_${testId}@test.com`,
        `attendee2_${testId}@test.com`,
        `attendee3_${testId}@test.com`,
        `attendee4_${testId}@test.com`,
      ]

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
        attendees: attendeeEmails,
      })

      expect(data.details?.fieldErrors?.attendees?.[0]).toContain("Maximum 3 attendees allowed")
    })

    it("should auto-create users for unknown emails", async () => {
      const testId = getUniqueTestId()
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      const newEmails = [`new_user_${testId}@test.com`]

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
        attendees: newEmails,
      })

      // Should succeed and auto-create the user
      expect(data.booking).toBeDefined()
      expect(data.booking.attendees).toHaveLength(1)
      expect(data.booking.attendees[0].email).toBe(newEmails[0])

      // Clean up auto-created user (delete attendees first to avoid foreign key issues)
      await prisma.bookingAttendee.deleteMany({
        where: { bookingId: data.booking.id }
      })
      await prisma.user.deleteMany({
        where: { email: { in: newEmails } },
      })
    })
  })

  describe("Booking Cancellation", () => {
    it("should cancel future booking completely", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Create a booking
      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      expect(booking.booking.id).toBeDefined()

      // Cancel the booking
      const deleteUrl = new URL(`http://localhost:3000/api/bookings/${booking.booking.id}`)
      const deleteRequest = new NextRequest(deleteUrl, {
        method: "DELETE",
        headers: {
          "x-user-id": testUser.id,
        },
      })

      // Import the DELETE handler from the dynamic route
      const { DELETE: deleteBooking } = await import("@/app/api/bookings/[id]/route")
      const response = await deleteBooking(deleteRequest, { params: Promise.resolve({ id: booking.booking.id }) })
      const result = await response.json()

      expect(result.message).toContain("canceled")

      // Verify booking is marked as canceled
      const canceledBooking = await prisma.booking.findUnique({
        where: { id: booking.booking.id },
      })

      expect(canceledBooking!.canceledAt).toBeDefined()

      // Verify all slots were freed
      const slots = await prisma.bookingSlot.findMany({
        where: { bookingId: booking.booking.id },
      })

      expect(slots).toHaveLength(0)
    })

    it("should prevent non-owner from canceling", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Create a booking
      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: "other@test.com",
          name: "Other User",
          timezone: "America/New_York",
        },
      })

      // Try to cancel as different user
      const deleteUrl = new URL(`http://localhost:3000/api/bookings/${booking.id}`)
      const deleteRequest = new NextRequest(deleteUrl, {
        method: "DELETE",
        headers: {
          "x-user-id": otherUser.id,
        },
      })

      const { DELETE: deleteBooking } = await import("@/app/api/bookings/[id]/route")
      const response = await deleteBooking(deleteRequest, { params: Promise.resolve({ id: booking.booking.id }) })
      const result = await response.json()

      expect(result.error).toContain("permission")

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })

  describe("Activity Logging", () => {
    it("should create activity log on booking creation", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      const activity = await prisma.activityLog.findFirst({
        where: {
          entityId: booking.id,
          action: "BOOKING_CREATED",
        },
      })

      expect(activity).toBeDefined()
      expect(activity!.actorId).toBe(testUser.id)
      expect(activity!.entityType).toBe("booking")
    })

    it("should create activity log on booking cancellation", async () => {
      const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd")

      // Create and cancel a booking
      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      })

      const deleteUrl = new URL(`http://localhost:3000/api/bookings/${booking.booking.id}`)
      const deleteRequest = new NextRequest(deleteUrl, {
        method: "DELETE",
        headers: {
          "x-user-id": testUser.id,
        },
      })

      const { DELETE: deleteBooking } = await import("@/app/api/bookings/[id]/route")
      await deleteBooking(deleteRequest, { params: Promise.resolve({ id: booking.booking.id }) })

      const activity = await prisma.activityLog.findFirst({
        where: {
          entityId: booking.booking.id,
          action: "BOOKING_CANCELED",
        },
      })

      expect(activity).toBeDefined()
      expect(activity!.actorId).toBe(testUser.id)
    })
  })
})
