/**
 * Integration tests for the Bookings API
 * Focus on coworking space constraints (operating hours, no overnight, etc.)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { POST, DELETE, GET } from '@/app/api/bookings/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { format, addDays } from 'date-fns';
import { localToUtc } from '@/core/time';

describe('Bookings API Integration Tests', () => {
  let testUser: any;
  let testRoom: any;
  let testSite: any;

  // Helper to create request with authentication
  function createRequest(
    method: string,
    body?: any,
    headers: Record<string, string> = {}
  ) {
    const url = new URL('http://localhost:3000/api/bookings');
    const init: any = {
      method,
      headers: {
        'x-user-id': testUser.id,
        ...headers,
      },
    };

    if (body) {
      init.body = JSON.stringify(body);
      init.headers['content-type'] = 'application/json';
    }

    return new NextRequest(url, init);
  }

  async function createBookingRequest(body: any) {
    const request = createRequest('POST', body);
    const response = await POST(request);
    return response.json();
  }

  beforeAll(async () => {
    console.log('[TEST SETUP] Setting up test data for bookings');

    // Create test user
    testUser = await prisma.user.upsert({
      where: { email: 'test-bookings@example.com' },
      update: {},
      create: {
        email: 'test-bookings@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        role: 'USER',
      },
    });

    // Get test site and room
    testSite = await prisma.site.findFirst({
      where: { name: 'San Francisco' },
    });

    testRoom = await prisma.room.findFirst({
      where: { siteId: testSite.id },
      include: { site: true },
    });

    console.log('[TEST SETUP] Test room:', testRoom.name, 'in', testSite.name);
  });

  afterAll(async () => {
    console.log('[TEST CLEANUP] Cleaning up test bookings');

    // Clean up test bookings
    await prisma.$transaction([
      prisma.bookingSlot.deleteMany({
        where: { booking: { ownerId: testUser.id } },
      }),
      prisma.bookingAttendee.deleteMany({
        where: { booking: { ownerId: testUser.id } },
      }),
      prisma.activityLog.deleteMany({
        where: { actorId: testUser.id },
      }),
      prisma.booking.deleteMany({
        where: { ownerId: testUser.id },
      }),
    ]);

    // Delete test user
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  beforeEach(async () => {
    // Clean up any existing bookings between tests
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
    ]);
  });

  describe('Successful Booking Creation', () => {
    it('should create a booking during operating hours', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:30`,
        attendees: [],
      });

      expect(data.booking).toBeDefined();
      expect(data.booking.id).toBeDefined();
      expect(data.booking.roomId).toBe(testRoom.id);

      // Verify booking was created in database
      const booking = await prisma.booking.findUnique({
        where: { id: data.booking.id },
        include: { slots: true },
      });

      expect(booking).toBeDefined();
      expect(booking!.slots).toHaveLength(3); // 10:00, 10:30, 11:00
    });

    it('should create a booking with attendees', async () => {
      // Create additional test users for attendees
      const attendee1 = await prisma.user.upsert({
        where: { email: 'attendee1@test.com' },
        create: {
          email: 'attendee1@test.com',
          name: 'Attendee 1',
          timezone: 'America/Los_Angeles',
        },
        update: {},
      });

      const attendee2 = await prisma.user.upsert({
        where: { email: 'attendee2@test.com' },
        create: {
          email: 'attendee2@test.com',
          name: 'Attendee 2',
          timezone: 'Europe/London',
        },
        update: {},
      });

      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T14:00`,
        endLocal: `${tomorrow}T15:00`,
        attendees: [attendee1.id, attendee2.id],
      });

      expect(data.booking.id).toBeDefined();

      // Verify attendees were added
      const attendees = await prisma.bookingAttendee.findMany({
        where: { bookingId: data.booking.id },
      });

      expect(attendees).toHaveLength(2);
      expect(attendees.map(a => a.userId).sort()).toEqual(
        [attendee1.id, attendee2.id].sort()
      );

      // Clean up test attendees
      await prisma.user.deleteMany({
        where: { id: { in: [attendee1.id, attendee2.id] } },
      });
    });

    it('should handle edge of operating hours', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Book right at opening (8:00) and right before closing (19:30-20:00)
      const morningBooking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T08:00`,
        endLocal: `${tomorrow}T08:30`,
      });

      const eveningBooking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T19:30`,
        endLocal: `${tomorrow}T20:00`,
      });

      expect(morningBooking.booking.id).toBeDefined();
      expect(eveningBooking.booking.id).toBeDefined();
    });
  });

  describe('Operating Hours Validation', () => {
    it('should reject booking outside operating hours', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Try to book after closing time (20:00)
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T20:30`,
        endLocal: `${tomorrow}T21:00`,
      });

      expect(data.error).toContain('outside of room opening hours');
    });

    it('should reject booking that spans closing time', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Try to book across closing time (19:00-21:00)
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T19:00`,
        endLocal: `${tomorrow}T21:00`,
      });

      expect(data.error).toContain('outside of room opening hours');
    });

    it('should reject overnight booking attempts', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const nextDay = format(addDays(new Date(), 2), 'yyyy-MM-dd');

      // Try to book across midnight
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T19:00`,
        endLocal: `${nextDay}T09:00`,
      });

      expect(data.error).toBeDefined();
      // This crosses day boundary which isn't supported
    });

    it('should reject booking before opening hours', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Try to book before 8:00 AM
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T06:00`,
        endLocal: `${tomorrow}T07:30`,
      });

      expect(data.error).toContain('outside of room opening hours');
    });
  });

  describe('Time Boundary Validation', () => {
    it('should reject non-30-minute aligned bookings', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Try 10:15 instead of 10:00 or 10:30
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:15`,
        endLocal: `${tomorrow}T11:00`,
      });

      expect(data.error).toContain('30-minute boundaries');
    });

    it('should reject bookings in the past', async () => {
      const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${yesterday}T10:00`,
        endLocal: `${yesterday}T11:00`,
      });

      expect(data.error).toContain('past');
    });

    it('should enforce maximum booking duration', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Try to book more than 8 hours
      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T08:00`,
        endLocal: `${tomorrow}T17:00`, // 9 hours
      });

      expect(data.error).toContain('maximum');
    });
  });

  describe('Conflict Detection', () => {
    it('should prevent double-booking the same slot', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // First booking should succeed
      const booking1 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      expect(booking1.booking.id).toBeDefined();

      // Second booking for same time should fail
      const booking2 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      expect(booking2.error).toContain('already booked');
    });

    it('should prevent overlapping bookings', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // First booking: 10:00-11:00
      const booking1 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      expect(booking1.booking.id).toBeDefined();

      // Try overlapping booking: 10:30-11:30
      const booking2 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:30`,
        endLocal: `${tomorrow}T11:30`,
      });

      expect(booking2.error).toContain('already booked');
    });

    it('should allow adjacent bookings', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // First booking: 10:00-11:00
      const booking1 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      expect(booking1.booking.id).toBeDefined();

      // Adjacent booking: 11:00-12:00 (should succeed)
      const booking2 = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T11:00`,
        endLocal: `${tomorrow}T12:00`,
      });

      expect(booking2.booking.id).toBeDefined();
      expect(booking2.error).toBeUndefined();
    });
  });

  describe('Attendee Validation', () => {
    it('should reject more than 3 attendees', async () => {
      // Create 4 test attendees
      const attendees = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          prisma.user.create({
            data: {
              email: `attendee${i}@test.com`,
              name: `Attendee ${i}`,
              timezone: 'America/New_York',
            },
          })
        )
      );

      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
        attendees: attendees.map(a => a.id),
      });

      expect(data.error).toContain('3 attendees');

      // Clean up
      await prisma.user.deleteMany({
        where: { id: { in: attendees.map(a => a.id) } },
      });
    });

    it('should reject non-existent attendee IDs', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const data = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
        attendees: ['non-existent-user-id'],
      });

      expect(data.error).toBeDefined();
    });
  });

  describe('Booking Cancellation', () => {
    it('should cancel future booking completely', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Create a booking
      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      expect(booking.booking.id).toBeDefined();

      // Cancel the booking
      const deleteUrl = new URL(`http://localhost:3000/api/bookings/${booking.booking.id}`);
      const deleteRequest = new NextRequest(deleteUrl, {
        method: 'DELETE',
        headers: {
          'x-user-id': testUser.id,
        },
      });

      // Import the DELETE handler from the dynamic route
      const { DELETE: deleteBooking } = await import('@/app/api/bookings/[id]/route');
      const response = await deleteBooking(deleteRequest, { params: { id: booking.id } });
      const result = await response.json();

      expect(result.message).toContain('canceled');

      // Verify booking is marked as canceled
      const canceledBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      expect(canceledBooking!.canceledAt).toBeDefined();

      // Verify all slots were freed
      const slots = await prisma.bookingSlot.findMany({
        where: { bookingId: booking.id },
      });

      expect(slots).toHaveLength(0);
    });

    it('should prevent non-owner from canceling', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Create a booking
      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@test.com',
          name: 'Other User',
          timezone: 'America/New_York',
        },
      });

      // Try to cancel as different user
      const deleteUrl = new URL(`http://localhost:3000/api/bookings/${booking.id}`);
      const deleteRequest = new NextRequest(deleteUrl, {
        method: 'DELETE',
        headers: {
          'x-user-id': otherUser.id,
        },
      });

      const { DELETE: deleteBooking } = await import('@/app/api/bookings/[id]/route');
      const response = await deleteBooking(deleteRequest, { params: { id: booking.id } });
      const result = await response.json();

      expect(result.error).toContain('authorized');

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('Activity Logging', () => {
    it('should create activity log on booking creation', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      const activity = await prisma.activityLog.findFirst({
        where: {
          entityId: booking.id,
          action: 'BOOKING_CREATED',
        },
      });

      expect(activity).toBeDefined();
      expect(activity!.actorId).toBe(testUser.id);
      expect(activity!.entityType).toBe('booking');
    });

    it('should create activity log on booking cancellation', async () => {
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      // Create and cancel a booking
      const booking = await createBookingRequest({
        roomId: testRoom.id,
        startLocal: `${tomorrow}T10:00`,
        endLocal: `${tomorrow}T11:00`,
      });

      const deleteUrl = new URL(`http://localhost:3000/api/bookings/${booking.id}`);
      const deleteRequest = new NextRequest(deleteUrl, {
        method: 'DELETE',
        headers: {
          'x-user-id': testUser.id,
        },
      });

      const { DELETE: deleteBooking } = await import('@/app/api/bookings/[id]/route');
      await deleteBooking(deleteRequest, { params: { id: booking.id } });

      const activity = await prisma.activityLog.findFirst({
        where: {
          entityId: booking.id,
          action: 'BOOKING_CANCELED',
        },
      });

      expect(activity).toBeDefined();
      expect(activity!.actorId).toBe(testUser.id);
    });
  });
});