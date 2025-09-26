# NookBook LLM Agent Guide

## CRITICAL CONTEXT FOR LLM AGENTS

You are working on NookBook, a room booking system. This guide helps you understand the codebase quickly.

## IMMEDIATE UNDERSTANDING

### What This System Does
- Books meeting rooms across 4 global sites (SF, NY, London, Shanghai)
- Handles timezone conversions automatically
- Prevents double-booking through database constraints
- 30-minute slot granularity

### Core User Flow
1. User searches for available rooms by date/capacity/site
2. User selects time slots in a visual grid
3. User confirms booking with optional attendees
4. System prevents conflicts via unique constraints

## CRITICAL RULES - NEVER VIOLATE

1. **NO EMOJIS** - Never use emojis in code, output, or documentation
2. **UTC STORAGE** - All times stored as UTC in database
3. **SLOT BOUNDARIES** - All bookings align to 30-minute boundaries
4. **TRANSACTIONS** - Multi-step DB operations must use transactions
5. **NO DST** - System assumes fixed UTC offsets (no daylight saving)

## KEY FILES TO READ FIRST

```bash
# For understanding the system
prisma/schema.prisma      # Database schema - source of truth
app/api/availability/route.ts  # How availability works
app/api/bookings/route.ts      # Booking creation logic
core/slots.ts             # Slot calculation logic

# For UI work
app/dashboard/availability/page.tsx  # Main booking interface
components/availability/room-availability-grid.tsx  # Slot selection

# For testing
test/integration/concurrency.test.ts  # Concurrent booking tests
```

## DATABASE SCHEMA SUMMARY

```typescript
// Simplified mental model
User { id, email, name, timezone, role: USER|ADMIN }
Site { id, name, timezone }  // 4 sites: SF, NY, London, Shanghai
Room { id, siteId, name, capacity, opening_hours }
Booking { id, roomId, ownerId, startUtc, endUtc, canceledAt? }
BookingSlot { roomId, slotStartUtc } // UNIQUE prevents double-booking
BookingAttendee { bookingId, userId } // Max 3 per booking
ActivityLog { actorId, action, entityType, entityId, metadata }
```

## TIMEZONE HANDLING PATTERN

```typescript
// Input: User provides local time
const localTime = "2025-09-27T10:00"  // User sees this

// Convert to UTC for storage
const utcTime = localToUtc(localTime, room.site.timezone)

// Store UTC in database
await prisma.booking.create({ startUtc: utcTime })

// Display: Convert back to local
const displayTime = utcToLocal(booking.startUtc, userTimezone)
```

## CONCURRENCY SAFETY PATTERN

```typescript
// The BookingSlot table enforces uniqueness
await prisma.$transaction(async (tx) => {
  // 1. Create booking
  const booking = await tx.booking.create({...})

  // 2. Create slots (will fail if conflict)
  await tx.bookingSlot.createMany({
    data: slots.map(slot => ({
      bookingId: booking.id,
      roomId,
      slotStartUtc: slot  // UNIQUE constraint prevents double-booking
    }))
  })
})
```

## COMMON OPERATIONS

### Check Availability
```typescript
// 1. Get rooms for sites
const rooms = await prisma.room.findMany({ where: { siteId: { in: siteIds }}})

// 2. Get occupied slots
const occupied = await prisma.bookingSlot.findMany({
  where: { roomId: { in: roomIds }, slotStartUtc: { gte: start, lt: end }}
})

// 3. Calculate available slots
const available = allSlots.filter(slot => !occupied.has(slot))
```

### Create Booking
```typescript
// 1. Validate times align to 30-min boundaries
const snapped = snapTo30Minutes(inputTime)

// 2. Check within opening hours
if (!isWithinOpeningHours(room, snapped)) throw Error

// 3. Create in transaction (see concurrency pattern above)
```

### Cancel Booking
```typescript
// 1. Set canceledAt timestamp
await prisma.booking.update({ where: { id }, data: { canceledAt: new Date() }})

// 2. Delete future slots only
await prisma.bookingSlot.deleteMany({
  where: { bookingId: id, slotStartUtc: { gte: new Date() }}
})
```

## API ENDPOINTS

```bash
GET  /api/availability?sites[]=SF&capacityMin=4&from=2025-09-27
POST /api/bookings { roomId, startLocal, endLocal, attendees[] }
DELETE /api/bookings/[id]
GET  /api/bookings?scope=upcoming|past
GET  /api/sites
GET  /api/rooms
```

## TESTING APPROACH

```bash
# Quick test
npm test

# Test specific area
npm test availability
npm test booking
npm test concurrency

# Manual testing with test users
alice-admin   # Admin role
bob-user      # Regular user
connor-user   # Regular user
```

## DEBUGGING TIPS

```bash
# View database visually
npm run db:studio

# Reset database to clean state
npm run db:reset

# Check current bookings
SELECT * FROM Booking WHERE startUtc > NOW();

# Find slot conflicts
SELECT roomId, slotStartUtc, COUNT(*)
FROM BookingSlot
GROUP BY roomId, slotStartUtc
HAVING COUNT(*) > 1;
```

## COMMON PITFALLS TO AVOID

1. **Don't parse dates without timezone** - Always specify timezone
2. **Don't forget slot alignment** - Use snapTo30Minutes()
3. **Don't skip transactions** - Multi-step operations need atomicity
4. **Don't trust client times** - Validate on server
5. **Don't show canceled bookings as available** - Check canceledAt

## ERROR HANDLING PATTERNS

```typescript
// Unique constraint violation (double-booking)
catch (e) {
  if (e.code === 'P2002' && e.meta?.target?.includes('roomId')) {
    return { error: "Room already booked for this time" }
  }
}

// Outside opening hours
if (!isWithinOpeningHours(room, time)) {
  return { error: `Room only available ${room.opening[day].open}-${room.opening[day].close}` }
}

// Past time booking
if (isPast(requestedTime)) {
  return { error: "Cannot book past time slots" }
}
```

## UI COMPONENT STRUCTURE

```
app/dashboard/
  availability/page.tsx         # Main search page
    → AvailabilityFilters      # Site/date/capacity filters
    → RoomAvailabilityGrid     # Visual slot selection
    → CreateBookingModal       # Confirmation dialog

  my-bookings/page.tsx         # User's bookings
    → BookingsList            # Upcoming/past tabs
    → BookingCard            # Individual booking display
```

## STATE MANAGEMENT

- No global state library (use React hooks)
- Server state via SWR or React Query hooks
- Form state via controlled components
- URL state for filters (searchParams)

## DEVELOPMENT WORKFLOW

```bash
# Start everything
npm run quickstart  # First time
npm run dev        # Daily development

# Make changes
1. Edit code
2. Check http://localhost:3000
3. Run npm test
4. Commit changes

# Common tasks
npm run db:studio   # Inspect database
npm run lint       # Fix code style
npm run build      # Check production build
```

## MOCK AUTHENTICATION SYSTEM

The system uses mock authentication for development:
- User switcher in top navigation
- Stores user ID in cookie
- Middleware attaches user to requests
- Replace with real auth before production

## AGENT COMMUNICATION (ADVANCED)

Note: The codebase includes multi-agent coordination tools (currently commented out):
- `.agent-comm/` - Message passing between agents
- `.agent-locks/` - Process locking
- `scripts/agent-*.py` - Coordination scripts

These are for advanced multi-agent development workflows and can be ignored for single-agent work.

## QUICK WINS

If asked to improve the system, consider:
1. Add email notifications for bookings
2. Implement recurring bookings
3. Add room amenities/features
4. Create booking templates
5. Add usage analytics dashboard
6. Implement waitlist for full rooms
7. Add calendar export (ICS)
8. Create mobile-responsive design
9. Add real-time availability updates
10. Implement booking approval workflow

## REMEMBER

- Read CLAUDE.md for original requirements
- Check docs/ folder for detailed documentation
- Run tests before committing
- No emojis in any output
- Keep it simple and working