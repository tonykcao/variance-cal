const { prisma } = require("../lib/db")

async function checkDatabase() {
  try {
    const sites = await prisma.site.count()
    const rooms = await prisma.room.count()
    const users = await prisma.user.count()
    const bookings = await prisma.booking.count()

    console.log("Database counts:", { sites, rooms, users, bookings })

    const sampleSites = await prisma.site.findMany({ take: 3 })
    console.log(
      "Sample sites:",
      sampleSites.map(s => ({ id: s.id, name: s.name }))
    )

    const sampleRooms = await prisma.room.findMany({
      take: 3,
      include: { site: true },
    })
    console.log(
      "Sample rooms:",
      sampleRooms.map(r => ({
        id: r.id,
        name: r.name,
        siteName: r.site.name,
        capacity: r.capacity,
      }))
    )
  } catch (error) {
    console.error("Database check error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabase()
