const { PrismaClient } = require('@prisma/client');
const { addDays, subDays, startOfDay, setHours } = require('date-fns');

const prisma = new PrismaClient();

async function addSampleBookings() {
  try {
    console.log('Adding sample bookings...');

    // Get users and rooms
    const users = await prisma.user.findMany({
      where: { role: { in: ['USER', 'ADMIN'] } }
    });
    const rooms = await prisma.room.findMany({
      include: { site: true }
    });

    console.log(`Found ${users.length} users and ${rooms.length} rooms`);

    const bookings = [];

    // Function to create booking slots for a time range
    function enumerateSlots(startUtc, endUtc) {
      const slots = [];
      const current = new Date(startUtc);
      while (current < endUtc) {
        slots.push(new Date(current));
        current.setMinutes(current.getMinutes() + 30);
      }
      return slots;
    }

    // Helper to convert local time to UTC
    function localToUtc(localDateTimeString, timezone) {
      // Simple conversion - in production would use proper timezone library
      const date = new Date(localDateTimeString);
      const offsets = {
        'America/Los_Angeles': 8 * 60, // PST offset in minutes
        'America/New_York': 5 * 60,    // EST offset in minutes
        'Europe/London': 0,            // GMT offset
        'Asia/Shanghai': -8 * 60       // CST offset in minutes
      };
      const offsetMinutes = offsets[timezone] || 0;
      return new Date(date.getTime() + offsetMinutes * 60 * 1000);
    }

    // PAST BOOKINGS (1-7 days ago)
    for (let dayOffset = -7; dayOffset <= -1; dayOffset++) {
      const bookingDate = addDays(new Date(), dayOffset);
      const dateStr = bookingDate.toISOString().split('T')[0];

      // Create 2-3 past bookings per day across different rooms/users
      const bookingsToday = Math.floor(Math.random() * 2) + 2; // 2-3 bookings

      for (let i = 0; i < bookingsToday; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const room = rooms[Math.floor(Math.random() * rooms.length)];

        // Random time between 9 AM and 5 PM
        const startHour = 9 + Math.floor(Math.random() * 8); // 9-16
        const duration = Math.floor(Math.random() * 3) + 1; // 1-3 hours

        const startLocal = `${dateStr}T${startHour.toString().padStart(2, '0')}:00`;
        const endLocal = `${dateStr}T${(startHour + duration).toString().padStart(2, '0')}:00`;

        const startUtc = localToUtc(startLocal, room.site.timezone);
        const endUtc = localToUtc(endLocal, room.site.timezone);

        bookings.push({
          roomId: room.id,
          ownerId: user.id,
          startUtc,
          endUtc,
          slots: enumerateSlots(startUtc, endUtc),
          isPast: true
        });
      }
    }

    // FUTURE BOOKINGS (7-14 days ahead)
    for (let dayOffset = 7; dayOffset <= 14; dayOffset++) {
      const bookingDate = addDays(new Date(), dayOffset);
      const dateStr = bookingDate.toISOString().split('T')[0];

      // Create 1-2 future bookings per day
      const bookingsToday = Math.floor(Math.random() * 2) + 1; // 1-2 bookings

      for (let i = 0; i < bookingsToday; i++) {
        const user = users[Math.floor(Math.random() * users.length)];
        const room = rooms[Math.floor(Math.random() * rooms.length)];

        // Random time between 10 AM and 4 PM
        const startHour = 10 + Math.floor(Math.random() * 6); // 10-15
        const duration = Math.floor(Math.random() * 2) + 1; // 1-2 hours

        const startLocal = `${dateStr}T${startHour.toString().padStart(2, '0')}:00`;
        const endLocal = `${dateStr}T${(startHour + duration).toString().padStart(2, '0')}:00`;

        const startUtc = localToUtc(startLocal, room.site.timezone);
        const endUtc = localToUtc(endLocal, room.site.timezone);

        bookings.push({
          roomId: room.id,
          ownerId: user.id,
          startUtc,
          endUtc,
          slots: enumerateSlots(startUtc, endUtc),
          isPast: false
        });
      }
    }

    // TODAY bookings (for testing current functionality)
    const today = new Date().toISOString().split('T')[0];
    const todayBooking = {
      roomId: rooms[0].id,
      ownerId: users[0].id,
      startUtc: localToUtc(`${today}T14:00`, rooms[0].site.timezone),
      endUtc: localToUtc(`${today}T15:30`, rooms[0].site.timezone),
    };
    todayBooking.slots = enumerateSlots(todayBooking.startUtc, todayBooking.endUtc);
    bookings.push(todayBooking);

    console.log(`Creating ${bookings.length} sample bookings...`);

    // Create bookings with slots
    let created = 0;
    for (const booking of bookings) {
      try {
        await prisma.$transaction(async (tx) => {
          // Create booking
          const newBooking = await tx.booking.create({
            data: {
              roomId: booking.roomId,
              ownerId: booking.ownerId,
              startUtc: booking.startUtc,
              endUtc: booking.endUtc,
            },
          });

          // Create slots
          await tx.bookingSlot.createMany({
            data: booking.slots.map(slotStartUtc => ({
              bookingId: newBooking.id,
              roomId: booking.roomId,
              slotStartUtc,
            })),
          });

          // Create activity log
          await tx.activityLog.create({
            data: {
              actorId: booking.ownerId,
              action: 'BOOKING_CREATED',
              entityType: 'booking',
              entityId: newBooking.id,
              metadata: {
                roomId: booking.roomId,
                startUtc: booking.startUtc.toISOString(),
                endUtc: booking.endUtc.toISOString(),
                sampleData: true,
              },
            },
          });

          created++;
        });
      } catch (error) {
        // Skip conflicts (multiple agents might run this)
        if (error.code !== 'P2002') {
          console.error('Error creating booking:', error);
        }
      }
    }

    console.log(`Successfully created ${created} sample bookings`);

    // Show final stats
    const totalBookings = await prisma.booking.count();
    const activeBookings = await prisma.booking.count({
      where: { canceledAt: null }
    });

    console.log(`\nFinal stats:`);
    console.log(`Total bookings: ${totalBookings}`);
    console.log(`Active bookings: ${activeBookings}`);

  } catch (error) {
    console.error('Error adding sample bookings:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleBookings();