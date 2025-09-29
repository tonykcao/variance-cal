const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function checkData() {
  try {
    console.log("=== DATABASE CHECK ===")

    const sites = await prisma.site.findMany({
      include: { _count: { select: { rooms: true } } },
    })
    console.log(`Sites: ${sites.length}`)
    sites.forEach(site => {
      console.log(`  - ${site.name} (${site.timezone}) - ${site._count.rooms} rooms`)
    })

    const rooms = await prisma.room.findMany({
      include: { site: true },
    })
    console.log(`\nRooms: ${rooms.length}`)
    rooms.slice(0, 5).forEach(room => {
      console.log(`  - ${room.name} at ${room.site.name} (capacity: ${room.capacity})`)
    })

    const bookings = await prisma.booking.findMany({
      where: { canceledAt: null },
      include: { room: { include: { site: true } } },
    })
    console.log(`\nActive Bookings: ${bookings.length}`)
    bookings.slice(0, 3).forEach(booking => {
      console.log(
        `  - ${booking.room.name} (${booking.room.site.name}): ${booking.startUtc.toISOString()}`
      )
    })

    const users = await prisma.user.findMany()
    console.log(`\nUsers: ${users.length}`)
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role}`)
    })
  } catch (error) {
    console.error("Database check error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkData()
