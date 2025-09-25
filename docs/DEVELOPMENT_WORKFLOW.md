# NookBook - Development Workflow Guide

## Development Philosophy

This project follows a test-driven, incremental development approach with clear separation of concerns. Each feature should be developed in small, testable chunks that maintain system stability at every step.

## Git Workflow

### Branch Strategy

```
main (production-ready)
├── develop (integration branch)
│   ├── feature/booking-creation
│   ├── feature/availability-api
│   ├── fix/timezone-bug
│   └── chore/update-dependencies
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `chore/` - Maintenance tasks
- `docs/` - Documentation updates
- `test/` - Test additions/improvements
- `refactor/` - Code refactoring

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Examples:

```bash
feat(booking): add attendee selection to booking modal
fix(availability): correct timezone conversion for Shanghai
test(core): add unit tests for slot enumeration
docs(api): update availability endpoint documentation
chore(deps): update prisma to 5.7.0
```

### Pull Request Process

1. Create feature branch from `develop`
2. Implement feature with tests
3. Ensure all checks pass
4. Create PR with description
5. Address review feedback
6. Merge after approval

## Development Process

### 1. Starting a New Feature

```bash
# 1. Update your local branches
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Install any new dependencies
npm install

# 4. Run database migrations
npx prisma migrate dev

# 5. Start development server
npm run dev
```

### 2. Development Cycle

```bash
# Watch mode for tests
npm run test:watch

# Type checking in watch mode
npm run typecheck:watch

# Run linting
npm run lint

# Format code
npm run format
```

### 3. Before Committing

```bash
# Run all checks
npm run check:all

# This runs:
# - TypeScript compilation
# - ESLint
# - Prettier
# - Tests
# - Build verification
```

## Code Development Guidelines

### Component Development

#### 1. Server Component (Default)

```typescript
// app/dashboard/rooms/page.tsx
import { getRooms } from '@/data/rooms'

export default async function RoomsPage() {
  const rooms = await getRooms()

  return (
    <div>
      {rooms.map(room => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  )
}
```

#### 2. Client Component (Interactive)

```typescript
// components/booking/BookingModal.tsx
'use client'

import { useState } from 'react'
import { createBooking } from '@/app/actions/bookings'

export function BookingModal({ roomId }: { roomId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    await createBooking(formData)
    setLoading(false)
  }

  return (
    <form action={handleSubmit}>
      {/* form content */}
    </form>
  )
}
```

### API Development

#### 1. Server Action (Mutations)

```typescript
// app/actions/bookings.ts
"use server"

import { z } from "zod"
import { revalidateTag } from "next/cache"

const createBookingSchema = z.object({
  roomId: z.string(),
  startLocal: z.string(),
  endLocal: z.string(),
  attendees: z.array(z.string()).max(3),
})

export async function createBooking(input: unknown) {
  // 1. Validate input
  const data = createBookingSchema.parse(input)

  // 2. Check permissions
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  // 3. Execute business logic
  const booking = await bookingService.create(data, user)

  // 4. Invalidate cache
  revalidateTag("availability")
  revalidateTag(`room-${data.roomId}`)

  return booking
}
```

#### 2. API Route (Queries)

```typescript
// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const querySchema = z.object({
  sites: z.array(z.string()),
  capacityMin: z.number().optional(),
  from: z.string(),
  to: z.string(),
})

export async function GET(request: NextRequest) {
  try {
    // 1. Parse query parameters
    const params = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams))

    // 2. Fetch data
    const availability = await getAvailability(params)

    // 3. Return response
    return NextResponse.json({ data: availability })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid parameters", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

### Database Operations

#### 1. Data Access Layer

```typescript
// data/bookings.ts
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export async function createBookingWithSlots(data: {
  roomId: string
  ownerId: string
  startUtc: Date
  endUtc: Date
  slots: Date[]
  attendees: string[]
}) {
  return prisma.$transaction(async tx => {
    // 1. Create booking
    const booking = await tx.booking.create({
      data: {
        roomId: data.roomId,
        ownerId: data.ownerId,
        startUtc: data.startUtc,
        endUtc: data.endUtc,
      },
    })

    // 2. Create slots (will fail if conflict)
    await tx.bookingSlot.createMany({
      data: data.slots.map(slot => ({
        bookingId: booking.id,
        roomId: data.roomId,
        slotStartUtc: slot,
      })),
    })

    // 3. Add attendees
    if (data.attendees.length > 0) {
      await tx.bookingAttendee.createMany({
        data: data.attendees.map(userId => ({
          bookingId: booking.id,
          userId,
        })),
      })
    }

    // 4. Log activity
    await tx.activityLog.create({
      data: {
        actorId: data.ownerId,
        action: "BOOKING_CREATED",
        entityType: "booking",
        entityId: booking.id,
        metadata: { roomId: data.roomId },
      },
    })

    return booking
  })
}
```

#### 2. Business Logic Layer

```typescript
// core/availability.ts
import { startOfDay, endOfDay, addMinutes } from "date-fns"
import { utcToZonedTime, zonedTimeToUtc } from "date-fns-tz"

export function calculateAvailableSlots(
  room: RoomWithOpeningHours,
  date: Date,
  bookedSlots: Date[]
): TimeSlot[] {
  const timezone = room.site.timezone
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  // Get opening hours for this day
  const dayOfWeek = format(date, "EEE").toLowerCase()
  const hours = room.opening[dayOfWeek]

  if (!hours) return []

  // Convert opening hours to UTC slots
  const slots: TimeSlot[] = []
  let current = parseOpeningTime(hours.open, date, timezone)
  const close = parseOpeningTime(hours.close, date, timezone)

  while (current < close) {
    const slotUtc = zonedTimeToUtc(current, timezone)
    const isBooked = bookedSlots.some(booked => booked.getTime() === slotUtc.getTime())

    slots.push({
      startUtc: slotUtc,
      endUtc: addMinutes(slotUtc, 30),
      available: !isBooked,
    })

    current = addMinutes(current, 30)
  }

  return slots
}
```

## Testing Workflow

### Test Organization

```
tests/
├── unit/           # Fast, isolated tests
├── integration/    # API and database tests
├── e2e/           # User journey tests
└── fixtures/      # Shared test data
```

### Writing Tests

#### 1. Unit Test Example

```typescript
// tests/unit/core/slots.test.ts
import { describe, it, expect } from "vitest"
import { snapTo30, enumerateSlots } from "@/core/slots"

describe("snapTo30", () => {
  it("rounds down to nearest 30 minutes", () => {
    const input = new Date("2025-01-15T10:15:00Z")
    const result = snapTo30(input)
    expect(result.toISOString()).toBe("2025-01-15T10:00:00.000Z")
  })

  it("keeps exact 30-minute marks", () => {
    const input = new Date("2025-01-15T10:30:00Z")
    const result = snapTo30(input)
    expect(result.toISOString()).toBe("2025-01-15T10:30:00.000Z")
  })
})
```

#### 2. Integration Test Example

```typescript
// tests/integration/api/bookings.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import { createBooking } from "@/app/actions/bookings"

describe("POST /api/bookings", () => {
  beforeEach(async () => {
    // Clean database
    await prisma.booking.deleteMany()
  })

  it("creates booking with valid data", async () => {
    const input = {
      roomId: "test-room",
      startLocal: "2025-01-15T10:00",
      endLocal: "2025-01-15T11:30",
      attendees: [],
    }

    const booking = await createBooking(input)

    expect(booking).toBeDefined()
    expect(booking.roomId).toBe(input.roomId)

    // Verify slots were created
    const slots = await prisma.bookingSlot.findMany({
      where: { bookingId: booking.id },
    })
    expect(slots).toHaveLength(3) // 3 x 30-minute slots
  })

  it("prevents double booking", async () => {
    // Create first booking
    await createBooking({
      roomId: "test-room",
      startLocal: "2025-01-15T10:00",
      endLocal: "2025-01-15T11:00",
    })

    // Attempt overlapping booking
    await expect(
      createBooking({
        roomId: "test-room",
        startLocal: "2025-01-15T10:30",
        endLocal: "2025-01-15T11:30",
      })
    ).rejects.toThrow("Room already booked")
  })
})
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/core/slots.test.ts

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run only unit tests
npm test tests/unit

# Run only integration tests
npm test tests/integration
```

## Debugging

### Server-Side Debugging

```typescript
// Use console.log with descriptive labels
console.log('[BookingAPI] Creating booking:', { roomId, startUtc })

// Use debugger statement
debugger // Breakpoint when running with --inspect

// Use VS Code debugger
// Add to .vscode/launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Next.js dev",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "dev"],
  "skipFiles": ["<node_internals>/**"],
  "console": "integratedTerminal"
}
```

### Client-Side Debugging

```typescript
// React Developer Tools
// Install browser extension for component inspection

// Use React DevTools Profiler
// Analyze component render performance

// Console logging with groups
console.group("Booking Submission")
console.log("Form Data:", formData)
console.log("Validation Result:", validation)
console.groupEnd()
```

### Database Debugging

```typescript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: ["query", "info", "warn", "error"],
})

// Log specific queries
const result = await prisma.$queryRaw`
  SELECT * FROM bookings WHERE room_id = ${roomId}
`
console.log("Raw query result:", result)
```

## Performance Optimization

### Development Performance

```bash
# Use Turbopack (experimental)
npm run dev -- --turbo

# Profile bundle size
npm run analyze

# Check lighthouse scores
npm run lighthouse
```

### Code Optimization

```typescript
// 1. Use dynamic imports for heavy components
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
  ssr: false
})

// 2. Memoize expensive computations
const expensiveResult = useMemo(
  () => calculateComplexValue(data),
  [data]
)

// 3. Use React.lazy for code splitting
const AdminPanel = lazy(() => import('./AdminPanel'))
```

## Deployment Process

### Pre-deployment Checklist

- [ ] All tests pass
- [ ] TypeScript compiles without errors
- [ ] No ESLint errors
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Performance benchmarks met
- [ ] Security scan passed

### Deployment Steps

```bash
# 1. Build the application
npm run build

# 2. Run production tests
npm run test:production

# 3. Deploy database migrations
npx prisma migrate deploy

# 4. Deploy application
npm run deploy

# 5. Run smoke tests
npm run test:smoke

# 6. Monitor logs
npm run logs:tail
```

## Troubleshooting Common Issues

### TypeScript Errors

```bash
# Clear TypeScript cache
rm -rf node_modules/.cache/typescript

# Regenerate types
npx prisma generate
npm run typecheck
```

### Prisma Issues

```bash
# Reset database
npx prisma migrate reset

# Regenerate client
npx prisma generate

# Check migration status
npx prisma migrate status
```

### Build Failures

```bash
# Clean build cache
rm -rf .next

# Clear all caches
npm run clean

# Fresh install
rm -rf node_modules package-lock.json
npm install
```

## Code Review Checklist

### Before Submitting PR

- [ ] Code follows project conventions
- [ ] Tests cover new functionality
- [ ] Documentation updated if needed
- [ ] No console.logs left in code
- [ ] Sensitive data not exposed
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Accessibility considered

### Reviewing PRs

- [ ] Code is readable and maintainable
- [ ] Business logic is correct
- [ ] Security implications considered
- [ ] Performance impact assessed
- [ ] Tests are comprehensive
- [ ] Edge cases handled

## Resources

### Internal Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Setup Guide](./SETUP_AND_ENVIRONMENT.md)
- [API Documentation](./API_DOCS.md)

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev)

## Getting Help

1. Check this documentation
2. Review existing code examples
3. Search closed PRs/issues
4. Ask in team channel
5. Create detailed issue with reproduction
