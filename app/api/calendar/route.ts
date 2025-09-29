/**
 * Calendar API endpoint
 * GET /api/calendar - Get calendar-specific data and metadata
 */

import { NextRequest, NextResponse } from "next/server"
import { getRoomsWithFilters } from "@/data/rooms"
import { getBookedSlots } from "@/data/bookings"
import { generateRoomSlots, type RoomAvailability } from "@/core/slots"
import { addDays, startOfDay, format } from "date-fns"
import { getCurrentUser } from "@/lib/auth/current-user"

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

    // Parse specific date for "jump to date" functionality
    const targetDateParam = searchParams.get("targetDate")
    const targetDate = targetDateParam
      ? new Date(targetDateParam + "T00:00:00Z")
      : startOfDay(new Date())

    // Parse date range (default to target date +/- 3 days for calendar context)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const fromDate = fromParam ? new Date(fromParam + "T00:00:00Z") : addDays(targetDate, -3)
    const toDate = toParam ? new Date(toParam + "T00:00:00Z") : addDays(targetDate, 3)

    // Add one day to toDate to make it inclusive
    const endDate = addDays(toDate, 1)

    // Validate target date is not in the past
    const today = startOfDay(new Date())
    const isTargetPast = targetDate < today

    // Get rooms based on filters
    const rooms = await getRoomsWithFilters({
      siteIds,
      capacityMin,
    })

    if (rooms.length === 0) {
      return NextResponse.json({
        rooms: [],
        calendar: {
          targetDate: format(targetDate, "yyyy-MM-dd"),
          isTargetPast,
          dateRange: {
            from: format(fromDate, "yyyy-MM-dd"),
            to: format(toDate, "yyyy-MM-dd"),
          },
          firstDayOfWeek: 0, // Sunday = 0
          metadata: {
            totalRooms: 0,
            sites: [],
          },
        },
      })
    }

    // Get room IDs
    const roomIds = rooms.map(room => room.id)

    // Get booked slots for all rooms
    const bookedSlotsByRoom = await getBookedSlots(roomIds, fromDate, endDate, currentUser?.id)

    // Generate availability for each room
    const roomAvailability: RoomAvailability[] = rooms.map(room => {
      const bookedSlots = bookedSlotsByRoom.get(room.id) || new Map()

      // Generate slots for the date range
      const dateAvailability = generateRoomSlots(
        fromDate,
        endDate,
        room.opening,
        room.site.timezone,
        bookedSlots
      )

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

    // Calculate calendar metadata
    const uniqueSites = Array.from(
      new Set(
        rooms.map(r => ({
          id: r.site.id,
          name: r.site.name,
          timezone: r.site.timezone,
        })),
        s => s.id
      )
    )

    // Find target date availability summary
    const targetDateStr = format(targetDate, "yyyy-MM-dd")
    let totalSlotsAvailable = 0
    let totalSlotsOccupied = 0

    roomAvailability.forEach(room => {
      const targetDay = room.dates.find(d => d.date === targetDateStr)
      if (targetDay) {
        targetDay.slots.forEach(slot => {
          if (slot.available) {
            totalSlotsAvailable++
          } else {
            totalSlotsOccupied++
          }
        })
      }
    })

    return NextResponse.json({
      rooms: roomAvailability,
      calendar: {
        targetDate: targetDateStr,
        isTargetPast,
        dateRange: {
          from: format(fromDate, "yyyy-MM-dd"),
          to: format(toDate, "yyyy-MM-dd"),
        },
        firstDayOfWeek: 0, // Sunday = 0, matches react-day-picker default
        metadata: {
          totalRooms: rooms.length,
          sites: uniqueSites,
          targetDateSummary: {
            totalSlotsAvailable,
            totalSlotsOccupied,
            hasAvailability: totalSlotsAvailable > 0,
          },
        },
      },
      query: {
        sites: siteIds,
        capacityMin,
        targetDate: targetDateStr,
        from: format(fromDate, "yyyy-MM-dd"),
        to: format(toDate, "yyyy-MM-dd"),
      },
    })
  } catch (error) {
    console.error("Calendar API error:", error)
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 })
  }
}
