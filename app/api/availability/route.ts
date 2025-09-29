/**
 * Availability API endpoint
 * GET /api/availability
 */

import { NextRequest, NextResponse } from "next/server"
import { getRoomsWithFilters } from "@/data/rooms"
import { getBookedSlots } from "@/data/bookings"
import { generateRoomSlots, applyTimeWindowFilter, type RoomAvailability } from "@/core/slots"
import { addDays, startOfDay } from "date-fns"
import { getStartOfDayInTimezone } from "@/core/time"
import { getCurrentUser } from "@/lib/auth/current-user"

/**
 * Get room availability
 * Query params:
 * - sites: Comma-separated site IDs
 * - capacityMin: Minimum capacity
 * - from: Start date (YYYY-MM-DD)
 * - to: End date (YYYY-MM-DD)
 * - windowStart: Time window start (HH:mm)
 * - windowEnd: Time window end (HH:mm)
 */
export async function GET(request: NextRequest) {
  try {
    // Get current user for own booking detection
    const currentUser = await getCurrentUser(request)

    const searchParams = request.nextUrl.searchParams

    // Parse query parameters
    const sitesParam = searchParams.get("sites")
    const siteIds = sitesParam ? sitesParam.split(",") : undefined
    const capacityMin = searchParams.get("capacityMin")
      ? parseInt(searchParams.get("capacityMin")!)
      : undefined

    // Parse dates (default to today)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    // Parse dates as local dates (not UTC)
    // When user selects "2025-10-01", they mean Oct 1 in their local context
    // We'll handle timezone conversion per room later
    const today = startOfDay(new Date())
    const fromDate = fromParam ? startOfDay(new Date(fromParam + "T12:00:00")) : today
    const toDate = toParam
      ? startOfDay(new Date(toParam + "T12:00:00"))
      : fromParam
        ? startOfDay(new Date(fromParam + "T12:00:00"))
        : today

    // Add one day to toDate to make it inclusive
    const endDate = addDays(toDate, 1)

    // Parse time window
    const windowStart = searchParams.get("windowStart")
    const windowEnd = searchParams.get("windowEnd")
    const hasTimeWindow = windowStart && windowEnd

    // Get rooms based on filters
    const rooms = await getRoomsWithFilters({
      siteIds,
      capacityMin,
    })

    if (rooms.length === 0) {
      return NextResponse.json({ rooms: [] })
    }

    // Get room IDs
    const roomIds = rooms.map(room => room.id)

    // Get booked slots for all rooms
    const bookedSlotsByRoom = await getBookedSlots(roomIds, fromDate, endDate, currentUser?.id)

    // Generate availability for each room
    const roomAvailability: RoomAvailability[] = rooms.map(room => {
      const bookedSlots = bookedSlotsByRoom.get(room.id) || new Map()

      // Generate slots for the date range
      let dateAvailability = generateRoomSlots(
        fromDate,
        endDate,
        room.opening,
        room.site.timezone,
        bookedSlots
      )

      // Apply time window filter if specified
      if (hasTimeWindow) {
        dateAvailability = dateAvailability.map(day => ({
          ...day,
          slots: applyTimeWindowFilter(day.slots, windowStart, windowEnd, room.site.timezone),
        }))
      }

      return {
        roomId: room.id,
        roomName: room.name,
        siteId: room.site.id,
        siteName: room.site.name,
        timezone: room.site.timezone,
        capacity: room.capacity,
        dates: dateAvailability,
      }
    })

    return NextResponse.json({
      rooms: roomAvailability,
      query: {
        sites: siteIds,
        capacityMin,
        from: fromDate.toISOString().split("T")[0],
        to: toDate.toISOString().split("T")[0],
        timeWindow: hasTimeWindow ? { start: windowStart, end: windowEnd } : null,
      },
    })
  } catch (error) {
    console.error("Availability API error:", error)
    return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 })
  }
}
