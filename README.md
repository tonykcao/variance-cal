# NookBook

A room booking system for managing shared spaces across multiple sites with timezone support.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop (see [Docker Setup Guide](docs/DOCKER_SETUP.md) if not installed)
- npm or pnpm

### Automatic Setup

Run the quickstart script to set up everything automatically:

```bash
# Cross-platform (recommended)
npm run quickstart

# Or platform-specific:
npm run quickstart:unix  # Mac/Linux
npm run quickstart:win   # Windows
```

This will:

1. Check Docker is running
2. Create .env file from template
3. Install dependencies
4. Start MySQL database container
5. Generate Prisma client
6. Run database migrations
7. Seed the database with test data

### Manual Setup

If you prefer to set up manually:

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start database
docker compose up -d

# 4. Generate Prisma client
npm run db:generate

# 5. Run migrations
npm run db:migrate

# 6. Seed database
npm run db:seed

# 7. Start development server
npm run dev
```

### Alternative: Development Without Docker

If you cannot install Docker, you have these options:

1. **Use a Cloud Database** (Recommended)
   - Sign up for a free MySQL database at [PlanetScale](https://planetscale.com) or [Railway](https://railway.app)
   - Update the `DATABASE_URL` in `.env` with your cloud connection string
   - Run: `npm run db:migrate` and `npm run db:seed`

2. **Install MySQL Locally**
   - Download [MySQL Community Server](https://dev.mysql.com/downloads/)
   - Create database: `CREATE DATABASE nookbook;`
   - Update `DATABASE_URL` in `.env` to: `mysql://root:yourpassword@localhost:3306/nookbook`
   - Run: `npm run db:migrate` and `npm run db:seed`

3. **Use SQLite for Development** (Limited)
   - Change `provider` in `prisma/schema.prisma` from `mysql` to `sqlite`
   - Update `DATABASE_URL` in `.env` to: `file:./dev.db`
   - Note: Some features may not work exactly as with MySQL

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:studio` - Open Prisma Studio (database viewer)
- `npm run db:reset` - Reset database and re-seed

### Test Users

After seeding, these users are available:

- **alice-user** - Regular user (Pacific timezone)
- **bob-user** - Regular user (Eastern timezone)
- **connor-admin** - Admin user (London timezone)

### Project Structure

```
/
├── app/              # Next.js app router pages
├── components/       # React components
├── lib/             # Utilities and database client
├── core/            # Business logic (time, slots, etc.)
├── data/            # Database access layer
├── types/           # TypeScript type definitions
├── schemas/         # Zod validation schemas
└── prisma/          # Database schema and migrations
```

## Architecture

- **Framework**: Next.js 14+ with App Router
- **Database**: MySQL 8 with Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Authentication**: Mock auth with user switcher (dev)
- **Time Management**: date-fns with timezone support

## Features

- Multi-site support (SF, NY, London, Shanghai)
- Timezone-aware scheduling
- 30-minute booking slots
- Concurrency-safe booking system
- Role-based access (User/Admin)
- Activity logging
- Room capacity management

## Database Schema

Key models:

- **User** - System users with timezone preferences
- **Site** - Physical locations with timezones
- **Room** - Bookable spaces with capacity and hours
- **Booking** - Reservations with UTC times
- **BookingSlot** - Individual 30-min slots (prevents double-booking)

See `prisma/schema.prisma` for full schema.

## API Endpoints

- `GET /api/availability` - Check room availability
- `POST /api/bookings` - Create booking
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/sites` - List sites
- `GET /api/rooms` - List rooms

## Important Notes

### Database vs Mock Data

**IMPORTANT**: This project uses a real MySQL database with Prisma ORM. The mock users in `lib/auth/mock-users.ts` are temporary and should be replaced with database queries once migrations are run. See the TODO comments in that file for guidance.

## Contributing

1. Create feature branch
2. Make changes
3. Run tests
4. Submit PR

## License

Private
