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
  const aliceUser = await prisma.user.create({
    data: {
      email: "alice@example.com",
      name: "alice-user",
      timezone: "America/Los_Angeles",
      role: Role.USER,
    },
  })

  const bobUser = await prisma.user.create({
    data: {
      email: "bob@example.com",
      name: "bob-user",
      timezone: "America/New_York",
      role: Role.USER,
    },
  })

  const connorAdmin = await prisma.user.create({
    data: {
      email: "connor@example.com",
      name: "connor-admin",
      timezone: "Europe/London",
      role: Role.ADMIN,
    },
  })

  console.log("Created users:", {
    alice: aliceUser.name,
    bob: bobUser.name,
    connor: connorAdmin.name,
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

  // Create sample bookings
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Booking 1: Alice books Oak room in SF for today 10:00-11:30
  const sfSite = sites.find(s => s.name === "San Francisco")!
  const oakRoom = rooms.find(r => r.name === "Oak" && r.siteId === sfSite.id)!

  const booking1StartLocal = new Date(today)
  booking1StartLocal.setHours(10, 0, 0, 0)
  const booking1EndLocal = new Date(today)
  booking1EndLocal.setHours(11, 30, 0, 0)

  const booking1 = await prisma.booking.create({
    data: {
      roomId: oakRoom.id,
      ownerId: aliceUser.id,
      startUtc: booking1StartLocal,
      endUtc: booking1EndLocal,
    },
  })

  // Create booking slots for booking1
  await prisma.bookingSlot.createMany({
    data: [
      {
        bookingId: booking1.id,
        roomId: oakRoom.id,
        slotStartUtc: new Date(today.setHours(10, 0, 0, 0)),
      },
      {
        bookingId: booking1.id,
        roomId: oakRoom.id,
        slotStartUtc: new Date(today.setHours(10, 30, 0, 0)),
      },
      {
        bookingId: booking1.id,
        roomId: oakRoom.id,
        slotStartUtc: new Date(today.setHours(11, 0, 0, 0)),
      },
    ],
  })

  // Add Bob as attendee
  await prisma.bookingAttendee.create({
    data: {
      bookingId: booking1.id,
      userId: bobUser.id,
    },
  })

  // Log activity for booking creation
  await prisma.activityLog.create({
    data: {
      actorId: aliceUser.id,
      action: "BOOKING_CREATED",
      entityType: "booking",
      entityId: booking1.id,
      metadata: {
        roomId: oakRoom.id,
        roomName: oakRoom.name,
        site: sfSite.name,
        startUtc: booking1StartLocal.toISOString(),
        endUtc: booking1EndLocal.toISOString(),
      },
    },
  })

  // Booking 2: Bob books Hudson room in NY for tomorrow 14:00-16:00
  const nySite = sites.find(s => s.name === "New York")!
  const hudsonRoom = rooms.find(r => r.name === "Hudson" && r.siteId === nySite.id)!

  const booking2StartLocal = new Date(tomorrow)
  booking2StartLocal.setHours(14, 0, 0, 0)
  const booking2EndLocal = new Date(tomorrow)
  booking2EndLocal.setHours(16, 0, 0, 0)

  const booking2 = await prisma.booking.create({
    data: {
      roomId: hudsonRoom.id,
      ownerId: bobUser.id,
      startUtc: booking2StartLocal,
      endUtc: booking2EndLocal,
    },
  })

  // Create booking slots for booking2
  await prisma.bookingSlot.createMany({
    data: [
      {
        bookingId: booking2.id,
        roomId: hudsonRoom.id,
        slotStartUtc: new Date(tomorrow.setHours(14, 0, 0, 0)),
      },
      {
        bookingId: booking2.id,
        roomId: hudsonRoom.id,
        slotStartUtc: new Date(tomorrow.setHours(14, 30, 0, 0)),
      },
      {
        bookingId: booking2.id,
        roomId: hudsonRoom.id,
        slotStartUtc: new Date(tomorrow.setHours(15, 0, 0, 0)),
      },
      {
        bookingId: booking2.id,
        roomId: hudsonRoom.id,
        slotStartUtc: new Date(tomorrow.setHours(15, 30, 0, 0)),
      },
    ],
  })

  // Log activity for booking creation
  await prisma.activityLog.create({
    data: {
      actorId: bobUser.id,
      action: "BOOKING_CREATED",
      entityType: "booking",
      entityId: booking2.id,
      metadata: {
        roomId: hudsonRoom.id,
        roomName: hudsonRoom.name,
        site: nySite.name,
        startUtc: booking2StartLocal.toISOString(),
        endUtc: booking2EndLocal.toISOString(),
      },
    },
  })

  console.log("Created sample bookings")
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
