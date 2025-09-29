/**
 * Generate a light/realistic dataset with moderate booking activity
 * Simulates a typical office with ~30-40% room utilization
 */

import { prisma } from "../lib/db"
import { addDays, addHours, setHours, setMinutes, startOfWeek, isWeekend } from "date-fns"
import { toZonedTime, fromZonedTime } from "date-fns-tz"

async function generateLightData() {
  console.log("=== Generating Light Dataset ===\n")
  console.log("This will create a realistic office booking pattern with moderate activity.\n")

  try {
    // Get all users and rooms
    const users = await prisma.user.findMany()
    const rooms = await prisma.room.findMany({
      include: { site: true },
    })

    if (users.length === 0 || rooms.length === 0) {
      console.error("ERROR: Please run 'npm run db:seed' first to create users and rooms.")
      process.exit(1)
    }

    console.log(`Found ${users.length} users and ${rooms.length} rooms`)

    // Start from next Monday
    const today = new Date()
    const nextMonday = startOfWeek(addDays(today, 7), { weekStartsOn: 1 })

    // Booking patterns for light data
    const bookingPatterns = [
      // Team meetings (recurring weekly)
      {
        name: "Weekly Team Standup",
        time: "09:00",
        duration: 30,
        days: [1, 3, 5],
        recurring: true,
      },
      { name: "Sprint Planning", time: "10:00", duration: 120, days: [1], recurring: true },
      { name: "Sprint Review", time: "15:00", duration: 90, days: [5], recurring: true },

      // Regular meetings
      { name: "1:1 Meeting", time: "14:00", duration: 60, probability: 0.3 },
      { name: "Project Sync", time: "11:00", duration: 60, probability: 0.25 },
      { name: "Design Review", time: "13:30", duration: 90, probability: 0.2 },
      { name: "Client Call", time: "10:30", duration: 60, probability: 0.15 },

      // Ad-hoc bookings
      { name: "Quick Sync", time: "15:30", duration: 30, probability: 0.2 },
      { name: "Brainstorming", time: "14:00", duration: 120, probability: 0.1 },
      { name: "Interview", time: "11:00", duration: 60, probability: 0.1 },
    ]

    const createdBookings = []

    // Generate bookings for the next 4 weeks
    for (let week = 0; week < 4; week++) {
      const weekStart = addDays(nextMonday, week * 7)

      for (let day = 0; day < 5; day++) {
        // Monday to Friday only
        const currentDate = addDays(weekStart, day)

        // Process each room
        for (const room of rooms) {
          const siteTimezone = room.site.timezone

          // Apply recurring patterns
          for (const pattern of bookingPatterns.filter(p => p.recurring)) {
            if (pattern.days?.includes(day + 1)) {
              // 70% chance the recurring meeting happens
              if (Math.random() < 0.7) {
                const owner = users[Math.floor(Math.random() * users.length)]
                const [hour, minute] = pattern.time.split(":").map(Number)

                // Convert to site local time
                let startLocal = setMinutes(setHours(currentDate, hour), minute)
                const endLocal = addHours(startLocal, pattern.duration / 60)

                // Convert to UTC
                const startUtc = fromZonedTime(startLocal, siteTimezone)
                const endUtc = fromZonedTime(endLocal, siteTimezone)

                // Check if slot is available
                const conflict = await prisma.bookingSlot.findFirst({
                  where: {
                    roomId: room.id,
                    slotStartUtc: {
                      gte: startUtc,
                      lt: endUtc,
                    },
                  },
                })

                if (!conflict) {
                  // Create booking
                  const booking = await prisma.booking.create({
                    data: {
                      roomId: room.id,
                      ownerId: owner.id,
                      startUtc,
                      endUtc,
                      notes: `${pattern.name} - Week ${week + 1}`,
                    },
                  })

                  // Create slots
                  const slots = []
                  let slotTime = new Date(startUtc)
                  while (slotTime < endUtc) {
                    slots.push({
                      bookingId: booking.id,
                      roomId: room.id,
                      slotStartUtc: new Date(slotTime),
                    })
                    slotTime = addHours(slotTime, 0.5)
                  }

                  await prisma.bookingSlot.createMany({ data: slots })

                  // Add 1-2 attendees for team meetings
                  if (pattern.name.includes("Team") || pattern.name.includes("Sprint")) {
                    const attendeeCount = Math.floor(Math.random() * 2) + 1
                    const availableAttendees = users.filter(u => u.id !== owner.id)
                    const selectedAttendees = availableAttendees
                      .sort(() => Math.random() - 0.5)
                      .slice(0, Math.min(attendeeCount, availableAttendees.length))

                    if (selectedAttendees.length > 0) {
                      await prisma.bookingAttendee.createMany({
                        data: selectedAttendees.map(u => ({
                          bookingId: booking.id,
                          userId: u.id,
                        })),
                      })
                    }
                  }

                  createdBookings.push(booking)
                }
              }
            }
          }

          // Apply random patterns
          for (const pattern of bookingPatterns.filter(p => !p.recurring)) {
            if (Math.random() < (pattern.probability || 0)) {
              const owner = users[Math.floor(Math.random() * users.length)]
              const [baseHour, baseMinute] = pattern.time.split(":").map(Number)

              // Add some randomness to the time (±1 hour)
              const hourOffset = Math.floor(Math.random() * 3) - 1
              const hour = Math.max(8, Math.min(18, baseHour + hourOffset))
              const minute = Math.random() < 0.5 ? 0 : 30

              let startLocal = setMinutes(setHours(currentDate, hour), minute)
              const endLocal = addHours(startLocal, pattern.duration / 60)

              const startUtc = fromZonedTime(startLocal, siteTimezone)
              const endUtc = fromZonedTime(endLocal, siteTimezone)

              // Check if slot is available
              const conflict = await prisma.bookingSlot.findFirst({
                where: {
                  roomId: room.id,
                  slotStartUtc: {
                    gte: startUtc,
                    lt: endUtc,
                  },
                },
              })

              if (!conflict) {
                const booking = await prisma.booking.create({
                  data: {
                    roomId: room.id,
                    ownerId: owner.id,
                    startUtc,
                    endUtc,
                    notes: pattern.name,
                  },
                })

                // Create slots
                const slots = []
                let slotTime = new Date(startUtc)
                while (slotTime < endUtc) {
                  slots.push({
                    bookingId: booking.id,
                    roomId: room.id,
                    slotStartUtc: new Date(slotTime),
                  })
                  slotTime = addHours(slotTime, 0.5)
                }

                await prisma.bookingSlot.createMany({ data: slots })

                // Random chance of attendees
                if (Math.random() < 0.4) {
                  const attendeeCount = Math.floor(Math.random() * 3) + 1
                  const availableAttendees = users.filter(u => u.id !== owner.id)
                  const selectedAttendees = availableAttendees
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Math.min(attendeeCount, availableAttendees.length))

                  if (selectedAttendees.length > 0) {
                    await prisma.bookingAttendee.createMany({
                      data: selectedAttendees.map(u => ({
                        bookingId: booking.id,
                        userId: u.id,
                      })),
                    })
                  }
                }

                createdBookings.push(booking)
              }
            }
          }
        }
      }
    }

    // Create activity logs
    for (const booking of createdBookings) {
      await prisma.activityLog.create({
        data: {
          actorId: booking.ownerId,
          action: "BOOKING_CREATED",
          entityType: "booking",
          entityId: booking.id,
          metadata: {
            roomId: booking.roomId,
            startUtc: booking.startUtc,
            endUtc: booking.endUtc,
          },
        },
      })
    }

    console.log(`\n=== Light Dataset Generated ===`)
    console.log(`Created ${createdBookings.length} bookings`)
    console.log(
      `Average utilization: ~${Math.round((createdBookings.length / (rooms.length * 20 * 16)) * 100)}%`
    )
    console.log("\nDataset characteristics:")
    console.log("- Recurring weekly meetings (standups, sprint ceremonies)")
    console.log("- Scattered 1:1s and project meetings")
    console.log("- Realistic office hours (8am-6pm)")
    console.log("- No weekend bookings")
    console.log("- Mix of solo and group meetings")
  } catch (error) {
    console.error("Data generation failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

generateLightData()
