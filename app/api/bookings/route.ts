/**
 * Bookings API endpoint
 * POST /api/bookings - Create a booking
 * GET /api/bookings - List user bookings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBookingSchema } from '@/schemas/booking';
import { getRoomById } from '@/data/rooms';
import { createBooking, getUserBookings } from '@/data/bookings';
import {
  localToUtc,
  snapTo30,
  enumerateSlots,
  formatInTimezone
} from '@/core/time';
import { isWithinOpeningHours } from '@/core/opening-hours';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';

/**
 * Create a new booking
 */
export async function POST(request: NextRequest) {
  try {
    // Debug logging
    const cookieHeader = request.headers.get('cookie');
    console.log('[POST /api/bookings] Cookie header:', cookieHeader);

    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      console.log('[POST /api/bookings] No user found, returning 401');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[POST /api/bookings] User authenticated:', currentUser.name);
    const body = await request.json();

    // Validate input
    const validationResult = createBookingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Get room details
    const room = await getRoomById(input.roomId);

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Convert local times to UTC
    const timezone = room.site.timezone;

    // Convert the input strings directly to UTC (they're already in the room's local time)
    const startUtc = localToUtc(input.startLocal, timezone);
    const endUtc = localToUtc(input.endLocal, timezone);

    // Snap to 30-minute boundaries
    const startUtcSnapped = snapTo30(startUtc, 'floor');
    const endUtcSnapped = snapTo30(endUtc, 'ceil');

    // Validate time range
    if (endUtcSnapped <= startUtcSnapped) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Check if within opening hours
    if (!isWithinOpeningHours(startUtcSnapped, endUtcSnapped, room.opening, timezone)) {
      return NextResponse.json(
        { error: 'Booking is outside of room opening hours' },
        { status: 400 }
      );
    }

    // Check if booking is in the past
    const now = new Date();
    if (startUtcSnapped < now) {
      return NextResponse.json(
        { error: 'Cannot book in the past' },
        { status: 400 }
      );
    }

    // Enumerate slots
    const slots = enumerateSlots(startUtcSnapped, endUtcSnapped);

    // Convert attendee emails to user IDs (create users if they don't exist)
    let attendeeIds: string[] = [];
    if (input.attendees && input.attendees.length > 0) {
      // Look up users by email
      const existingUsers = await prisma.user.findMany({
        where: {
          email: {
            in: input.attendees
          }
        },
        select: {
          id: true,
          email: true,
        }
      });

      // Find emails that don't have users yet
      const existingEmails = existingUsers.map(u => u.email);
      const newEmails = input.attendees.filter((email: string) => !existingEmails.includes(email));

      // Create new users for emails that don't exist
      const newUsers = [];
      for (const email of newEmails) {
        // Extract name from email (e.g., john.doe@example.com -> john-doe)
        const nameFromEmail = email.split('@')[0].replace(/[._]/g, '-').toLowerCase();

        const newUser = await prisma.user.create({
          data: {
            email,
            name: nameFromEmail,
            timezone: 'America/Los_Angeles', // Default timezone
            role: 'USER',
          },
          select: {
            id: true,
            email: true,
          }
        });
        newUsers.push(newUser);
        console.log(`[POST /api/bookings] Created new user for attendee: ${email} (${nameFromEmail})`);
      }

      // Combine existing and new users
      const allUsers = [...existingUsers, ...newUsers];
      attendeeIds = allUsers.map(u => u.id);
    }

    // Create the booking
    const result = await createBooking({
      roomId: room.id,
      ownerId: currentUser.id,
      startUtc: startUtcSnapped,
      endUtc: endUtcSnapped,
      slots,
      attendeeIds,
      notes: input.notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 409 } // Conflict
      );
    }

    return NextResponse.json({
      booking: {
        id: result.booking!.id,
        roomId: result.booking!.roomId,
        roomName: result.booking!.room.name,
        siteName: result.booking!.room.site.name,
        timezone: result.booking!.room.site.timezone,
        startUtc: result.booking!.startUtc.toISOString(),
        endUtc: result.booking!.endUtc.toISOString(),
        startLocal: formatInTimezone(result.booking!.startUtc, timezone, 'yyyy-MM-dd HH:mm'),
        endLocal: formatInTimezone(result.booking!.endUtc, timezone, 'yyyy-MM-dd HH:mm'),
        owner: {
          id: result.booking!.owner.id,
          name: result.booking!.owner.name,
          email: result.booking!.owner.email,
        },
        attendees: result.booking!.attendees.map(a => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
      },
    });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}

/**
 * Get user bookings
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope') as 'upcoming' | 'past' || 'upcoming';

    const bookings = await getUserBookings(currentUser.id, scope);

    // Format bookings for response
    const formattedBookings = bookings.map(booking => {
      // Determine if current user can see notes
      const isOwner = booking.ownerId === currentUser.id;
      const isAttendee = booking.attendees.some(a => a.userId === currentUser.id);
      const isAdmin = currentUser.role === 'ADMIN';
      const canSeeNotes = isOwner || isAttendee || isAdmin;

      return {
        id: booking.id,
        roomId: booking.roomId,
        roomName: booking.room.name,
        siteName: booking.room.site.name,
        timezone: booking.room.site.timezone,
        startUtc: booking.startUtc.toISOString(),
        endUtc: booking.endUtc.toISOString(),
        startLocal: formatInTimezone(booking.startUtc, booking.room.site.timezone, 'yyyy-MM-dd HH:mm'),
        endLocal: formatInTimezone(booking.endUtc, booking.room.site.timezone, 'yyyy-MM-dd HH:mm'),
        isOwner,
        isAttendee,
        owner: {
          id: booking.owner.id,
          name: booking.owner.name,
          email: booking.owner.email,
        },
        attendees: booking.attendees.map(a => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
        canceledAt: booking.canceledAt,
        notes: canSeeNotes ? booking.notes : undefined,
      };
    });

    return NextResponse.json({
      bookings: formattedBookings,
      scope,
      currentUser: {
        id: currentUser.id,
        name: currentUser.name,
        role: currentUser.role,
      },
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}