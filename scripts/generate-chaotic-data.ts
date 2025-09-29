/**
 * Generate a chaotic/busy dataset simulating a very active office
 * Creates overlapping meetings, back-to-back schedules, early/late meetings
 * Simulates ~70-85% room utilization during peak hours
 */

import { prisma } from "../lib/db"
import { addDays, addHours, setHours, setMinutes, startOfWeek, addMinutes } from "date-fns"
import { toZonedTime, fromZonedTime } from "date-fns-tz"

async function generateChaoticData() {
  console.log("=== Generating Chaotic Dataset ===\n")
  console.log("This will create a VERY busy office booking pattern with high activity.\n")

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

    // Chaotic patterns - lots of variety
    const meetingTypes = [
      "All Hands",
      "Emergency Sync",
      "War Room",
      "Crisis Meeting",
      "Board Prep",
      "Customer Escalation",
      "Incident Response",
      "Architecture Review",
      "Security Audit",
      "Budget Review",
      "Quarterly Planning",
      "Performance Review",
      "Team Retro",
      "Product Demo",
      "Sales Pitch",
      "Partner Meeting",
      "Vendor Review",
      "Code Review",
      "Design Sprint",
      "Hackathon Planning",
      "Training Session",
      "Onboarding",
      "Exit Interview",
      "Happy Hour Planning",
      "Birthday Celebration",
    ]

    const createdBookings = []
    let conflictCount = 0

    // Generate bookings for the next 6 weeks with varying intensity
    for (let week = 0; week < 6; week++) {
      const weekStart = addDays(nextMonday, week * 7)

      // Vary intensity by week - some weeks are crazier than others
      const weekIntensity = week === 2 || week === 4 ? 1.5 : 1.0 // Weeks 3 and 5 are extra busy

      for (let day = 0; day < 7; day++) {
        // Include weekends for chaotic dataset
        const currentDate = addDays(weekStart, day)
        const isWeekend = day >= 5

        // Fewer bookings on weekends but not zero
        const dayIntensity = isWeekend ? 0.2 : 1.0

        // Peak hours get more bookings
        const hourlyDistribution = [
          0.1,
          0.1,
          0.1,
          0.1,
          0.1,
          0.1, // 0-5am: very few
          0.2,
          0.4,
          0.8,
          1.2,
          1.4,
          1.5, // 6-11am: ramping up
          1.3,
          1.5,
          1.6,
          1.5,
          1.3,
          1.1, // 12-5pm: peak
          0.8,
          0.6,
          0.4,
          0.2,
          0.1,
          0.1, // 6-11pm: winding down
        ]

        // Process each hour
        for (let hour = 6; hour < 21; hour++) {
          const hourIntensity = hourlyDistribution[hour] || 0.5
          const bookingProbability = 0.4 * weekIntensity * dayIntensity * hourIntensity

          // Process each room
          for (const room of rooms) {
            const siteTimezone = room.site.timezone

            // Multiple booking attempts per hour in chaotic mode
            const attempts = Math.floor(Math.random() * 3) + 1

            for (let attempt = 0; attempt < attempts; attempt++) {
              if (Math.random() < bookingProbability) {
                const owner = users[Math.floor(Math.random() * users.length)]

                // Chaotic durations - lots of variety
                const durations = [30, 30, 60, 60, 60, 90, 90, 120, 120, 150, 180, 240]
                const duration = durations[Math.floor(Math.random() * durations.length)]

                // Random start within the hour (0, 15, 30, 45 minutes)
                const minuteOptions = [0, 15, 30, 45]
                const minute = minuteOptions[Math.floor(Math.random() * minuteOptions.length)]

                let startLocal = setMinutes(setHours(currentDate, hour), minute)

                // Some meetings start off the 30-minute grid for chaos
                if (Math.random() < 0.1) {
                  startLocal = addMinutes(startLocal, 15)
                }

                const endLocal = addMinutes(startLocal, duration)

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
                  const meetingType = meetingTypes[Math.floor(Math.random() * meetingTypes.length)]

                  // Some meetings have urgency indicators
                  const urgencyPrefix =
                    Math.random() < 0.15
                      ? "URGENT: "
                      : Math.random() < 0.1
                        ? "BLOCKED: "
                        : Math.random() < 0.1
                          ? "CEO Request: "
                          : ""

                  const booking = await prisma.booking.create({
                    data: {
                      roomId: room.id,
                      ownerId: owner.id,
                      startUtc,
                      endUtc,
                      notes: `${urgencyPrefix}${meetingType}${duration >= 180 ? " (Extended Session)" : ""}${isWeekend ? " [Weekend]" : ""}`,
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
                    slotTime = addMinutes(slotTime, 30)
                  }

                  await prisma.bookingSlot.createMany({ data: slots })

                  // Chaotic attendee patterns
                  const attendeeProbability = Math.random()
                  if (attendeeProbability < 0.7) {
                    // 70% have attendees
                    // Sometimes max out attendees
                    const maxAttendees =
                      attendeeProbability < 0.2 ? 3 : attendeeProbability < 0.4 ? 2 : 1

                    const availableAttendees = users.filter(u => u.id !== owner.id)
                    const selectedAttendees = availableAttendees
                      .sort(() => Math.random() - 0.5)
                      .slice(0, Math.min(maxAttendees, availableAttendees.length))

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
                } else {
                  conflictCount++
                }
              }
            }
          }
        }

        // Add some very early morning meetings (5-7am) for global teams
        if (!isWeekend && Math.random() < 0.3) {
          const earlyHour = 5 + Math.floor(Math.random() * 2)
          const room = rooms[Math.floor(Math.random() * rooms.length)]
          const owner = users[Math.floor(Math.random() * users.length)]

          const startLocal = setMinutes(setHours(currentDate, earlyHour), 0)
          const endLocal = addHours(startLocal, 1)

          const startUtc = fromZonedTime(startLocal, room.site.timezone)
          const endUtc = fromZonedTime(endLocal, room.site.timezone)

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
                notes: "Global Team Sync (Early Morning)",
              },
            })

            const slots = []
            let slotTime = new Date(startUtc)
            while (slotTime < endUtc) {
              slots.push({
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: new Date(slotTime),
              })
              slotTime = addMinutes(slotTime, 30)
            }

            await prisma.bookingSlot.createMany({ data: slots })
            createdBookings.push(booking)
          }
        }

        // Add some late evening meetings (8-10pm) for deadlines
        if (!isWeekend && Math.random() < 0.25) {
          const lateHour = 20 + Math.floor(Math.random() * 2)
          const room = rooms[Math.floor(Math.random() * rooms.length)]
          const owner = users[Math.floor(Math.random() * users.length)]

          const startLocal = setMinutes(setHours(currentDate, lateHour), 0)
          const endLocal = addHours(startLocal, 1.5)

          const startUtc = fromZonedTime(startLocal, room.site.timezone)
          const endUtc = fromZonedTime(endLocal, room.site.timezone)

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
                notes: "Deadline Crunch Session (Late Night)",
              },
            })

            const slots = []
            let slotTime = new Date(startUtc)
            while (slotTime < endUtc) {
              slots.push({
                bookingId: booking.id,
                roomId: room.id,
                slotStartUtc: new Date(slotTime),
              })
              slotTime = addMinutes(slotTime, 30)
            }

            await prisma.bookingSlot.createMany({ data: slots })
            createdBookings.push(booking)
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

    // Calculate some stats
    const totalSlots = rooms.length * 6 * 7 * 14 // rooms * weeks * days * slots per day (7am-9pm)
    const utilization = Math.round(((createdBookings.length * 2) / totalSlots) * 100) // *2 for average booking length

    console.log(`\n=== Chaotic Dataset Generated ===`)
    console.log(`Created ${createdBookings.length} bookings`)
    console.log(`Booking conflicts encountered: ${conflictCount}`)
    console.log(`Estimated peak hour utilization: ~${Math.min(95, utilization * 2)}%`)
    console.log(`Average utilization: ~${utilization}%`)
    console.log("\nDataset characteristics:")
    console.log("- Very high booking density during business hours")
    console.log("- Weekend meetings for urgent matters")
    console.log("- Early morning (5-7am) and late night (8-10pm) sessions")
    console.log("- Various meeting types including crisis and emergency meetings")
    console.log("- Many back-to-back bookings")
    console.log("- Some off-grid timing (15-minute offsets)")
    console.log("- Maxed out attendees on some meetings")
    console.log("- Urgency indicators (URGENT, BLOCKED, CEO Request)")
  } catch (error) {
    console.error("Data generation failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

generateChaoticData()
