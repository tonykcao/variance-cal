/**
 * Cleanup script to remove all bookings while preserving users, sites, and rooms
 */

import { prisma } from "../lib/db"

async function cleanupBookings() {
  console.log("=== Cleaning Up Bookings ===\n")

  try {
    // Delete all booking-related data
    console.log("Deleting booking attendees...")
    const attendees = await prisma.bookingAttendee.deleteMany()
    console.log(`  Removed ${attendees.count} attendee records`)

    console.log("Deleting booking slots...")
    const slots = await prisma.bookingSlot.deleteMany()
    console.log(`  Removed ${slots.count} slot records`)

    console.log("Deleting bookings...")
    const bookings = await prisma.booking.deleteMany()
    console.log(`  Removed ${bookings.count} bookings`)

    console.log("Deleting booking-related activity logs...")
    const activities = await prisma.activityLog.deleteMany({
      where: {
        entityType: "booking",
      },
    })
    console.log(`  Removed ${activities.count} activity log entries`)

    console.log("\n=== Cleanup Complete ===")
    console.log("All bookings have been removed.")
    console.log("Users, sites, and rooms remain intact.")
  } catch (error) {
    console.error("Cleanup failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupBookings()
