# Edge Case Test Scenarios

This document outlines critical edge cases that need comprehensive test coverage.

## 1. Admin Changing Room Hours

### Scenario 1.1: Reducing Hours with Existing Bookings

```typescript
test("should handle room hours reduction with existing bookings", async () => {
  // Setup: Room open 8:00-20:00 with booking at 19:00-20:00
  const room = await createRoom({
    opening: { mon: { open: "08:00", close: "20:00" } },
  })
  const booking = await createBooking({
    roomId: room.id,
    startLocal: "2025-09-24T19:00",
    endLocal: "2025-09-24T20:00",
  })

  // Action: Admin changes hours to 8:00-18:00
  const updateResult = await updateRoomHours(room.id, {
    mon: { open: "08:00", close: "18:00" },
  })

  // Expected behavior options:
  // Option A: Reject the change
  expect(updateResult.error).toBe("Cannot reduce hours: existing bookings conflict")

  // Option B: Cancel affected bookings with notification
  expect(updateResult.canceledBookings).toContain(booking.id)
  expect(notificationsSent).toContain({
    userId: booking.ownerId,
    type: "BOOKING_CANCELED_HOURS_CHANGE",
  })
})
```

### Scenario 1.2: Closing Room Entirely

```typescript
test("should handle room closure with future bookings", async () => {
  // Room with multiple future bookings
  const room = await createRoomWithBookings(5)

  // Admin sets room to closed (no hours)
  const result = await updateRoomHours(room.id, {
    mon: null,
    tue: null,
    wed: null,
    thu: null,
    fri: null,
    sat: null,
    sun: null,
  })

  // Should cancel all future bookings
  const bookings = await getBookingsByRoom(room.id)
  expect(bookings.every(b => b.canceledAt !== null)).toBe(true)
})
```

## 2. Timezone Edge Cases (NO DST SUPPORT)

### Scenario 2.1: Cross-Timezone Midnight Booking

```typescript
test("should handle booking around midnight across timezones", async () => {
  // User in LA booking room in NY at midnight NY time
  const userTimezone = "America/Los_Angeles" // UTC-8
  const roomTimezone = "America/New_York" // UTC-5

  const room = await createRoom({
    siteId: "new-york",
    timezone: roomTimezone,
  })

  // Book 11:30 PM to 12:30 AM NY time (8:30 PM to 9:30 PM LA time)
  const booking = await createBooking({
    roomId: room.id,
    startLocal: "2025-09-24T23:30", // NY time
    endLocal: "2025-09-25T00:30", // NY time (next day)
  })

  // Verify correct date handling
  expect(booking.startUtc).toEqual(new Date("2025-09-25T03:30:00Z"))
  expect(booking.endUtc).toEqual(new Date("2025-09-25T04:30:00Z"))

  // Display should show different dates in different timezones
  const displayNY = formatInTimezone(booking.startUtc, roomTimezone)
  const displayLA = formatInTimezone(booking.startUtc, userTimezone)
  expect(displayNY).toContain("Sep 24") // 11:30 PM Sep 24
  expect(displayLA).toContain("Sep 24") // 8:30 PM Sep 24
})
```

## 3. Concurrent Operations

### Scenario 3.1: Multiple Users Booking Same Slot

```typescript
test("should handle concurrent booking attempts", async () => {
  const room = await createRoom()
  const users = await createUsers(10)
  const slotTime = "2025-09-24T10:00"

  // All users try to book the same slot simultaneously
  const bookingPromises = users.map(user =>
    createBooking({
      roomId: room.id,
      userId: user.id,
      startLocal: slotTime,
      endLocal: "2025-09-24T10:30",
    }).catch(err => ({ error: err.message }))
  )

  const results = await Promise.all(bookingPromises)

  // Only one should succeed
  const successes = results.filter(r => !r.error)
  const failures = results.filter(r => r.error)

  expect(successes.length).toBe(1)
  expect(failures.length).toBe(9)
  expect(failures[0].error).toContain("already booked")
})
```

### Scenario 3.2: Admin Canceling During User Booking

```typescript
test("should handle admin cancellation during user booking flow", async () => {
  const room = await createRoom()
  const existingBooking = await createBooking({
    roomId: room.id,
    startLocal: "2025-09-24T10:00",
    endLocal: "2025-09-24T11:00",
  })

  // User starts booking process (checking availability)
  const availabilityCheck = await checkAvailability({
    roomId: room.id,
    date: "2025-09-24",
  })
  expect(availabilityCheck.slots["10:00"]).toBe(false) // Occupied

  // Admin cancels the existing booking
  await cancelBooking(existingBooking.id, { asAdmin: true })

  // User tries to complete their booking for the now-free slot
  const userBooking = await createBooking({
    roomId: room.id,
    startLocal: "2025-09-24T10:00",
    endLocal: "2025-09-24T10:30",
  })

  // Should succeed since slot is now free
  expect(userBooking.id).toBeDefined()
})
```

## 4. Data Validation Edge Cases

### Scenario 4.1: Booking in the Past

```typescript
test("should reject bookings in the past", async () => {
  const room = await createRoom()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const result = await createBooking({
    roomId: room.id,
    startLocal: yesterday.toISOString(),
    endLocal: new Date(yesterday.getTime() + 3600000).toISOString(),
  }).catch(err => err)

  expect(result.message).toContain("Cannot book in the past")
})
```

### Scenario 4.2: Multi-Day Booking Validation

```typescript
test("should handle multi-day booking with different hours", async () => {
  const room = await createRoom({
    opening: {
      mon: { open: "09:00", close: "17:00" },
      tue: { open: "10:00", close: "16:00" }, // Different hours
      wed: null, // Closed
    },
  })

  // Try to book Mon 4PM to Tue 11AM (crosses closing time)
  const result = await createBooking({
    roomId: room.id,
    startLocal: "2025-09-22T16:00", // Monday
    endLocal: "2025-09-23T11:00", // Tuesday
  }).catch(err => err)

  expect(result.message).toContain("Booking spans closed hours")
})
```

### Scenario 4.3: Attendee Limit Edge Cases

```typescript
test("should handle attendee limit correctly", async () => {
  const owner = await createUser()
  const attendees = await createUsers(5)

  // Try to add more than 3 attendees
  const result = await createBooking({
    roomId: room.id,
    ownerId: owner.id,
    attendees: attendees.map(a => a.id), // 5 attendees
    startLocal: "2025-09-24T10:00",
    endLocal: "2025-09-24T11:00",
  }).catch(err => err)

  expect(result.message).toContain("Maximum 3 additional attendees")

  // Should not count owner as attendee if accidentally included
  const booking = await createBooking({
    roomId: room.id,
    ownerId: owner.id,
    attendees: [owner.id, attendees[0].id], // Owner + 1 other
    startLocal: "2025-09-24T14:00",
    endLocal: "2025-09-24T15:00",
  })

  const savedAttendees = await getBookingAttendees(booking.id)
  expect(savedAttendees.length).toBe(1) // Only the non-owner
})
```

## 5. Room Capacity Edge Cases

### Scenario 5.1: Booking Exceeds Room Capacity

```typescript
test("should validate attendee count against room capacity", async () => {
  const room = await createRoom({ capacity: 4 })
  const owner = await createUser()
  const attendees = await createUsers(4)

  // Owner + 4 attendees = 5 people, room capacity is 4
  const result = await createBooking({
    roomId: room.id,
    ownerId: owner.id,
    attendees: attendees.map(a => a.id),
    startLocal: "2025-09-24T10:00",
    endLocal: "2025-09-24T11:00",
  }).catch(err => err)

  expect(result.message).toContain("Exceeds room capacity")
})
```

## 6. Cancellation Edge Cases

### Scenario 6.1: Canceling Partially-Completed Booking

```typescript
test("should handle cancellation of in-progress booking", async () => {
  // Create booking from 10:00 to 12:00
  const booking = await createBooking({
    startUtc: new Date("2025-09-24T14:00:00Z"), // 10:00 EDT
    endUtc: new Date("2025-09-24T16:00:00Z"), // 12:00 EDT
  })

  // Simulate current time being 11:00 (booking in progress)
  vi.setSystemTime(new Date("2025-09-24T15:00:00Z"))

  // Cancel the booking
  await cancelBooking(booking.id)

  // Should only delete future slots (11:00-11:30, 11:30-12:00)
  const remainingSlots = await getBookingSlots(booking.id)
  const pastSlots = remainingSlots.filter(s => s.slotStartUtc < new Date())
  const futureSlots = remainingSlots.filter(s => s.slotStartUtc >= new Date())

  expect(pastSlots.length).toBe(2) // 10:00-10:30, 10:30-11:00
  expect(futureSlots.length).toBe(0) // All future slots deleted
})
```

## Required Test Implementation Priority

1. **CRITICAL**: Concurrent booking prevention (data integrity)
2. **HIGH**: Admin changing room hours (user impact)
3. **HIGH**: Timezone display consistency (without DST)
4. **MEDIUM**: Validation edge cases
5. **MEDIUM**: Multi-day booking validation
6. **LOW**: UI warning messages (covered by E2E tests)

## Notes for Implementation

- All timezone tests should use fixed dates to avoid flaky tests
- Use `vi.useFakeTimers()` for time-dependent tests
- Database tests should use transactions for rollback
- Consider using property-based testing for complex scenarios
- Mock external services (email, notifications) in tests
