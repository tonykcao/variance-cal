/**
 * Activity Log API endpoint
 * GET /api/activity - Get activity log entries (filtered)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db';
import { formatInTimezone } from '@/core/time';

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

    // Filters
    const entityType = searchParams.get('entityType'); // 'booking', 'room', 'site'
    const entityId = searchParams.get('entityId');
    const siteId = searchParams.get('siteId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Permission check: Users can only see their own booking activities, admins see all
    let whereConditions: any = {};

    if (currentUser.role !== 'ADMIN') {
      // Non-admin users can only see activities related to their bookings
      if (entityType && entityType !== 'booking') {
        return NextResponse.json(
          { error: 'Access denied. Users can only view booking activities.' },
          { status: 403 }
        );
      }

      // Get user's booking IDs
      const userBookings = await prisma.booking.findMany({
        where: {
          OR: [
            { ownerId: currentUser.id },
            { attendees: { some: { userId: currentUser.id } } }
          ]
        },
        select: { id: true }
      });

      const bookingIds = userBookings.map(b => b.id);

      whereConditions = {
        entityType: 'booking',
        entityId: { in: bookingIds },
      };
    } else {
      // Admin can see all activities with filters
      if (entityType) {
        whereConditions.entityType = entityType;
      }
      if (entityId) {
        whereConditions.entityId = entityId;
      }
    }

    // Get activities
    const activities = await prisma.activityLog.findMany({
      where: whereConditions,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Math.min(limit, 100), // Cap at 100 for performance
      skip: offset,
    });

    // Get total count for pagination
    const totalCount = await prisma.activityLog.count({
      where: whereConditions,
    });

    // Format activities for response
    const formattedActivities = await Promise.all(
      activities.map(async (activity) => {
        let entityName = '';
        let siteName = '';

        // Get entity name based on type
        try {
          switch (activity.entityType) {
            case 'booking':
              const booking = await prisma.booking.findUnique({
                where: { id: activity.entityId },
                include: { room: { include: { site: true } } },
              });
              if (booking) {
                entityName = `${booking.room.name} (${booking.room.site.name})`;
                siteName = booking.room.site.name;
              }
              break;
            case 'room':
              const room = await prisma.room.findUnique({
                where: { id: activity.entityId },
                include: { site: true },
              });
              if (room) {
                entityName = room.name;
                siteName = room.site.name;
              }
              break;
            case 'site':
              const site = await prisma.site.findUnique({
                where: { id: activity.entityId },
              });
              if (site) {
                entityName = site.name;
                siteName = site.name;
              }
              break;
          }
        } catch (error) {
          // Entity might have been deleted, use metadata if available
          entityName = (activity.metadata as any)?.roomName || (activity.metadata as any)?.siteName || 'Unknown';
        }

        return {
          id: activity.id,
          action: activity.action,
          entityType: activity.entityType,
          entityId: activity.entityId,
          entityName,
          siteName,
          actor: activity.actor,
          metadata: activity.metadata,
          createdAt: activity.createdAt.toISOString(),
          // Format in user's timezone if available
          createdAtLocal: currentUser.timezone
            ? formatInTimezone(activity.createdAt, currentUser.timezone, 'yyyy-MM-dd HH:mm:ss')
            : null,
        };
      })
    );

    return NextResponse.json({
      activities: formattedActivities,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Activity log API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity log' },
      { status: 500 }
    );
  }
}