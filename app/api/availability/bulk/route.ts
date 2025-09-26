/**
 * Bulk availability API endpoint
 * POST /api/availability/bulk - Check availability for multiple rooms/dates efficiently
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRoomsWithFilters, getRoomById } from '@/data/rooms';
import { getBookedSlots } from '@/data/bookings';
import { generateRoomSlots, applyTimeWindowFilter, type RoomAvailability } from '@/core/slots';
import { addDays, startOfDay, format, parseISO } from 'date-fns';
import { getCurrentUser } from '@/lib/auth/current-user';
import { z } from 'zod';

// Schema for bulk availability request
const bulkAvailabilitySchema = z.object({
  requests: z.array(z.object({
    id: z.string().optional(), // Client-provided ID for matching response
    roomIds: z.array(z.string()).optional(), // Specific rooms, or use filters
    siteIds: z.array(z.string()).optional(),
    capacityMin: z.number().min(1).optional(),
    dateRanges: z.array(z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })),
    timeWindows: z.array(z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })).optional(),
    includeUnavailable: z.boolean().default(false), // Include unavailable slots in response
  })),
  options: z.object({
    includeRoomDetails: z.boolean().default(true),
    includeDateSummary: z.boolean().default(true),
    maxResults: z.number().min(1).max(1000).default(100),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Get current user for own booking detection
    const currentUser = await getCurrentUser(request);

    const body = await request.json();

    // Validate input
    const validationResult = bulkAvailabilitySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { requests, options = {} } = validationResult.data;
    const {
      includeRoomDetails = true,
      includeDateSummary = true,
      maxResults = 100
    } = options;

    // Process each request
    const results = await Promise.all(
      requests.map(async (req, index) => {
        try {
          const requestId = req.id || `request-${index}`;

          // Determine rooms to check
          let rooms = [];
          if (req.roomIds && req.roomIds.length > 0) {
            // Get specific rooms
            const roomPromises = req.roomIds.map(id => getRoomById(id));
            const roomResults = await Promise.all(roomPromises);
            rooms = roomResults.filter(room => room !== null);
          } else {
            // Use filters to get rooms
            rooms = await getRoomsWithFilters({
              siteIds: req.siteIds,
              capacityMin: req.capacityMin,
            });
          }

          if (rooms.length === 0) {
            return {
              requestId,
              rooms: [],
              dateRanges: req.dateRanges,
              summary: {
                totalRoomsChecked: 0,
                totalDateRanges: req.dateRanges.length,
                totalAvailableSlots: 0,
                totalOccupiedSlots: 0,
              }
            };
          }

          // Limit results
          if (rooms.length > maxResults) {
            rooms = rooms.slice(0, maxResults);
          }

          const roomIds = rooms.map(room => room.id);

          // Process each date range for this request
          const dateRangeResults = await Promise.all(
            req.dateRanges.map(async (dateRange) => {
              const fromDate = new Date(dateRange.from + 'T00:00:00Z');
              const toDate = new Date(dateRange.to + 'T00:00:00Z');
              const endDate = addDays(toDate, 1);

              // Get booked slots for all rooms in this date range
              const bookedSlotsByRoom = await getBookedSlots(
                roomIds,
                fromDate,
                endDate,
                currentUser?.id
              );

              // Generate availability for each room
              const roomAvailability: RoomAvailability[] = rooms.map(room => {
                const bookedSlots = bookedSlotsByRoom.get(room.id) || new Map();

                // Generate slots for the date range
                let dateAvailability = generateRoomSlots(
                  fromDate,
                  endDate,
                  room.opening,
                  room.site.timezone,
                  bookedSlots
                );

                // Apply time window filters if specified
                if (req.timeWindows && req.timeWindows.length > 0) {
                  req.timeWindows.forEach(window => {
                    dateAvailability = dateAvailability.map(day => ({
                      ...day,
                      slots: applyTimeWindowFilter(
                        day.slots,
                        window.start,
                        window.end,
                        room.site.timezone
                      ),
                    }));
                  });
                }

                // Filter out unavailable slots if not requested
                if (!req.includeUnavailable) {
                  dateAvailability = dateAvailability.map(day => ({
                    ...day,
                    slots: day.slots.filter(slot => slot.available),
                  }));
                }

                return {
                  roomId: room.id,
                  roomName: includeRoomDetails ? room.name : undefined,
                  siteId: includeRoomDetails ? room.site.id : undefined,
                  siteName: includeRoomDetails ? room.site.name : undefined,
                  timezone: includeRoomDetails ? room.site.timezone : undefined,
                  capacity: includeRoomDetails ? room.capacity : undefined,
                  dates: dateAvailability,
                };
              });

              // Calculate summary for this date range
              let totalAvailableSlots = 0;
              let totalOccupiedSlots = 0;

              roomAvailability.forEach(room => {
                room.dates.forEach(day => {
                  day.slots.forEach(slot => {
                    if (slot.available) {
                      totalAvailableSlots++;
                    } else {
                      totalOccupiedSlots++;
                    }
                  });
                });
              });

              return {
                dateRange,
                rooms: roomAvailability,
                summary: includeDateSummary ? {
                  totalAvailableSlots,
                  totalOccupiedSlots,
                  utilization: totalAvailableSlots + totalOccupiedSlots > 0
                    ? Math.round((totalOccupiedSlots / (totalAvailableSlots + totalOccupiedSlots)) * 100)
                    : 0,
                } : undefined,
              };
            })
          );

          // Calculate overall summary for this request
          const overallSummary = {
            totalRoomsChecked: rooms.length,
            totalDateRanges: req.dateRanges.length,
            totalAvailableSlots: dateRangeResults.reduce(
              (sum, range) => sum + (range.summary?.totalAvailableSlots || 0), 0
            ),
            totalOccupiedSlots: dateRangeResults.reduce(
              (sum, range) => sum + (range.summary?.totalOccupiedSlots || 0), 0
            ),
          };

          return {
            requestId,
            dateRanges: dateRangeResults,
            summary: overallSummary,
            appliedFilters: {
              roomIds: req.roomIds,
              siteIds: req.siteIds,
              capacityMin: req.capacityMin,
              timeWindows: req.timeWindows,
            },
          };

        } catch (error) {
          console.error(`Error processing bulk request ${req.id || index}:`, error);
          return {
            requestId: req.id || `request-${index}`,
            error: 'Failed to process request',
            details: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Calculate overall statistics
    const overallStats = {
      totalRequestsProcessed: results.length,
      successfulRequests: results.filter(r => !r.error).length,
      failedRequests: results.filter(r => r.error).length,
      totalRoomsChecked: results.reduce((sum, r) => sum + (r.summary?.totalRoomsChecked || 0), 0),
      totalAvailableSlots: results.reduce((sum, r) => sum + (r.summary?.totalAvailableSlots || 0), 0),
      totalOccupiedSlots: results.reduce((sum, r) => sum + (r.summary?.totalOccupiedSlots || 0), 0),
    };

    return NextResponse.json({
      results,
      statistics: overallStats,
      processedAt: new Date().toISOString(),
      currentUser: currentUser ? {
        id: currentUser.id,
        role: currentUser.role,
      } : null,
    });

  } catch (error) {
    console.error('Bulk availability API error:', error);
    return NextResponse.json(
      { error: 'Failed to process bulk availability request' },
      { status: 500 }
    );
  }
}

// Helper endpoint for bulk availability examples/documentation
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'POST /api/availability/bulk',
    description: 'Check availability for multiple rooms and date ranges efficiently',
    exampleRequest: {
      requests: [
        {
          id: 'morning-slots',
          siteIds: ['site-sf', 'site-ny'],
          capacityMin: 4,
          dateRanges: [
            { from: '2025-09-26', to: '2025-09-26' },
            { from: '2025-09-27', to: '2025-09-27' },
          ],
          timeWindows: [
            { start: '09:00', end: '12:00' }
          ],
          includeUnavailable: false,
        },
        {
          id: 'specific-rooms',
          roomIds: ['room-oak', 'room-maple'],
          dateRanges: [
            { from: '2025-09-26', to: '2025-09-28' },
          ],
          includeUnavailable: true,
        }
      ],
      options: {
        includeRoomDetails: true,
        includeDateSummary: true,
        maxResults: 50,
      }
    },
    responseStructure: {
      results: '[Array of results matching each request]',
      statistics: 'Overall processing statistics',
      processedAt: 'ISO timestamp',
      currentUser: 'Current user context or null',
    }
  });
}