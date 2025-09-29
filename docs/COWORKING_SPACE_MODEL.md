# NookBook Coworking Space Model

## Overview

NookBook is designed for booking coworking spaces and meeting rooms, NOT overnight accommodation. This fundamental difference from Airbnb-style platforms drives many of our design decisions.

## Key Differences from Accommodation Booking

### 1. Operating Hours

- **Coworking Model**: Rooms have daily operating hours (e.g., 8:00 AM - 8:00 PM)
- **Accommodation Model**: 24/7 access with check-in/check-out times
- **Impact**: All bookings must be within operating hours for each day

### 2. Booking Duration

- **Coworking Model**: Hourly bookings during business hours only
- **Accommodation Model**: Nightly bookings with multi-day stays
- **Impact**: No overnight bookings; maximum duration per day limited by operating hours

### 3. Multi-Day Bookings

- **Coworking Model**: Each day requires a separate booking
- **Accommodation Model**: Single booking spans multiple nights
- **Impact**: Currently out of scope for MVP; users book each day independently

### 4. Usage Pattern

- **Coworking Model**: Professional meetings, work sessions, team collaboration
- **Accommodation Model**: Personal/business travel, extended stays
- **Impact**: Features focus on attendees, capacity, business amenities

## System Constraints

### Time Boundaries

1. **30-Minute Slots**: All bookings align to 30-minute boundaries
2. **Operating Hours**: Typically 8:00 AM - 8:00 PM (site-specific)
3. **No Cross-Day Bookings**: A booking cannot span midnight
4. **No After-Hours Access**: Bookings outside operating hours are rejected

### Validation Rules

```javascript
// Example validation for a booking request
function validateBookingTime(startTime, endTime, room) {
  // Must be within operating hours
  if (startTime < room.openingTime || endTime > room.closingTime) {
    throw new Error("Booking outside operating hours")
  }

  // Cannot span days
  if (startTime.date !== endTime.date) {
    throw new Error("Multi-day bookings not supported")
  }

  // Must align to 30-minute slots
  if (startTime.minutes % 30 !== 0 || endTime.minutes % 30 !== 0) {
    throw new Error("Times must align to 30-minute boundaries")
  }
}
```

## User Experience Implications

### Availability Search

- Shows daily grids with operating hours clearly marked
- Closed hours are visually disabled
- Time window filters respect operating hours

### Booking Creation

- Time pickers limited to operating hours
- Clear messaging about daily booking limits
- Cannot select times outside business hours

### My Bookings View

- Groups bookings by day
- Shows room-local operating hours
- Clear indication of business hours constraints

## Edge Cases

### 1. Weekend/Holiday Hours

- Some sites may have different weekend hours
- Holidays might have special hours or closures
- System must handle variable schedules

### 2. Time Zone Considerations

- User in different timezone sees room's local business hours
- Booking at "9 PM user time" might be within "6 PM room time"
- Clear display of both timezones required

### 3. Last-Minute Bookings

- Can book up to closing time
- Must handle "current time" validation
- No bookings for times that have already passed today

### 4. Booking Modifications

- Cannot extend beyond closing hours
- Cannot change to span multiple days
- Must maintain operating hours constraints

## Future Enhancements (Out of Scope for MVP)

1. **Recurring Bookings**: Weekly team meetings, regular workspace rentals
2. **Multi-Day Packages**: Book multiple days with single transaction
3. **After-Hours Access**: Special permissions for extended hours
4. **Flexible Hours**: Different hours for different user tiers
5. **24-Hour Spaces**: Some rooms could have 24/7 access

## API Contract Examples

### Valid Booking Request

```json
{
  "roomId": "sfo-001",
  "startLocal": "2025-09-25T10:00",
  "endLocal": "2025-09-25T12:00",
  "attendees": ["user-123", "user-456"]
}
```

### Invalid Requests

**Outside Operating Hours:**

```json
{
  "roomId": "sfo-001",
  "startLocal": "2025-09-25T22:00", // 10 PM - after closing
  "endLocal": "2025-09-25T23:00",
  "error": "Booking outside operating hours (8:00-20:00)"
}
```

**Spanning Days:**

```json
{
  "roomId": "sfo-001",
  "startLocal": "2025-09-25T18:00",
  "endLocal": "2025-09-26T10:00", // Next day
  "error": "Multi-day bookings not supported"
}
```

## Testing Considerations

### Critical Test Scenarios

1. Booking at opening time (8:00 AM)
2. Booking until closing time (8:00 PM)
3. Attempting to book after hours
4. Attempting to book across days
5. Time zone boundary testing
6. Operating hours validation

### Performance Testing

- Multiple users booking same morning slots
- Rush-hour booking patterns (9-10 AM)
- Concurrent bookings at popular times

## Database Design Impact

The `BookingSlot` table with unique constraint on `(roomId, slotStartUtc)` ensures:

- No double-booking of 30-minute slots
- Atomic slot allocation
- Efficient availability queries
- Support for partial cancellations

## Conclusion

The coworking space model fundamentally differs from accommodation booking. Our system is optimized for:

- Business hours operations
- Short-duration bookings
- Professional meeting spaces
- Daily booking patterns

Understanding these constraints helps maintain consistency across the application and sets appropriate user expectations.
