/**
 * Calendar validation API endpoint
 * POST /api/calendar/validate - Validate calendar date selection
 */

import { NextRequest, NextResponse } from "next/server"
import { calendarDateSchema } from "@/schemas/booking"
import { getRoomById } from "@/data/rooms"
import { isWithinOpeningHours } from "@/core/opening-hours"
import { localToUtc, formatInTimezone } from "@/core/time"
import { startOfDay, addMinutes } from "date-fns"
import { getCurrentUser } from "@/lib/auth/current-user"

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = calendarDateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          valid: false,
          error: "Invalid date format or past date selected",
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { date, timezone, roomId } = validationResult.data

    // Parse the selected date
    const selectedDate = new Date(date + "T00:00:00Z")
    const today = startOfDay(new Date())

    // Basic past date check (already done in schema, but double-check)
    if (selectedDate < today) {
      return NextResponse.json({
        valid: false,
        error: "Cannot select dates in the past",
        date,
        selectedDateUtc: selectedDate.toISOString(),
        todayUtc: today.toISOString(),
      })
    }

    let validationDetails: any = {
      date,
      selectedDateUtc: selectedDate.toISOString(),
      isToday: selectedDate.getTime() === today.getTime(),
      valid: true,
    }

    // If room ID and timezone are provided, check opening hours
    if (roomId && timezone) {
      const room = await getRoomById(roomId)

      if (!room) {
        return NextResponse.json(
          {
            valid: false,
            error: "Room not found",
            date,
            roomId,
          },
          { status: 404 }
        )
      }

      // Check if the selected date has any operating hours
      const dayName = selectedDate
        .toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        })
        .toLowerCase() as "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

      const dayHours = (room.opening as any)[dayName]

      if (!dayHours || !dayHours.open || !dayHours.close) {
        return NextResponse.json({
          valid: false,
          error: "Room is closed on the selected date",
          date,
          dayOfWeek: dayName,
          roomId,
          roomName: room.name,
          siteName: room.site.name,
        })
      }

      // Create sample booking times for the day to test opening hours
      const dayStart = localToUtc(`${date}T${dayHours.open}`, timezone)
      const dayEnd = localToUtc(`${date}T${dayHours.close}`, timezone)

      // Validate that it's within opening hours (using a minimal time slot)
      const sampleEnd = addMinutes(dayStart, 30)
      const isWithinHours = isWithinOpeningHours(dayStart, sampleEnd, room.opening, timezone)

      validationDetails = {
        ...validationDetails,
        room: {
          id: room.id,
          name: room.name,
          siteName: room.site.name,
          timezone,
        },
        openingHours: {
          dayOfWeek: dayName,
          open: dayHours.open,
          close: dayHours.close,
          isWithinHours,
          dayStartUtc: dayStart.toISOString(),
          dayEndUtc: dayEnd.toISOString(),
        },
      }

      if (!isWithinHours) {
        return NextResponse.json({
          ...validationDetails,
          valid: false,
          error: "Selected date is outside room operating hours",
        })
      }
    }

    return NextResponse.json({
      ...validationDetails,
      message: "Date selection is valid",
    })
  } catch (error) {
    console.error("Calendar validation error:", error)
    return NextResponse.json(
      {
        valid: false,
        error: "Failed to validate calendar date selection",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
