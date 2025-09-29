import { PrismaClient, Role } from "@prisma/client"
import { addHours, startOfDay } from "date-fns"
import { toZonedTime } from "date-fns-tz"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting seed...")

  // Clear existing data
  await prisma.activityLog.deleteMany()
  await prisma.bookingSlot.deleteMany()
  await prisma.bookingAttendee.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.room.deleteMany()
  await prisma.site.deleteMany()
  await prisma.user.deleteMany()

  console.log("Cleared existing data")

  // Create users
  const aliceAdmin = await prisma.user.create({
    data: {
      id: "alice@example.com",
      email: "alice@example.com",
      name: "alice-admin",
      timezone: "America/Los_Angeles",
      role: Role.ADMIN,
    },
  })

  const bobUser = await prisma.user.create({
    data: {
      id: "bob@example.com",
      email: "bob@example.com",
      name: "bob-user",
      timezone: "America/New_York",
      role: Role.USER,
    },
  })

  const connorUser = await prisma.user.create({
    data: {
      id: "connor@example.com",
      email: "connor@example.com",
      name: "connor-user",
      timezone: "Europe/London",
      role: Role.USER,
    },
  })

  // Create 3 dummy users for testing
  const dummy1 = await prisma.user.create({
    data: {
      id: "dummy1@test.com",
      email: "dummy1@test.com",
      name: "dummy1",
      timezone: "America/Los_Angeles",
      role: Role.USER,
    },
  })

  const dummy2 = await prisma.user.create({
    data: {
      id: "dummy2@test.com",
      email: "dummy2@test.com",
      name: "dummy2",
      timezone: "America/New_York",
      role: Role.USER,
    },
  })

  const dummy3 = await prisma.user.create({
    data: {
      id: "dummy3@test.com",
      email: "dummy3@test.com",
      name: "dummy3",
      timezone: "Europe/London",
      role: Role.USER,
    },
  })

  console.log("Created users:", {
    alice: aliceAdmin.name,
    bob: bobUser.name,
    connor: connorUser.name,
    dummy1: dummy1.name,
    dummy2: dummy2.name,
    dummy3: dummy3.name,
  })

  // Create sites
  const sites = await Promise.all([
    prisma.site.create({
      data: {
        name: "San Francisco",
        timezone: "America/Los_Angeles",
      },
    }),
    prisma.site.create({
      data: {
        name: "New York",
        timezone: "America/New_York",
      },
    }),
    prisma.site.create({
      data: {
        name: "London",
        timezone: "Europe/London",
      },
    }),
    prisma.site.create({
      data: {
        name: "Shanghai",
        timezone: "Asia/Shanghai",
      },
    }),
  ])

  console.log("Created sites:", sites.map(s => s.name).join(", "))

  // Standard opening hours for all rooms
  const standardOpeningHours = {
    mon: { open: "08:00", close: "20:00" },
    tue: { open: "08:00", close: "20:00" },
    wed: { open: "08:00", close: "20:00" },
    thu: { open: "08:00", close: "20:00" },
    fri: { open: "08:00", close: "20:00" },
    sat: { open: "08:00", close: "20:00" },
    sun: { open: "08:00", close: "20:00" },
  }

  // Room names by site
  const roomNamesBySite = {
    "San Francisco": ["Oak", "Maple", "Cedar", "Redwood", "Bay"],
    "New York": ["Hudson", "Broadway", "Liberty", "Empire", "Central"],
    London: ["Thames", "Borough", "Camden", "Soho", "Greenwich"],
    Shanghai: ["Bund", "Pudong", "Jing'an", "Xuhui", "Luwan"],
  }

  // Create rooms for each site
  const rooms = []
  for (const site of sites) {
    const roomNames = roomNamesBySite[site.name as keyof typeof roomNamesBySite]
    for (let i = 0; i < roomNames.length; i++) {
      const room = await prisma.room.create({
        data: {
          name: roomNames[i],
          capacity: 4 + (i % 3) * 2, // Capacities: 4, 6, 8, 4, 6
          opening: standardOpeningHours,
          siteId: site.id,
        },
      })
      rooms.push(room)
    }
  }

  console.log("Created", rooms.length, "rooms across all sites")

  // Create 2 weeks of realistic bookings
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Helper function to create booking slots
  async function createBookingWithSlots(
    room: any,
    owner: any,
    startUtc: Date,
    endUtc: Date,
    attendees: any[] = [],
    notes?: string
  ) {
    const booking = await prisma.booking.create({
      data: {
        roomId: room.id,
        ownerId: owner.id,
        startUtc,
        endUtc,
        notes,
      },
    })

    // Calculate slots (30-minute intervals)
    const slots = []
    const current = new Date(startUtc)
    while (current < endUtc) {
      slots.push({
        bookingId: booking.id,
        roomId: room.id,
        slotStartUtc: new Date(current),
      })
      current.setMinutes(current.getMinutes() + 30)
    }

    await prisma.bookingSlot.createMany({ data: slots })

    // Add attendees
    if (attendees.length > 0) {
      await prisma.bookingAttendee.createMany({
        data: attendees.map(userId => ({
          bookingId: booking.id,
          userId,
        })),
      })
    }

    // Create activity log for booking creation
    await prisma.activityLog.create({
      data: {
        actorId: owner.id,
        action: "BOOKING_CREATED",
        entityType: "booking",
        entityId: booking.id,
        metadata: {
          roomId: room.id,
          roomName: room.name,
          siteName: room.site?.name || "Unknown",
          startUtc: startUtc.toISOString(),
          endUtc: endUtc.toISOString(),
          attendeeIds: attendees || [],
        },
      },
    })

    return booking
  }

  // Get sites and rooms for easy access
  const sfSite = sites.find(s => s.name === "San Francisco")!
  const nySite = sites.find(s => s.name === "New York")!
  const londonSite = sites.find(s => s.name === "London")!
  const shanghaiSite = sites.find(s => s.name === "Shanghai")!

  const bookingsCreated = []

  // Create realistic bookings for the next 2 weeks
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const currentDay = new Date(today)
    currentDay.setDate(today.getDate() + dayOffset)

    // Skip weekends for most bookings (but add a few)
    const dayOfWeek = currentDay.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    if (dayOffset === 0) {
      // Today: Alice has a morning meeting with Bob and David
      const oakRoom = rooms.find(r => r.name === "Oak" && r.siteId === sfSite.id)!
      const start = new Date(currentDay)
      start.setHours(10, 0, 0, 0)
      const end = new Date(currentDay)
      end.setHours(11, 30, 0, 0)

      const booking = await createBookingWithSlots(oakRoom, aliceAdmin, start, end, [
        bobUser.id,
        dummy1.id,
      ])
      bookingsCreated.push("Alice: Oak room 10:00-11:30 with Bob and David")
    }

    if (dayOffset === 1) {
      // Tomorrow: Bob has an afternoon meeting in NY with Emma
      const hudsonRoom = rooms.find(r => r.name === "Hudson" && r.siteId === nySite.id)!
      const start = new Date(currentDay)
      start.setHours(14, 0, 0, 0)
      const end = new Date(currentDay)
      end.setHours(16, 0, 0, 0)

      await createBookingWithSlots(hudsonRoom, bobUser, start, end, [dummy2.id])
      bookingsCreated.push("Bob: Hudson room 14:00-16:00 with Emma")

      // Hour truncation test: Alice books a meeting that starts at 9:15 (should snap to 9:00)
      const mapleRoom = rooms.find(r => r.name === "Maple" && r.siteId === sfSite.id)!
      const start2 = new Date(currentDay)
      start2.setHours(9, 15, 0, 0) // 9:15 will be snapped to 9:00
      const end2 = new Date(currentDay)
      end2.setHours(10, 45, 0, 0) // 10:45 will be snapped to 11:00

      await createBookingWithSlots(
        mapleRoom,
        aliceAdmin,
        new Date(currentDay.setHours(9, 0, 0, 0)), // Manually snap for seed
        new Date(currentDay.setHours(11, 0, 0, 0)),
        []
      )
      bookingsCreated.push("Alice: Maple room 9:00-11:00 (hour truncation test)")
    }

    if (dayOffset === 2) {
      // Connor (admin) books a room in London
      const thamesRoom = rooms.find(r => r.name === "Thames" && r.siteId === londonSite.id)!
      const start = new Date(currentDay)
      start.setHours(10, 0, 0, 0)
      const end = new Date(currentDay)
      end.setHours(12, 0, 0, 0)

      await createBookingWithSlots(thamesRoom, connorUser, start, end, [aliceAdmin.id, bobUser.id])
      bookingsCreated.push("Connor: Thames room 10:00-12:00 with Alice and Bob")
    }

    if (dayOffset === 3 && !isWeekend) {
      // Frank books a room in Shanghai
      const bundRoom = rooms.find(r => r.name === "Bund" && r.siteId === shanghaiSite.id)!
      const start = new Date(currentDay)
      start.setHours(14, 30, 0, 0)
      const end = new Date(currentDay)
      end.setHours(16, 30, 0, 0)

      await createBookingWithSlots(bundRoom, dummy3, start, end, [])
      bookingsCreated.push("Frank: Bund room 14:30-16:30")
    }

    if (dayOffset === 4 && !isWeekend) {
      // Alice has a long meeting (testing 3-hour booking)
      const redwoodRoom = rooms.find(r => r.name === "Redwood" && r.siteId === sfSite.id)!
      const start = new Date(currentDay)
      start.setHours(13, 0, 0, 0)
      const end = new Date(currentDay)
      end.setHours(16, 0, 0, 0)

      await createBookingWithSlots(
        redwoodRoom,
        aliceAdmin,
        start,
        end,
        [dummy1.id, dummy2.id, dummy3.id] // Max 3 attendees
      )
      bookingsCreated.push("Alice: Redwood room 13:00-16:00 with 3 guests (max attendees)")
    }

    if (dayOffset === 5 && !isWeekend) {
      // Bob books early morning slot
      const empireRoom = rooms.find(r => r.name === "Empire" && r.siteId === nySite.id)!
      const start = new Date(currentDay)
      start.setHours(8, 0, 0, 0) // First available slot
      const end = new Date(currentDay)
      end.setHours(9, 30, 0, 0)

      await createBookingWithSlots(empireRoom, bobUser, start, end, [])
      bookingsCreated.push("Bob: Empire room 8:00-9:30 (early morning)")
    }

    if (dayOffset === 7) {
      // Week 2: Multiple bookings on same day different rooms
      const cedarRoom = rooms.find(r => r.name === "Cedar" && r.siteId === sfSite.id)!
      const start1 = new Date(currentDay)
      start1.setHours(10, 0, 0, 0)
      const end1 = new Date(currentDay)
      end1.setHours(11, 0, 0, 0)

      await createBookingWithSlots(cedarRoom, aliceAdmin, start1, end1, [bobUser.id])

      const libertyRoom = rooms.find(r => r.name === "Liberty" && r.siteId === nySite.id)!
      const start2 = new Date(currentDay)
      start2.setHours(15, 0, 0, 0)
      const end2 = new Date(currentDay)
      end2.setHours(17, 0, 0, 0)

      await createBookingWithSlots(libertyRoom, bobUser, start2, end2, [dummy2.id])
      bookingsCreated.push("Multiple: Alice Cedar 10-11, Bob Liberty 15-17")
    }

    if (dayOffset === 10 && !isWeekend) {
      // Late evening booking (testing boundary - should end at 20:00)
      const sohoRoom = rooms.find(r => r.name === "Soho" && r.siteId === londonSite.id)!
      const start = new Date(currentDay)
      start.setHours(18, 30, 0, 0)
      const end = new Date(currentDay)
      end.setHours(20, 0, 0, 0) // Last available slot

      await createBookingWithSlots(sohoRoom, connorUser, start, end, [])
      bookingsCreated.push("Connor: Soho room 18:30-20:00 (late evening)")
    }

    if (dayOffset === 12) {
      // Future team meeting
      const broadwayRoom = rooms.find(r => r.name === "Broadway" && r.siteId === nySite.id)!
      const start = new Date(currentDay)
      start.setHours(11, 0, 0, 0)
      const end = new Date(currentDay)
      end.setHours(13, 30, 0, 0)

      await createBookingWithSlots(broadwayRoom, bobUser, start, end, [
        aliceAdmin.id,
        connorUser.id,
      ])
      bookingsCreated.push("Bob: Broadway room 11:00-13:30 team meeting")
    }
  }

  console.log("Created sample bookings:")
  bookingsCreated.forEach(b => console.log("  -", b))
  console.log("Seed completed successfully!")
}

main()
  .catch(e => {
    console.error("Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
