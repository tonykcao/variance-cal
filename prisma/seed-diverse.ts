import { PrismaClient, Role } from "@prisma/client"
import { addDays, setHours, setMinutes, startOfDay } from "date-fns"

const prisma = new PrismaClient()

async function main() {
  console.log("Starting diverse seed...")

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
      email: "alice@example.com",
      name: "alice-admin",
      timezone: "America/Los_Angeles",
      role: Role.ADMIN,
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

  const connorUser = await prisma.user.create({
    data: {
      email: "connor@example.com",
      name: "connor-user",
      timezone: "Europe/London",
      role: Role.USER,
    },
  })

  // Create 3 dummy users for testing
  const dummy1 = await prisma.user.create({
    data: {
      email: "dummy1@test.com",
      name: "dummy1",
      timezone: "America/Los_Angeles",
      role: Role.USER,
    },
  })

  const dummy2 = await prisma.user.create({
    data: {
      email: "dummy2@test.com",
      name: "dummy2",
      timezone: "America/New_York",
      role: Role.USER,
    },
  })

  const dummy3 = await prisma.user.create({
    data: {
      email: "dummy3@test.com",
      name: "dummy3",
      timezone: "Europe/London",
      role: Role.USER,
    },
  })

  console.log("Created users")

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

  const [sfSite, nySite, londonSite, shanghaiSite] = sites

  // Room names
  const roomNames = {
    "San Francisco": ["Oak", "Maple", "Cedar", "Redwood", "Bay"],
    "New York": ["Hudson", "Broadway", "Liberty", "Empire", "Central"],
    London: ["Thames", "Borough", "Camden", "Soho", "Greenwich"],
    Shanghai: ["Bund", "Pudong", "Jing'an", "Xuhui", "Luwan"],
  }

  // Create rooms with varied opening hours
  const rooms = []
  for (const site of sites) {
    const siteRoomNames = roomNames[site.name as keyof typeof roomNames] || []
    for (let i = 0; i < siteRoomNames.length; i++) {
      const roomName = siteRoomNames[i]
      const capacity = 4 + Math.floor(i * 1.5) // Varied capacity 4-10

      // Varied opening hours
      let opening = {}
      if (i === 0) {
        // First room: Early bird hours (7am-6pm)
        opening = {
          mon: { open: "07:00", close: "18:00" },
          tue: { open: "07:00", close: "18:00" },
          wed: { open: "07:00", close: "18:00" },
          thu: { open: "07:00", close: "18:00" },
          fri: { open: "07:00", close: "18:00" },
          sat: { open: "09:00", close: "14:00" }, // Short Saturday
          sun: { open: "10:00", close: "14:00" }, // Short Sunday
        }
      } else if (i === 1) {
        // Second room: Standard hours (8am-8pm)
        opening = {
          mon: { open: "08:00", close: "20:00" },
          tue: { open: "08:00", close: "20:00" },
          wed: { open: "08:00", close: "20:00" },
          thu: { open: "08:00", close: "20:00" },
          fri: { open: "08:00", close: "20:00" },
          sat: { open: "08:00", close: "20:00" },
          sun: { open: "08:00", close: "20:00" },
        }
      } else if (i === 2) {
        // Third room: Late hours (10am-10pm)
        opening = {
          mon: { open: "10:00", close: "22:00" },
          tue: { open: "10:00", close: "22:00" },
          wed: { open: "10:00", close: "22:00" },
          thu: { open: "10:00", close: "22:00" },
          fri: { open: "10:00", close: "22:00" },
          sat: { open: "12:00", close: "20:00" },
          sun: { open: "12:00", close: "20:00" },
        }
      } else {
        // Others: Standard business hours
        opening = {
          mon: { open: "09:00", close: "18:00" },
          tue: { open: "09:00", close: "18:00" },
          wed: { open: "09:00", close: "18:00" },
          thu: { open: "09:00", close: "18:00" },
          fri: { open: "09:00", close: "18:00" },
          sat: { open: "09:00", close: "17:00" },
          sun: { open: "09:00", close: "17:00" },
        }
      }

      const room = await prisma.room.create({
        data: {
          siteId: site.id,
          name: roomName,
          capacity,
          opening,
        },
      })
      rooms.push(room)
    }
  }

  console.log(`Created ${rooms.length} rooms with varied opening hours`)

  // Helper function to create booking with slots
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

    // Create slots
    const slots = []
    let current = new Date(startUtc)
    while (current < endUtc) {
      slots.push(new Date(current))
      current = new Date(current.getTime() + 30 * 60 * 1000) // Add 30 minutes
    }

    await prisma.bookingSlot.createMany({
      data: slots.map((slotStart) => ({
        bookingId: booking.id,
        roomId: room.id,
        slotStartUtc: slotStart,
      })),
    })

    // Add attendees
    if (attendees.length > 0) {
      await prisma.bookingAttendee.createMany({
        data: attendees.map((userId) => ({
          bookingId: booking.id,
          userId,
        })),
      })
    }

    return booking
  }

  // Create diverse bookings over 2 weeks
  const today = startOfDay(new Date())
  const bookings = []

  // Week 1 - Current week

  // Monday - Early morning standup
  let date = addDays(today, ((1 - today.getDay() + 7) % 7) || 7) // Next Monday
  let room = rooms.find(r => r.name === "Oak")!
  bookings.push(
    await createBookingWithSlots(
      room,
      aliceAdmin,
      setMinutes(setHours(date, 7), 30), // 7:30 AM
      setMinutes(setHours(date, 8), 0),  // 8:00 AM
      [bobUser.id, connorUser.id],
      "Weekly standup meeting - Please prepare your updates"
    )
  )

  // Monday - Afternoon product review
  room = rooms.find(r => r.name === "Hudson")!
  bookings.push(
    await createBookingWithSlots(
      room,
      bobUser,
      setHours(date, 14), // 2:00 PM
      setHours(date, 16), // 4:00 PM
      [aliceAdmin.id, dummy1.id],
      "Product review - New features demo and feedback session"
    )
  )

  // Tuesday - Cross-timezone meeting (SF-London)
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Thames")!
  bookings.push(
    await createBookingWithSlots(
      room,
      connorUser,
      setHours(date, 17), // 5:00 PM London time
      setMinutes(setHours(date, 18), 30), // 6:30 PM
      [dummy3.id],
      "International sync - Discussing Q4 objectives with SF team"
    )
  )

  // Wednesday - All hands in SF
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Bay")!
  bookings.push(
    await createBookingWithSlots(
      room,
      aliceAdmin,
      setHours(date, 11), // 11:00 AM
      setHours(date, 13), // 1:00 PM
      [bobUser.id, connorUser.id, dummy1.id], // Max attendees
      "All hands meeting - Quarterly update and team announcements"
    )
  )

  // Thursday - Working session in Shanghai
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Bund")!
  bookings.push(
    await createBookingWithSlots(
      room,
      dummy3,
      setHours(date, 10), // 10:00 AM
      setHours(date, 12), // 12:00 PM
      [],
      "Deep work session - Focus time for Q4 planning document"
    )
  )

  // Friday - Late evening workshop
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Camden")! // Late hours room
  bookings.push(
    await createBookingWithSlots(
      room,
      connorUser,
      setHours(date, 19), // 7:00 PM
      setMinutes(setHours(date, 21), 30), // 9:30 PM
      [dummy2.id, dummy3.id],
      "Innovation workshop - Brainstorming session for 2025 initiatives"
    )
  )

  // Weekend - Saturday morning yoga
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Maple")!
  bookings.push(
    await createBookingWithSlots(
      room,
      dummy1,
      setHours(date, 9), // 9:00 AM
      setMinutes(setHours(date, 10), 30), // 10:30 AM
      [dummy2.id],
      "Saturday yoga session - Bring your own mat!"
    )
  )

  // Week 2 - Next week varied bookings

  // Monday - Client presentation
  date = addDays(date, 2) // Skip Sunday
  room = rooms.find(r => r.name === "Broadway")!
  bookings.push(
    await createBookingWithSlots(
      room,
      bobUser,
      setHours(date, 13), // 1:00 PM
      setHours(date, 15), // 3:00 PM
      [aliceAdmin.id],
      "Client presentation - Project Variance final demo"
    )
  )

  // Tuesday - Interview marathon
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Liberty")!
  bookings.push(
    await createBookingWithSlots(
      room,
      aliceAdmin,
      setHours(date, 9), // 9:00 AM
      setHours(date, 17), // 5:00 PM - Full day
      [bobUser.id],
      "Interview day - 6 candidates for senior engineering role. Schedule attached."
    )
  )

  // Wednesday - Quick sync
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Soho")!
  bookings.push(
    await createBookingWithSlots(
      room,
      connorUser,
      setMinutes(setHours(date, 15), 30), // 3:30 PM
      setHours(date, 16), // 4:00 PM - Just 30 min
      [],
      "Quick sync on deployment plans"
    )
  )

  // Thursday - Training session
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Central")!
  bookings.push(
    await createBookingWithSlots(
      room,
      dummy2,
      setHours(date, 14), // 2:00 PM
      setHours(date, 17), // 5:00 PM
      [dummy1.id, dummy3.id],
      "Training: Advanced TypeScript patterns and best practices"
    )
  )

  // Friday - End of week celebration
  date = addDays(date, 1)
  room = rooms.find(r => r.name === "Redwood")!
  bookings.push(
    await createBookingWithSlots(
      room,
      aliceAdmin,
      setHours(date, 16), // 4:00 PM
      setHours(date, 18), // 6:00 PM
      [bobUser.id, connorUser.id, dummy1.id],
      "End of sprint celebration - Pizza and retrospective"
    )
  )

  console.log(`Created ${bookings.length} diverse bookings with notes`)
  console.log("Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })