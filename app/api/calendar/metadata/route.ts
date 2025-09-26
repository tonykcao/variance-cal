/**
 * Calendar metadata API endpoint
 * GET /api/calendar/metadata - Get calendar configuration and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSites } from '@/data/sites';
import { getRoomsWithFilters } from '@/data/rooms';
import { getBookedSlots } from '@/data/bookings';
import { addDays, startOfDay, format, eachDayOfInterval, getDay } from 'date-fns';
import { getCurrentUser } from '@/lib/auth/current-user';

export async function GET(request: NextRequest) {
  try {
    // Get current user for context
    const currentUser = await getCurrentUser(request);

    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const sitesParam = searchParams.get('sites');
    const siteIds = sitesParam ? sitesParam.split(',') : undefined;
    const capacityMin = searchParams.get('capacityMin')
      ? parseInt(searchParams.get('capacityMin')!)
      : undefined;

    // Parse date range (default to current month)
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const today = startOfDay(new Date());
    const fromDate = fromParam
      ? new Date(fromParam + 'T00:00:00Z')
      : startOfDay(new Date(today.getFullYear(), today.getMonth(), 1)); // Start of current month
    const toDate = toParam
      ? new Date(toParam + 'T00:00:00Z')
      : startOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0)); // End of current month

    // Get all available sites
    const allSites = await getSites();

    // Get rooms based on filters
    const rooms = await getRoomsWithFilters({
      siteIds,
      capacityMin,
    });

    // Generate disabled dates (past dates)
    const disabledDates = [];
    const currentDate = new Date('2020-01-01'); // Start from a reasonable past date
    while (currentDate < today) {
      disabledDates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Generate all dates in the range for availability summary
    const dateRange = eachDayOfInterval({ start: fromDate, end: toDate });

    // Get booking data for the range if rooms exist
    let dateAvailabilitySummary = [];
    if (rooms.length > 0) {
      const roomIds = rooms.map(room => room.id);
      const bookedSlotsByRoom = await getBookedSlots(roomIds, fromDate, addDays(toDate, 1), currentUser?.id);

      // Calculate availability summary for each date
      dateAvailabilitySummary = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date); // 0 = Sunday, 1 = Monday, etc.
        const isPastDate = date < today;

        let totalSlots = 0;
        let availableSlots = 0;
        let bookedSlots = 0;

        // Calculate slots for each room on this date
        rooms.forEach(room => {
          const timezone = room.site.timezone;
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const dayName = dayNames[dayOfWeek];
          const dayHours = (room.opening as any)[dayName];

          if (dayHours && dayHours.open && dayHours.close) {
            // Calculate number of 30-minute slots for this room
            const [openHour, openMin] = dayHours.open.split(':').map(Number);
            const [closeHour, closeMin] = dayHours.close.split(':').map(Number);
            const openMinutes = openHour * 60 + openMin;
            const closeMinutes = closeHour * 60 + closeMin;
            const roomSlots = Math.floor((closeMinutes - openMinutes) / 30);

            totalSlots += roomSlots;

            // Check booked slots for this room on this date
            const roomBookedSlots = bookedSlotsByRoom.get(room.id);
            if (roomBookedSlots) {
              // Count slots booked on this specific date
              let roomBookedSlotsOnDate = 0;
              roomBookedSlots.forEach((slotInfo, slotTimeUtc) => {
                const slotDate = new Date(slotTimeUtc);
                if (format(slotDate, 'yyyy-MM-dd') === dateStr) {
                  roomBookedSlotsOnDate++;
                }
              });
              bookedSlots += roomBookedSlotsOnDate;
              availableSlots += (roomSlots - roomBookedSlotsOnDate);
            } else {
              availableSlots += roomSlots;
            }
          }
        });

        return {
          date: dateStr,
          dayOfWeek: dayOfWeek,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
          isPastDate,
          isToday: dateStr === format(today, 'yyyy-MM-dd'),
          totalSlots,
          availableSlots,
          bookedSlots,
          hasAvailability: availableSlots > 0 && !isPastDate,
          utilization: totalSlots > 0 ? Math.round((bookedSlots / totalSlots) * 100) : 0,
        };
      });
    } else {
      // If no rooms match filters, still provide date structure
      dateAvailabilitySummary = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = getDay(date);
        const isPastDate = date < today;

        return {
          date: dateStr,
          dayOfWeek: dayOfWeek,
          dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
          isPastDate,
          isToday: dateStr === format(today, 'yyyy-MM-dd'),
          totalSlots: 0,
          availableSlots: 0,
          bookedSlots: 0,
          hasAvailability: false,
          utilization: 0,
        };
      });
    }

    // Calculate room capacity statistics
    const capacityStats = rooms.reduce((stats, room) => {
      const capacity = room.capacity;
      stats.total += 1;
      stats.totalCapacity += capacity;
      stats.minCapacity = Math.min(stats.minCapacity || capacity, capacity);
      stats.maxCapacity = Math.max(stats.maxCapacity || capacity, capacity);
      return stats;
    }, {
      total: 0,
      totalCapacity: 0,
      minCapacity: undefined as number | undefined,
      maxCapacity: undefined as number | undefined
    });

    const avgCapacity = capacityStats.total > 0 ? Math.round(capacityStats.totalCapacity / capacityStats.total) : 0;

    return NextResponse.json({
      metadata: {
        // Calendar configuration
        firstDayOfWeek: 0, // Sunday = 0 (matches react-day-picker default)
        weekStartsOn: 0,
        locale: 'en-US',

        // Date configuration
        today: format(today, 'yyyy-MM-dd'),
        dateRange: {
          from: format(fromDate, 'yyyy-MM-dd'),
          to: format(toDate, 'yyyy-MM-dd'),
        },

        // Disabled dates
        disabledDates: disabledDates.slice(-90), // Last 90 disabled dates to avoid huge array
        disabledBefore: format(today, 'yyyy-MM-dd'),

        // Site and room information
        sites: allSites.map(site => ({
          id: site.id,
          name: site.name,
          timezone: site.timezone,
          roomCount: rooms.filter(r => r.siteId === site.id).length,
        })),

        // Room statistics
        roomStats: {
          total: rooms.length,
          capacityStats: {
            min: capacityStats.minCapacity || 0,
            max: capacityStats.maxCapacity || 0,
            average: avgCapacity,
            total: capacityStats.totalCapacity,
          },
          bySite: allSites.map(site => ({
            siteId: site.id,
            siteName: site.name,
            roomCount: rooms.filter(r => r.siteId === site.id).length,
          })),
        },

        // Booking configuration
        bookingConfig: {
          slotDurationMinutes: 30,
          maxAttendeesPerBooking: 3,
          maxAdvanceBookingDays: 365,
          minBookingDuration: 30, // minutes
          maxBookingDuration: 480, // 8 hours in minutes
        },

        // User context
        currentUser: currentUser ? {
          id: currentUser.id,
          role: currentUser.role,
          timezone: currentUser.timezone,
        } : null,
      },

      // Date availability summary for the requested range
      dateAvailability: dateAvailabilitySummary,

      // Summary statistics
      summary: {
        totalDaysInRange: dateRange.length,
        daysWithAvailability: dateAvailabilitySummary.filter(d => d.hasAvailability).length,
        totalSlotsInRange: dateAvailabilitySummary.reduce((sum, d) => sum + d.totalSlots, 0),
        totalAvailableSlots: dateAvailabilitySummary.reduce((sum, d) => sum + d.availableSlots, 0),
        totalBookedSlots: dateAvailabilitySummary.reduce((sum, d) => sum + d.bookedSlots, 0),
        averageUtilization: Math.round(
          dateAvailabilitySummary.reduce((sum, d) => sum + d.utilization, 0) /
          Math.max(dateAvailabilitySummary.length, 1)
        ),
      },

      // Query context
      query: {
        sites: siteIds,
        capacityMin,
        from: format(fromDate, 'yyyy-MM-dd'),
        to: format(toDate, 'yyyy-MM-dd'),
      },
    });

  } catch (error) {
    console.error('Calendar metadata API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar metadata' },
      { status: 500 }
    );
  }
}