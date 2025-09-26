/**
 * Rooms API endpoint
 * GET /api/rooms - List all rooms
 * POST /api/rooms - Create new room (admin only)
 * PUT /api/rooms - Update room (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllRooms } from '@/data/rooms';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createRoomSchema, updateRoomSchema } from '@/schemas/room';
import { prisma } from '@/lib/db';
import { analyzeOpeningHoursChange, applyOpeningHoursChange } from '@/core/opening-hours-conflicts';

/**
 * Get all rooms
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');

    let rooms = await getAllRooms();

    // Filter by site if specified
    if (siteId) {
      rooms = rooms.filter(room => room.siteId === siteId);
    }

    return NextResponse.json({
      rooms: rooms.map(room => ({
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        siteId: room.siteId,
        siteName: room.site.name,
        timezone: room.site.timezone,
        opening: room.opening,
      })),
    });
  } catch (error) {
    console.error('Rooms API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

/**
 * Create a new room (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = createRoomSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Check if site exists
    const site = await prisma.site.findUnique({
      where: { id: input.siteId },
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // Check if room name already exists in this site
    const existingRoom = await prisma.room.findFirst({
      where: {
        name: input.name,
        siteId: input.siteId,
      },
    });

    if (existingRoom) {
      return NextResponse.json(
        { error: 'Room name already exists in this site' },
        { status: 409 }
      );
    }

    // Create the room
    const room = await prisma.room.create({
      data: {
        siteId: input.siteId,
        name: input.name,
        capacity: input.capacity,
        opening: input.opening,
      },
      include: {
        site: true,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: currentUser.id,
        action: 'ROOM_CREATED',
        entityType: 'room',
        entityId: room.id,
        metadata: {
          roomName: room.name,
          siteName: room.site.name,
          capacity: room.capacity,
          opening: room.opening,
        },
      },
    });

    return NextResponse.json({
      room: {
        id: room.id,
        name: room.name,
        capacity: room.capacity,
        siteId: room.siteId,
        siteName: room.site.name,
        timezone: room.site.timezone,
        opening: room.opening,
      },
    });
  } catch (error) {
    console.error('Create room error:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

/**
 * Update a room (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = updateRoomSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: input.id },
      include: { site: true },
    });

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check if new name conflicts with another room in the same site
    if (input.name && input.name !== existingRoom.name) {
      const nameConflict = await prisma.room.findFirst({
        where: {
          name: input.name,
          siteId: existingRoom.siteId,
          id: { not: input.id },
        },
      });

      if (nameConflict) {
        return NextResponse.json(
          { error: 'Room name already exists in this site' },
          { status: 409 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (input.name) updateData.name = input.name;
    if (input.capacity) updateData.capacity = input.capacity;
    if (input.opening) updateData.opening = input.opening;

    // Handle opening hours changes with existing bookings
    let conflictAnalysis = null;
    if (input.opening) {
      conflictAnalysis = await analyzeOpeningHoursChange(
        input.id,
        input.opening,
        existingRoom.site.timezone
      );

      // Apply conflicts (cancel/truncate affected bookings)
      if (conflictAnalysis.conflicts.length > 0) {
        await applyOpeningHoursChange(
          input.id,
          conflictAnalysis.conflicts,
          currentUser.id
        );
      }
    }

    // Update the room
    const updatedRoom = await prisma.room.update({
      where: { id: input.id },
      data: updateData,
      include: {
        site: true,
      },
    });

    // Log the activity
    await prisma.activityLog.create({
      data: {
        actorId: currentUser.id,
        action: 'ROOM_UPDATED',
        entityType: 'room',
        entityId: updatedRoom.id,
        metadata: {
          roomName: updatedRoom.name,
          siteName: updatedRoom.site.name,
          capacity: updatedRoom.capacity,
          opening: updatedRoom.opening,
          changes: updateData,
          bookingConflicts: conflictAnalysis?.conflicts || [],
        },
      },
    });

    return NextResponse.json({
      room: {
        id: updatedRoom.id,
        name: updatedRoom.name,
        capacity: updatedRoom.capacity,
        siteId: updatedRoom.siteId,
        siteName: updatedRoom.site.name,
        timezone: updatedRoom.site.timezone,
        opening: updatedRoom.opening,
      },
      // Include conflict information for admin notification
      bookingChanges: conflictAnalysis ? {
        conflicts: conflictAnalysis.conflicts,
        warnings: conflictAnalysis.warnings,
        summary: conflictAnalysis.conflicts.length > 0
          ? `${conflictAnalysis.conflicts.length} booking(s) were affected by the hours change.`
          : 'No existing bookings were affected.',
      } : null,
    });
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    );
  }
}