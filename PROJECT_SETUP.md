# NookBook Project Setup & Development Guide

## Overview

NookBook is a room booking system for managing shared workspace reservations across multiple global sites with robust timezone support and concurrency-safe booking management.

## Code Style Rules

### IMPORTANT: No Emojis Policy
- **NO EMOJIS** in code, console output, comments, or documentation
- Use plain text status indicators: SUCCESS, ERROR, WARNING, INFO
- Use numbered steps: [1/7], [2/7] instead of emoji bullets
- Keep all output professional and text-based

## Tech Stack (Required)

### Core Framework & Language

- **Next.js 14+** with App Router (required)
- **TypeScript** everywhere (strict mode enabled)
- **React 18+** with Server Components

### Database & ORM

- **Prisma** as ORM (required)
- **MySQL 8.0+** (Docker or local install)
- Database URL: `mysql://root:password@localhost:3306/nookbook`

### Date & Time Handling

- **date-fns** for date manipulation
- **date-fns-tz** for timezone conversions
- All dates stored as UTC in database
- IANA timezone identifiers throughout

### UI & Styling

- **Tailwind CSS** for styling
- **shadcn/ui** components (Radix UI based)
- **lucide-react** for icons (ClipboardClock as logo)

### Validation & Type Safety

- **zod** for runtime validation
- **ts-pattern** for exhaustive pattern matching

### Authentication

- Mock auth via middleware (no external auth services)
- User selection via header `x-user-id` or session cookie
- Dev mode: Top-nav dropdown for user switching

### Testing

- **Vitest** as test runner
- **@testing-library/react** for component tests
- Test database separate from development

### Code Quality Tools

- **ESLint** with Next.js config
- **Prettier** for formatting
- **husky** for git hooks (optional)
- **lint-staged** for pre-commit checks (optional)

## Project Structure

```
variance-cal/
├── app/                          # Next.js App Router
│   ├── (marketing)/             # Public pages
│   │   └── page.tsx
│   ├── dashboard/               # Protected app pages
│   │   ├── layout.tsx
│   │   ├── availability/       # Primary booking screen
│   │   │   └── page.tsx
│   │   ├── my-bookings/        # User bookings view
│   │   │   └── page.tsx
│   │   └── admin/              # Admin panel
│   │       ├── sites/
│   │       ├── rooms/[siteId]/
│   │       └── activity/
│   └── api/                     # API routes
│       ├── availability/
│       ├── bookings/
│       ├── sites/
│       └── rooms/
├── components/                  # React components
│   ├── ui/                     # shadcn/ui components
│   ├── booking/                # Booking-specific components
│   └── layout/                 # Layout components
├── lib/                        # Shared utilities
│   ├── auth/                   # Mock auth utilities
│   ├── db/                     # Prisma client
│   └── utils/                  # Helper functions
├── core/                       # Domain logic (pure functions)
│   ├── availability.ts
│   ├── opening-hours.ts
│   └── slots.ts
├── data/                       # Data access layer
│   ├── bookings.ts
│   ├── rooms.ts
│   └── sites.ts
├── types/                      # TypeScript types
│   └── index.ts
├── schemas/                    # Zod validation schemas
│   ├── booking.ts
│   └── room.ts
├── prisma/                     # Database schema
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── tests/                      # Test files
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── docker/                     # Docker configs
    └── docker-compose.yml
```

## Coding Conventions

### TypeScript Guidelines

```typescript
// Use explicit return types for functions
export function calculateSlots(start: Date, end: Date): Slot[] {
  // implementation
}

// Use interfaces for object shapes
interface BookingInput {
  roomId: string
  startLocal: string
  endLocal: string
  attendees?: string[]
}

// Use const assertions for constants
export const SLOT_DURATION_MINUTES = 30 as const

// Prefer type over interface for unions/intersections
type BookingState = "pending" | "confirmed" | "cancelled"
```

### File Naming

- Components: PascalCase (`BookingModal.tsx`)
- Utilities: camelCase (`dateHelpers.ts`)
- Types/Schemas: camelCase (`bookingSchema.ts`)
- API routes: kebab-case folders (`/api/bookings/[id]`)

### Component Structure

```tsx
// 1. Imports
import { useState } from "react"
import { Button } from "@/components/ui/button"

// 2. Types
interface Props {
  roomId: string
  onSuccess: () => void
}

// 3. Component
export function BookingModal({ roomId, onSuccess }: Props) {
  // 4. Hooks
  const [loading, setLoading] = useState(false)

  // 5. Handlers
  const handleSubmit = async () => {
    // implementation
  }

  // 6. Render
  return <div>{/* content */}</div>
}
```

### API Conventions

- RESTful routes where possible
- Server Actions for mutations (preferred)
- Route handlers for GET/fetchable APIs
- Always validate inputs with Zod
- Return proper HTTP status codes

### Database Conventions

- UTC for all datetime storage
- Use transactions for multi-table operations
- Indexes on foreign keys and query fields
- Soft delete via `canceledAt` timestamps
- Activity log for audit trail

### Error Handling

```typescript
// Use custom error classes
export class BookingConflictError extends Error {
  constructor(public slot: string) {
    super(`Room already booked at ${slot}`)
    this.name = "BookingConflictError"
  }
}

// Return structured errors from API
return NextResponse.json({ error: "Room already booked", details: { slot } }, { status: 409 })
```

## Environment Variables

Create `.env.local`:

```env
# Database
DATABASE_URL="mysql://root:password@localhost:3306/nookbook"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Mock Auth (dev only)
MOCK_USER_ID="alice"
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Database Setup

```bash
# Start MySQL via Docker
docker-compose up -d

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed
```

### 3. Development Server

```bash
npm run dev
# Open http://localhost:3000
```

## Available Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  }
}
```

## Development Workflow

### Feature Development

1. Create feature branch from `main`
2. Implement with tests
3. Run linting and type checking
4. Ensure all tests pass
5. Create pull request

### Pre-commit Checklist

- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Prettier formatted
- [ ] Tests pass
- [ ] Database migrations created if needed

### Testing Strategy

- Unit tests for pure functions in `/core`
- Integration tests for API routes
- Component tests for complex UI logic
- E2E tests for critical user flows

## Performance Considerations

### Database

- Use indexes strategically
- Batch operations where possible
- Connection pooling via Prisma

### Frontend

- Server Components by default
- Client Components only when needed
- Optimize images with next/image
- Lazy load heavy components

### Caching

- Use Next.js `revalidateTag` for cache invalidation
- Static generation for marketing pages
- Dynamic rendering for dashboard

## Security Considerations

- Input validation on all endpoints
- SQL injection prevention via Prisma
- XSS protection via React
- CSRF protection in mutations
- Rate limiting on API routes (production)

## Deployment

### Production Requirements

- Node.js 18+
- MySQL 8.0+
- Environment variables set
- Database migrations run

### Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues

**Database connection errors**

- Check MySQL is running
- Verify DATABASE_URL format
- Ensure database exists

**TypeScript errors**

- Run `npm run typecheck`
- Check tsconfig.json paths
- Verify imports

**Prisma issues**

- Run `npx prisma generate`
- Check schema.prisma syntax
- Verify migrations are up to date

## Multi-Agent Development Strategy

### Agent Coordination

When working with multiple agents in parallel, use this division of responsibilities:

**Agent 1 (Backend/Infrastructure)**

- Database setup and migrations
- API endpoints and server actions
- Core business logic in /core
- Data access layer in /data
- Authentication and authorization
- Testing infrastructure

**Agent 2 (Frontend/UI)**

- React components and pages
- UI/UX implementation
- Client-side state management
- Form handling and validation
- Styling with Tailwind/shadcn
- Frontend testing

### Parallel Work Guidelines

1. **Communication via Files**: Agents communicate through well-defined interfaces (types, schemas)
2. **Mock First**: Frontend can use mock data while backend is being built
3. **Contract Agreement**: Define API contracts in /schemas before implementation
4. **Independent Testing**: Each agent writes tests for their domain
5. **Merge Points**: Coordinate at integration boundaries

### File Ownership Map

```
Backend Agent:
- /prisma/*
- /core/*
- /data/*
- /app/api/*
- /lib/auth/*
- /lib/db/*
- /schemas/* (write)

Frontend Agent:
- /app/(marketing)/*
- /app/dashboard/*
- /components/*
- /lib/utils/*
- /schemas/* (read)

Shared:
- /types/*
- PROJECT_SETUP.md
- CLAUDE.md
```

## Development Chunks (Incremental Implementation)

### Chunk A: Foundations ✓

- [x] Next.js setup with TypeScript
- [x] Prisma schema definition
- [x] MySQL Docker configuration
- [x] Mock auth middleware
- [x] Base layout with navigation

### Chunk B: Availability API & UI (Parallel)

**Backend Agent:**

- [ ] Time utility functions in /core
- [ ] Opening hours logic in /core
- [ ] Availability API endpoint
- [ ] Database queries in /data

**Frontend Agent:**

- [ ] Availability page UI
- [ ] Slot grid component
- [ ] Filter controls
- [ ] Room list display

### Chunk C: Booking Creation (Parallel)

**Backend Agent:**

- [ ] Booking creation API
- [ ] Slot enumeration logic
- [ ] Transaction handling
- [ ] Conflict detection

**Frontend Agent:**

- [ ] Booking modal UI
- [ ] Attendee selection
- [ ] Optimistic updates
- [ ] Error handling UI

### Chunk D: Booking Management (Parallel)

**Backend Agent:**

- [ ] Cancellation API
- [ ] Activity logging
- [ ] Permission checks
- [ ] Booking queries

**Frontend Agent:**

- [ ] My Bookings page
- [ ] Booking cards
- [ ] Activity feed UI
- [ ] Cancel confirmation

### Chunk E: Admin Features (Parallel)

**Backend Agent:**

- [ ] CRUD APIs for sites/rooms
- [ ] Admin authorization
- [ ] Bulk operations

**Frontend Agent:**

- [ ] Site management UI
- [ ] Room management UI
- [ ] Global activity view
- [ ] Opening hours editor

## Contact & Support

For questions or issues:

- Check CLAUDE.md for product specifications
- Review this guide for technical setup
- Run tests to verify implementation
