# NookBook

A room booking system for managing shared spaces across multiple sites with timezone support.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (see [Docker Setup Guide](docs/DOCKER_SETUP.md) if not installed)
- npm or pnpm

### Automatic Setup

```bash
# One command setup
npm run quickstart

# Then start development
npm run dev
```

This will check Docker, install dependencies, setup database, run migrations, and seed test data.

### Manual Setup

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start database
docker compose up -d

# 4. Setup database
npm run db:migrate
npm run db:seed

# 5. Start development
npm run dev
```

Visit http://localhost:3000

## Project Overview

NookBook is a meeting room booking system with:

- **Multi-site support** (SF, NY, London, Shanghai)
- **Timezone-aware scheduling**
- **30-minute booking slots**
- **Concurrency-safe booking** via database constraints
- **Role-based access** (User/Admin)
- **Activity logging**

### Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Database**: MySQL 8 with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Time**: date-fns with timezone support
- **Validation**: Zod schemas
- **Auth**: Mock auth for development

### Design Philosophy

- **Minimalist greyscale UI** with monospace fonts
- **UTC storage** for all timestamps
- **Server-side rendering** by default
- **No emojis** in code or output

## Development

### Essential Commands

```bash
# Development
npm run dev              # Start dev server (port 3000)
npm run build           # Production build
npm run lint            # Run ESLint
npm run format          # Format with Prettier
npm run typecheck       # TypeScript check

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:studio       # Visual database browser
npm run db:reset        # Reset and reseed

# Testing
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
```

### Test Users

After seeding:

- **alice-admin** - Admin role (Pacific timezone)
- **bob-user** - Regular user (Eastern timezone)
- **connor-user** - Regular user (London timezone)

### Project Structure

```
app/              # Next.js pages & API routes
├── dashboard/    # Main application
├── api/         # REST endpoints
components/       # React components
lib/             # Utilities & clients
core/            # Business logic (pure)
data/            # Database access layer
types/           # TypeScript types
schemas/         # Zod validation
prisma/          # Database schema
test/            # Test suites
docs/            # Documentation
```

## Code Style Guide

### TypeScript Conventions

```typescript
// Explicit return types
export function calculateSlots(start: Date, end: Date): Slot[] {
  // implementation
}

// Interfaces for objects
interface BookingInput {
  roomId: string
  startLocal: string
  endLocal: string
  attendees?: string[]
}

// const assertions
export const SLOT_DURATION_MINUTES = 30 as const

// Type for unions
type BookingState = "pending" | "confirmed" | "cancelled"
```

### Naming Patterns

- **Files**: kebab-case (`room-availability-grid.tsx`)
- **Components**: PascalCase (`RoomAvailabilityGrid`)
- **Functions**: camelCase (`getUserBookings`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEZONE`)

### Best Practices

1. **No console.log** - Use proper logging
2. **No emojis** - Professional text only
3. **UTC storage** - Convert at boundaries
4. **Transactions** - For multi-step operations
5. **Validation** - Zod at API boundaries
6. **Pure functions** - In `/core` directory
7. **Test first** - TDD for business logic

## Architecture Decisions

### Why BookingSlot Table?

MySQL lacks exclusion constraints. The unique index on `(roomId, slotStartUtc)` prevents double-booking under concurrent requests.

### Why Server Actions?

Better DX with Next.js 14, automatic request deduplication, and built-in optimistic updates.

### Why UTC Storage?

Simplifies timezone logic, prevents DST issues, enables consistent queries across global sites.

### No DST Support

MVP assumes fixed UTC offsets. DST transitions are not handled.

## Common Tasks

### Adding a New Feature

1. Define types in `types/`
2. Add Zod schema in `schemas/`
3. Write tests first (TDD)
4. Implement logic in `core/`
5. Create DB queries in `data/`
6. Build API route in `app/api/`
7. Create UI components
8. Update documentation

### Database Changes

```bash
# 1. Edit schema
vim prisma/schema.prisma

# 2. Create migration
npm run db:migrate

# 3. Update seed if needed
vim prisma/seed.ts

# 4. Test
npm test
```

### Debugging

```bash
# View database
npm run db:studio

# Check logs
npm run dev  # Verbose server output

# Test API
curl http://localhost:3000/api/availability

# Find port conflicts
lsof -i :3000       # Mac/Linux
netstat -ano | findstr :3000  # Windows
```

## API Overview

### Core Endpoints

```bash
# Check availability
GET /api/availability?sites[]=SF&capacityMin=4&from=2025-09-27

# Create booking
POST /api/bookings
{ roomId, startLocal, endLocal, attendees[] }

# Cancel booking
DELETE /api/bookings/[id]

# User bookings
GET /api/bookings?scope=upcoming|past

# Admin endpoints
GET/POST /api/sites
GET/POST /api/rooms
```

### Response Format

```typescript
// Success
{ data: T }

// Error
{ error: string, details?: any }
```

## Testing Strategy

### Unit Tests

- Business logic in `/core`
- Pure functions
- Timezone utilities
- Slot calculations

### Integration Tests

- API endpoints
- Database operations
- Concurrency scenarios
- Permission checks

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage

# Specific file
npm test availability
```

## Environment Variables

```env
# Required
DATABASE_URL="mysql://root:password@localhost:3306/nookbook"

# Optional
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Troubleshooting

### Port 3000 in Use

```bash
# Kill existing process
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

### Database Issues

```bash
# Reset completely
npm run db:reset

# Check Docker
docker ps
docker logs nookbook-mysql

# Manual reset
docker compose down -v
docker compose up -d
npm run db:migrate
npm run db:seed
```

### Build Errors

```bash
# Clear caches
rm -rf .next node_modules
npm install
npm run build
```

### TypeScript Errors

```bash
# Regenerate Prisma types
npx prisma generate

# Check imports
npm run typecheck
```

## Documentation

- **[For LLM Agents](LLM.md)** - AI agent cold-start guide
- **[Product Spec](CLAUDE.md)** - Original requirements
- **[Architecture](docs/ARCHITECTURE.md)** - System design
- **[API Contracts](docs/API_CONTRACTS.md)** - Endpoint details
- **[Testing Guide](docs/TESTING_STRATEGY.md)** - Test approach
- **[Docker Setup](docs/DOCKER_SETUP.md)** - Container setup

## Performance Considerations

### Database

- Strategic indexes on query fields
- Connection pooling via Prisma
- Batch operations where possible

### Frontend

- Server Components by default
- Client Components only when needed
- Image optimization with next/image
- Lazy loading for heavy components

### Caching

- `revalidateTag` for cache invalidation
- Static generation for marketing pages
- Dynamic rendering for dashboard

## Security

- Input validation on all endpoints
- SQL injection prevention via Prisma
- XSS protection via React
- CSRF protection in mutations
- Rate limiting (production only)

## Deployment

### Build for Production

```bash
# Build
npm run build

# Start
npm start
```

### Requirements

- Node.js 18+
- MySQL 8.0+
- Environment variables configured
- Database migrations run

## Contributing

1. Create feature branch from `main`
2. Follow code style (`npm run lint`)
3. Write tests for new features
4. Ensure tests pass (`npm test`)
5. Submit PR with clear description

## License

Private
