/**
 * Individual booking API endpoint
 * GET /api/bookings/[id] - Get booking details
 * DELETE /api/bookings/[id] - Cancel booking
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBookingById, cancelBooking, canUserModifyBooking } from '@/data/bookings';
import { getCurrentUser } from '@/lib/auth/current-user';
import { formatInTimezone } from '@/core/time';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Get booking details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const booking = await getBookingById(id);

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Check if user can view this booking (owner, attendee, or admin)
    const isOwner = booking.ownerId === currentUser.id;
    const isAttendee = booking.attendees.some(a => a.userId === currentUser.id);
    const isAdmin = currentUser.role === 'ADMIN';

    if (!isOwner && !isAttendee && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const timezone = booking.room.site.timezone;

    return NextResponse.json({
      booking: {
        id: booking.id,
        roomId: booking.roomId,
        roomName: booking.room.name,
        siteName: booking.room.site.name,
        timezone,
        startUtc: booking.startUtc.toISOString(),
        endUtc: booking.endUtc.toISOString(),
        startLocal: formatInTimezone(booking.startUtc, timezone, 'yyyy-MM-dd HH:mm'),
        endLocal: formatInTimezone(booking.endUtc, timezone, 'yyyy-MM-dd HH:mm'),
        isOwner,
        canModify: await canUserModifyBooking(id, currentUser.id, currentUser.role),
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
        slots: booking.slots.map(s => s.slotStartUtc.toISOString()),
        canceledAt: booking.canceledAt,
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    console.error('Get booking error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch booking' },
      { status: 500 }
    );
  }
}

/**
 * Cancel a booking
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user can cancel this booking
    const canModify = await canUserModifyBooking(
      id,
      currentUser.id,
      currentUser.role
    );

    if (!canModify) {
      return NextResponse.json(
        { error: 'You do not have permission to cancel this booking' },
        { status: 403 }
      );
    }

    // Cancel the booking
    const result = await cancelBooking(id, currentUser.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Booking canceled. Remaining time freed for others.',
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}