# NookBook API Contracts Documentation

## Overview

NookBook is a coworking space booking system (similar to Airbnb, but for booking meeting rooms and workspaces during business hours). This document defines the API contracts for the system. All APIs follow RESTful conventions and return JSON responses.

### UI Design Theme

The system features a **minimalist, greyscale design** with the following characteristics:
- **Color Scheme**: Pure greyscale palette (no colors except for critical states)
- **Typography**: JetBrains Mono as primary font with monospace aesthetics
- **Layout**: Clean, minimal with generous whitespace and vertical sidebar
- **Components**: Flat design with subtle borders, no shadows or gradients
- **User Flow**: Direct landing on availability search (similar to Airbnb's immediate property search)

### Key Concepts

- **Coworking Space Model**: Unlike accommodation booking, rooms have daily operating hours (e.g., 8:00-20:00)
- **No Overnight Bookings**: All bookings must be within operating hours
- **Daily Boundaries**: Bookings cannot span multiple days continuously
- **30-Minute Slots**: All bookings align to 30-minute boundaries
- **Business Hours Only**: Rooms are closed outside operating hours

### Out of Scope (MVP)

- Multi-day continuous bookings (users must book each day separately)
- Recurring bookings
- DST (Daylight Saving Time) transitions
- 24-hour room access

## Authentication

All API endpoints require authentication via one of:
- `x-user-id` header (development mode)
- `mock-user-id` cookie (browser sessions)
- Session cookie with user information

### Important: After Re-seeding Database

When you re-seed the database, user IDs change. To update hardcoded IDs:
```bash
npm run db:seed          # Re-seed database
npm run db:update-ids    # Update hardcoded IDs in codebase
```

Clear browser cookies after updating IDs to avoid authentication issues.

## Base URL

Development: `http://localhost:3000/api`

---

## 1. Availability API

### GET /api/availability

Retrieves room availability for specified dates and filters.

#### Request

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| sites | string | No | Comma-separated site IDs | `site1,site2` |
| capacityMin | integer | No | Minimum room capacity | `4` |
| from | string | No | Start date (YYYY-MM-DD). Defaults to today | `2025-09-24` |
| to | string | No | End date (YYYY-MM-DD). Defaults to `from` value | `2025-09-26` |
| windowStart | string | No | Time window start (HH:mm) in room's timezone | `10:00` |
| windowEnd | string | No | Time window end (HH:mm) in room's timezone | `14:00` |

#### Response

**Success (200 OK):**

```json
{
  "rooms": [
    {
      "roomId": "room-id-123",
      "roomName": "Oak Room",
      "siteId": "site-id-456",
      "siteName": "San Francisco",
      "timezone": "America/Los_Angeles",
      "capacity": 6,
      "dates": [
        {
          "date": "2025-09-24",
          "slots": [
            {
              "startUtc": "2025-09-24T15:00:00.000Z",
              "endUtc": "2025-09-24T15:30:00.000Z",
              "available": true
            },
            {
              "startUtc": "2025-09-24T15:30:00.000Z",
              "endUtc": "2025-09-24T16:00:00.000Z",
              "available": false
            }
          ]
        }
      ]
    }
  ],
  "query": {
    "sites": ["site-id-456"],
    "capacityMin": 4,
    "from": "2025-09-24",
    "to": "2025-09-26",
    "timeWindow": {
      "start": "10:00",
      "end": "14:00"
    }
  }
}
```

**Error (500 Internal Server Error):**

```json
{
  "error": "Failed to fetch availability"
}
```

#### Notes

- The API returns `to + 1` days of data to make the date range inclusive
- All slot times are in UTC
- Slots are 30-minute intervals
- Unavailable slots include: booked slots, closed hours, and past times

---

## 2. Bookings API

### GET /api/bookings

Retrieves bookings for the current user.

#### Request

**Query Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| scope | string | No | Filter by booking status: `upcoming`, `past`, `all` | `upcoming` |

#### Response

**Success (200 OK):**

```json
{
  "bookings": [
    {
      "id": "booking-123",
      "roomId": "room-456",
      "room": {
        "id": "room-456",
        "name": "Oak Room",
        "site": {
          "id": "site-789",
          "name": "San Francisco",
          "timezone": "America/Los_Angeles"
        }
      },
      "ownerId": "user-123",
      "owner": {
        "id": "user-123",
        "name": "Alice User",
        "email": "alice@example.com"
      },
      "startUtc": "2025-09-24T15:00:00.000Z",
      "endUtc": "2025-09-24T17:00:00.000Z",
      "attendees": [
        {
          "user": {
            "id": "user-456",
            "name": "Bob User",
            "email": "bob@example.com"
          }
        }
      ],
      "canceledAt": null,
      "createdAt": "2025-09-23T10:00:00.000Z",
      "activities": [
        {
          "action": "BOOKING_CREATED",
          "createdAt": "2025-09-23T10:00:00.000Z",
          "actor": {
            "name": "Alice User"
          }
        }
      ]
    }
  ]
}
```

### POST /api/bookings

Creates a new booking.

#### Request

**Body (application/json):**

```json
{
  "roomId": "room-456",
  "startLocal": "2025-09-24T10:00",
  "endLocal": "2025-09-24T11:30",
  "attendees": ["user-456", "user-789"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| roomId | string | Yes | Room ID to book |
| startLocal | string | Yes | Start time in room's local timezone (YYYY-MM-DDTHH:mm) |
| endLocal | string | Yes | End time in room's local timezone (YYYY-MM-DDTHH:mm) |
| attendees | string[] | No | Array of user IDs (max 3) |

#### Response

**Success (201 Created):**

```json
{
  "booking": {
    "id": "booking-new-123",
    "roomId": "room-456",
    "roomName": "Oak Room",
    "siteName": "San Francisco",
    "timezone": "America/Los_Angeles",
    "startUtc": "2025-09-24T17:00:00.000Z",
    "endUtc": "2025-09-24T18:30:00.000Z",
    "startLocal": "2025-09-24 10:00",
    "endLocal": "2025-09-24 11:30",
    "owner": {
      "id": "user-123",
      "name": "Alice User",
      "email": "alice@example.com"
    },
    "attendees": [
      {
        "id": "user-456",
        "name": "Bob User",
        "email": "bob@example.com"
      }
    ]
  }
}
```

**Error (409 Conflict):**

```json
{
  "error": "Time slot already booked",
  "conflictingSlot": "2025-09-24T17:00:00.000Z"
}
```

**Error (400 Bad Request):**

```json
{
  "error": "Invalid booking times",
  "details": "Booking must be on 30-minute boundaries"
}
```

### DELETE /api/bookings/[id]

Cancels a booking.

#### Request

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Booking ID to cancel |

#### Response

**Success (200 OK):**

```json
{
  "message": "Booking canceled successfully",
  "freedSlots": 2
}
```

**Error (403 Forbidden):**

```json
{
  "error": "Not authorized to cancel this booking"
}
```

**Error (404 Not Found):**

```json
{
  "error": "Booking not found"
}
```

---

## 3. Sites API

### GET /api/sites

Retrieves all sites.

#### Response

**Success (200 OK):**

```json
{
  "sites": [
    {
      "id": "site-123",
      "name": "San Francisco",
      "timezone": "America/Los_Angeles",
      "rooms": [
        {
          "id": "room-456",
          "name": "Oak Room",
          "capacity": 6
        }
      ]
    }
  ]
}
```

---

## 4. Admin APIs

### POST /api/admin/sites

Creates a new site (Admin only).

#### Request

```json
{
  "name": "San Francisco",
  "timezone": "America/Los_Angeles"
}
```

#### Response

**Success (201 Created):**

```json
{
  "site": {
    "id": "site-new-123",
    "name": "San Francisco",
    "timezone": "America/Los_Angeles",
    "createdAt": "2025-09-24T10:00:00.000Z"
  }
}
```

### PUT /api/admin/sites

Updates an existing site (Admin only).

#### Request

```json
{
  "id": "site-123",
  "name": "San Francisco Bay Area",
  "timezone": "America/Los_Angeles"
}
```

#### Response

**Success (200 OK):**

```json
{
  "site": {
    "id": "site-123",
    "name": "San Francisco Bay Area",
    "timezone": "America/Los_Angeles",
    "updatedAt": "2025-09-24T10:30:00.000Z"
  }
}
```

### POST /api/admin/rooms

Creates a new room (Admin only).

#### Request

```json
{
  "siteId": "site-456",
  "name": "Oak Room",
  "capacity": 6,
  "opening": {
    "mon": { "open": "08:00", "close": "20:00" },
    "tue": { "open": "08:00", "close": "20:00" },
    "wed": { "open": "08:00", "close": "20:00" },
    "thu": { "open": "08:00", "close": "20:00" },
    "fri": { "open": "08:00", "close": "20:00" },
    "sat": { "open": "08:00", "close": "20:00" },
    "sun": { "open": "08:00", "close": "20:00" }
  }
}
```

#### Response

**Success (201 Created):**

```json
{
  "room": {
    "id": "room-new-123",
    "siteId": "site-456",
    "name": "Oak Room",
    "capacity": 6,
    "opening": {
      "mon": { "open": "08:00", "close": "20:00" },
      "tue": { "open": "08:00", "close": "20:00" },
      "wed": { "open": "08:00", "close": "20:00" },
      "thu": { "open": "08:00", "close": "20:00" },
      "fri": { "open": "08:00", "close": "20:00" },
      "sat": { "open": "08:00", "close": "20:00" },
      "sun": { "open": "08:00", "close": "20:00" }
    },
    "createdAt": "2025-09-24T10:00:00.000Z"
  }
}
```

### PUT /api/admin/rooms

Updates an existing room (Admin only). **IMPORTANT**: Handles existing bookings intelligently - truncates bookings that extend beyond new hours, cancels bookings completely outside new hours.

#### Request

```json
{
  "id": "room-123",
  "siteId": "site-456",
  "name": "Oak Conference Room",
  "capacity": 8,
  "opening": {
    "mon": { "open": "09:00", "close": "18:00" },
    "tue": { "open": "09:00", "close": "18:00" },
    "wed": { "open": "09:00", "close": "18:00" },
    "thu": { "open": "09:00", "close": "18:00" },
    "fri": { "open": "09:00", "close": "18:00" },
    "sat": { "open": "10:00", "close": "16:00" },
    "sun": { "open": "10:00", "close": "16:00" }
  }
}
```

#### Response

**Success (200 OK) with conflicts handled:**

```json
{
  "room": {
    "id": "room-123",
    "name": "Oak Conference Room",
    "capacity": 8,
    "opening": { "..." },
    "updatedAt": "2025-09-24T10:30:00.000Z"
  },
  "conflictsResolved": {
    "truncatedBookings": 2,
    "canceledBookings": 1,
    "details": [
      {
        "bookingId": "booking-456",
        "action": "truncated",
        "oldEnd": "2025-09-25T20:00:00.000Z",
        "newEnd": "2025-09-25T18:00:00.000Z"
      },
      {
        "bookingId": "booking-789",
        "action": "canceled",
        "reason": "completely outside new hours"
      }
    ]
  }
}
```

### GET /api/admin/activity

Retrieves global activity log (Admin only).

#### Request

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| entityType | string | No | Filter by entity type: `booking`, `room`, `site` |
| entityId | string | No | Filter by specific entity ID |
| limit | integer | No | Number of records to return (default: 50) |

#### Response

```json
{
  "activities": [
    {
      "id": "activity-123",
      "actorId": "user-456",
      "actor": {
        "name": "Alice User"
      },
      "action": "BOOKING_CREATED",
      "entityType": "booking",
      "entityId": "booking-789",
      "metadata": {
        "roomId": "room-123",
        "startUtc": "2025-09-24T15:00:00.000Z"
      },
      "createdAt": "2025-09-24T10:00:00.000Z"
    }
  ]
}
```

---

## Error Codes

| Code | Description | Common Causes |
|------|-------------|---------------|
| 400 | Bad Request | Invalid input parameters, malformed dates |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions for operation |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Booking slot already taken |
| 500 | Internal Server Error | Database or server error |

---

## Rate Limiting

Currently no rate limiting is implemented in development. Production deployment should consider:
- 100 requests per minute for availability queries
- 20 booking creations per hour per user
- 50 cancellations per hour per user

---

## Edge Cases and Validation

### Time Boundaries
- All bookings must align to 30-minute boundaries
- Bookings cannot be in the past
- Bookings must be within room operating hours (typically 8:00-20:00)
- Bookings cannot span across closing time (e.g., no 19:00-21:00 if room closes at 20:00)
- Maximum booking duration: 8 hours (within a single day)
- Maximum advance booking: 90 days
- Multi-day bookings: NOT SUPPORTED - each day requires a separate booking

### Capacity Constraints
- Attendee limit: 3 additional users (4 total including owner)
- Room capacity is enforced (total attendees <= room capacity)

### Timezone Handling
- All times stored in UTC
- Input times interpreted in room's timezone
- Output includes both UTC and local timezone information

### Concurrent Operations
- Database unique constraint on (roomId, slotStartUtc) prevents double-booking
- Optimistic locking not currently implemented (future enhancement)

### Cancellation Rules
- Users can only cancel their own bookings
- Admins can cancel any booking
- Partial cancellation: if booking is in progress, only future slots are freed
- Canceled bookings remain in history with canceledAt timestamp

---

## Webhooks (Future)

Planned webhook events:
- `booking.created`
- `booking.canceled`
- `room.updated`
- `site.updated`

---

## API Versioning

Currently unversioned. Future versions will use:
- URL versioning: `/api/v2/...`
- Header versioning: `X-API-Version: 2`