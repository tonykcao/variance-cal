import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"
import { prisma } from "@/lib/db"
import { localToUtc, snapTo30, enumerateSlots, formatInTimezone } from "@/core/time"
import { addDays, addHours } from "date-fns"

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request)

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 403 })
    }

    const body = await request.json()
    const rounds = body.rounds || 1

    // Get a room for testing
    const room = await prisma.room.findFirst({
      where: { site: { name: "San Francisco" } },
      include: { site: true },
    })

    if (!room) {
      return NextResponse.json({ error: "No test room available" }, { status: 404 })
    }

    // Find a future time slot for testing (tomorrow at 2 PM)
    const tomorrow = addDays(new Date(), 1)
    const testStartTime = new Date(tomorrow.setHours(14, 0, 0, 0))
    const testEndTime = addHours(testStartTime, 1)
    const timezone = room.site.timezone

    // Convert to UTC
    const startUtc = localToUtc(
      formatInTimezone(snapTo30(testStartTime, "floor"), timezone, "yyyy-MM-dd'T'HH:mm"),
      timezone
    )
    const endUtc = localToUtc(
      formatInTimezone(snapTo30(testEndTime, "ceil"), timezone, "yyyy-MM-dd'T'HH:mm"),
      timezone
    )

    // Clean up any existing test bookings for this slot
    await prisma.bookingSlot.deleteMany({
      where: {
        roomId: room.id,
        slotStartUtc: {
          gte: startUtc,
          lt: endUtc,
        },
      },
    })

    // Get test users
    const testUsers = await prisma.user.findMany({
      where: {
        email: {
          in: ["alice@example.com", "bob@example.com", "connor@example.com"],
        },
      },
    })

    if (testUsers.length < 3) {
      return NextResponse.json(
        { error: "Test users not found - please run seed script" },
        { status: 404 }
      )
    }

    const results: any[] = []
    let bookingCreated: any = null

    // Format booking details for display
    const startLocal = formatInTimezone(startUtc, timezone, "yyyy-MM-dd HH:mm")
    const endLocal = formatInTimezone(endUtc, timezone, "yyyy-MM-dd HH:mm")
    const testDetails = {
      room: room.name,
      site: room.site.name,
      timezone: timezone,
      startLocal,
      endLocal,
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
      slotsCount: enumerateSlots(startUtc, endUtc).length,
    }

    // Simulate concurrent booking attempts
    const bookingPromises = testUsers.map(async user => {
      const startTime = Date.now()

      try {
        // Enumerate slots
        const slots = enumerateSlots(startUtc, endUtc)

        // Try to create booking in a transaction
        const booking = await prisma.$transaction(async tx => {
          // Create the booking
          const newBooking = await tx.booking.create({
            data: {
              roomId: room.id,
              ownerId: user.id,
              startUtc,
              endUtc,
            },
          })

          // Try to create slot reservations
          await tx.bookingSlot.createMany({
            data: slots.map(slotStart => ({
              bookingId: newBooking.id,
              roomId: room.id,
              slotStartUtc: slotStart,
            })),
          })

          // Log activity
          await tx.activityLog.create({
            data: {
              actorId: user.id,
              action: "BOOKING_CREATED",
              entityType: "booking",
              entityId: newBooking.id,
              metadata: {
                roomId: room.id,
                roomName: room.name,
                startUtc: startUtc.toISOString(),
                endUtc: endUtc.toISOString(),
              },
            },
          })

          return newBooking
        })

        const elapsed = Date.now() - startTime
        results.push({
          userId: user.id,
          userName: user.name,
          success: true,
          message: `Successfully booked in ${elapsed}ms`,
          timestamp: elapsed,
        })

        bookingCreated = {
          id: booking.id,
          owner: user.name,
          room: room.name,
          site: room.site.name,
          startLocal,
          endLocal,
        }

        return { success: true, booking, user: user.name }
      } catch (error: any) {
        const elapsed = Date.now() - startTime

        // Check if it's a unique constraint violation
        const isConflict = error.code === "P2002" || error.message?.includes("Unique constraint")

        results.push({
          userId: user.id,
          userName: user.name,
          success: false,
          message: isConflict
            ? `Blocked by database constraint (expected) in ${elapsed}ms`
            : `Error: ${error.message} in ${elapsed}ms`,
          timestamp: elapsed,
        })

        return { success: false, error: error.message, user: user.name }
      }
    })

    // Wait for all booking attempts to complete
    const bookingResults = await Promise.all(bookingPromises)

    // Clean up the test booking after verification
    if (bookingCreated) {
      await prisma.bookingSlot.deleteMany({
        where: { bookingId: bookingCreated.id },
      })
      await prisma.booking.delete({
        where: { id: bookingCreated.id },
      })
    }

    // Sort results by timestamp to show order of completion
    results.sort((a, b) => a.timestamp - b.timestamp)

    // Verify only one booking succeeded
    const successCount = bookingResults.filter(r => r.success).length
    const expectedSuccess = successCount === 1

    return NextResponse.json({
      success: true,
      message: expectedSuccess
        ? "Test passed: Exactly one booking succeeded as expected"
        : `Test issue: ${successCount} bookings succeeded (expected 1)`,
      results,
      bookingCreated,
      testDetails,
      summary: {
        totalAttempts: testUsers.length,
        successfulBookings: successCount,
        blockedBookings: testUsers.length - successCount,
        testPassed: expectedSuccess,
      },
    })
  } catch (error) {
    console.error("Concurrency test error:", error)
    return NextResponse.json({ error: "Failed to run concurrency test" }, { status: 500 })
  }
}
