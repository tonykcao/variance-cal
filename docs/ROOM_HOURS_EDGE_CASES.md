# Room Hours Edge Cases Documentation

## Overview

This document outlines all edge cases and handling strategies for room hours changes in the NookBook system. Room hours changes can have significant impacts on existing bookings, and proper handling is critical for system integrity.

## Edge Cases and Handling

### 1. Reducing Room Hours with Existing Bookings

#### Scenario

Admin attempts to reduce room hours (e.g., from 20:00 to 17:00) while bookings exist in the removed time period.

#### Detection

- System queries all non-cancelled bookings for the room
- Checks if any booking slots fall outside new hours
- Considers both single-day and recurring patterns

#### Handling Options

1. **Block the change** (Recommended for MVP)
   - Return error with list of conflicting bookings
   - Provide clear messaging about conflicts
   - Suggest admin cancel bookings first

2. **Auto-cancel affected bookings** (Future enhancement)
   - Notify affected users
   - Log cancellations in activity log
   - Provide compensation/credits

3. **Grandfather existing bookings** (Complex)
   - Allow existing bookings to remain
   - Apply new hours only to new bookings
   - Requires dual hour tracking

#### Implementation Status

- [x] Detection logic implemented
- [x] Error messaging implemented
- [ ] Auto-cancellation (future)
- [ ] Grandfathering (future)

### 2. Room Hours Changes During Active Bookings

#### Scenario

Admin changes hours while a booking is currently in progress.

#### Detection

```typescript
const now = new Date()
const activeBookings = await prisma.booking.findMany({
  where: {
    roomId,
    canceledAt: null,
    startUtc: { lte: now },
    endUtc: { gte: now },
  },
})
```

#### Handling

1. **Prevent changes during active bookings**
   - Block any hour changes that would affect in-progress bookings
   - Allow changes that don't affect current time slot

2. **Apply changes after active booking ends**
   - Queue the change
   - Apply once room is vacant

#### Implementation Status

- [x] Active booking detection
- [x] Blocking logic
- [ ] Queued changes (future)

### 3. Complete Room Closure

#### Scenario

Admin sets all days to closed (00:00 - 00:00) effectively closing the room.

#### Detection

- Check if all days have matching open/close times of 00:00
- Count all future non-cancelled bookings

#### Handling

1. **Require explicit confirmation**
   - Show count of affected bookings
   - List upcoming bookings that would be cancelled
   - Require typed confirmation

2. **Cascade cancellation**
   - Cancel all future bookings
   - Send notifications to all affected users
   - Log all cancellations

#### Implementation Status

- [x] Closure detection logic
- [ ] UI confirmation dialog
- [ ] Batch cancellation
- [ ] Notification system

### 4. Partial Day Closures

#### Scenario

Admin closes specific days of the week while bookings exist on those days.

#### Example

```json
{
  "mon": { "open": "08:00", "close": "20:00" },
  "tue": { "open": "00:00", "close": "00:00" }, // Closed
  "wed": { "open": "08:00", "close": "20:00" }
}
```

#### Handling

- Identify bookings on affected days
- Apply same logic as complete closure but day-specific
- Preserve bookings on unaffected days

#### Implementation Status

- [x] Day-specific validation
- [x] Affected booking identification
- [ ] Selective cancellation

### 5. Extended Hours with Immediate Bookings

#### Scenario

Admin extends hours and users immediately try to book the newly available slots.

#### Challenges

- Race conditions between hour update and new bookings
- Cache invalidation timing
- UI update delays

#### Handling

1. **Transactional updates**
   - Update hours and invalidate cache atomically
   - Ensure availability queries see new hours immediately

2. **Optimistic UI updates**
   - Show new hours immediately in UI
   - Handle booking failures gracefully

#### Implementation Status

- [x] Transactional hour updates
- [ ] Cache invalidation strategy
- [ ] Optimistic UI updates

### 6. Timezone-Related Edge Cases

#### Scenario

Room hours change across timezone boundaries, especially near DST transitions.

#### Note

**MVP explicitly excludes DST support** - All times use fixed UTC offsets.

#### Handling

- All times stored in UTC
- Hour changes validated in room's local timezone
- Display both room-local and user-local times

#### Implementation Status

- [x] UTC storage
- [x] Timezone conversion utilities
- [x] Dual timezone display
- [ ] DST handling (out of scope for MVP)

### 7. Effective Date Implementation

#### Scenario

Admin wants to change hours starting from a future date, not immediately.

#### Database Schema Change Required

```prisma
model RoomHoursChange {
  id           String   @id @default(cuid())
  roomId       String
  effectiveFrom DateTime
  opening      Json
  createdBy    String
  createdAt    DateTime @default(now())

  room         Room     @relation(fields: [roomId], references: [id])
  creator      User     @relation(fields: [createdBy], references: [id])

  @@index([roomId, effectiveFrom])
}
```

#### Logic

1. Check current hours for bookings before effective date
2. Check new hours for bookings after effective date
3. Display both current and upcoming hours in UI

#### Implementation Status

- [ ] Schema for scheduled changes
- [ ] Validation logic
- [ ] UI for effective dates
- [ ] Scheduled job for applying changes

### 8. Concurrent Modification

#### Scenario

Multiple admins try to change the same room's hours simultaneously.

#### Handling

1. **Optimistic locking**
   - Include version/timestamp in update
   - Reject if room was modified since read

2. **Last-write-wins**
   - Accept all changes
   - Log all attempts in activity log

#### Implementation Status

- [ ] Optimistic locking
- [x] Activity logging
- [ ] Conflict resolution UI

### 9. Invalid Hour Formats

#### Scenarios

- Hours outside 00:00-23:59 range
- Close time before open time
- Invalid format (e.g., "8:00" instead of "08:00")
- Missing days

#### Validation Rules

```typescript
const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

function validateHours(opening: any): boolean {
  const requiredDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

  for (const day of requiredDays) {
    if (!opening[day]) return false

    const { open, close } = opening[day]

    if (!timeRegex.test(open) || !timeRegex.test(close)) {
      return false
    }

    const openMinutes = parseTimeToMinutes(open)
    const closeMinutes = parseTimeToMinutes(close)

    // Allow 00:00-00:00 for closed days
    if (openMinutes === 0 && closeMinutes === 0) continue

    if (closeMinutes <= openMinutes) return false
  }

  return true
}
```

#### Implementation Status

- [x] Format validation
- [x] Range validation
- [x] Completeness validation
- [x] Error messages

### 10. Booking Slot Cleanup

#### Scenario

After room hours are reduced, orphaned booking slots might exist.

#### Detection

```sql
SELECT bs.* FROM BookingSlot bs
JOIN Room r ON bs.roomId = r.id
WHERE
  -- Check if slot is outside new hours
  EXTRACT(HOUR FROM bs.slotStartUtc) >= new_close_hour
  OR EXTRACT(HOUR FROM bs.slotStartUtc) < new_open_hour
```

#### Handling

1. **Preventive validation**
   - Block changes that would orphan slots

2. **Cleanup job**
   - Identify orphaned slots
   - Cancel associated bookings
   - Remove slot records

#### Implementation Status

- [x] Validation prevents orphaned slots
- [ ] Cleanup job (future)
- [ ] Monitoring for orphaned data

## Testing Checklist

### Unit Tests

- [x] Hour format validation
- [x] Time range validation
- [x] Timezone conversion
- [x] Slot enumeration

### Integration Tests

- [x] Booking conflict detection
- [x] Active booking protection
- [x] Room closure handling
- [x] Partial day closures
- [x] Activity logging
- [ ] Effective date changes
- [ ] Concurrent modifications

### End-to-End Tests

- [ ] Admin reduces hours with conflicts
- [ ] Admin closes room completely
- [ ] User books newly extended hours
- [ ] Multiple admins modify same room

## Monitoring and Alerts

### Metrics to Track

1. Failed hour change attempts
2. Number of bookings affected by changes
3. Time between hour change and first new booking
4. Orphaned slot detection

### Alerts to Configure

1. High rate of failed hour changes
2. Orphaned slots detected
3. Booking cancellation spikes
4. Activity log anomalies

## Future Enhancements

### Phase 2

- Scheduled hour changes with effective dates
- Bulk hour changes across multiple rooms
- Hour change templates
- Seasonal hour adjustments

### Phase 3

- DST handling
- Temporary hour overrides
- Holiday schedules
- Recurring maintenance windows

## Decision Log

| Date       | Decision                     | Rationale                                  |
| ---------- | ---------------------------- | ------------------------------------------ |
| 2025-09-25 | Block changes with conflicts | Simplest for MVP, preserves data integrity |
| 2025-09-25 | No DST support in MVP        | Reduces complexity, fixed UTC offsets      |
| 2025-09-25 | No effective dates in MVP    | Simplifies implementation                  |
| 2025-09-25 | Activity log all changes     | Audit trail for debugging                  |

## References

- [Prisma Schema](../prisma/schema.prisma)
- [Time Utilities](../core/time.ts)
- [Opening Hours Validator](../core/opening-hours.ts)
- [Room Hours Test Suite](../test/integration/room-hours-changes.test.ts)
