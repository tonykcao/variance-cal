# NookBook - Quick Start Guide

## What is NookBook?

NookBook is a room booking system for managing shared spaces across multiple office locations. It supports multiple sites (San Francisco, New York, London, Shanghai) with timezone-aware scheduling.

## Prerequisites

- Node.js 18+ and npm
- Docker (for MySQL database)
- Git

## Quick Setup (Automated)

Run the quickstart script that handles everything automatically:

```bash
# For all platforms
node scripts/quickstart.js

# Or on Windows
scripts\quickstart.bat

# Or on Mac/Linux
./scripts/quickstart.sh
```

This script will:

1. Check Docker is running
2. Create .env file
3. Install dependencies
4. Start MySQL container
5. Run database migrations
6. Seed sample data
7. Set up authentication

Then just run:

```bash
npm run dev
```

## Manual Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd variance-cal
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
cp .env.example .env
```

The default `.env` file should contain:

```
DATABASE_URL="mysql://root:password@localhost:3306/nookbook"
```

### 4. Start the Database

```bash
docker compose up -d
```

This starts MySQL 8.0 in a Docker container on port 3306.

### 5. Initialize the Database

```bash
# Run database migrations
npx prisma migrate dev

# Seed with sample data
npm run db:seed
```

### 6. Fix Authentication IDs

After seeding, synchronize the mock authentication system:

```bash
npx tsx scripts/fix-auth.ts
```

### 7. Start the Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Using the Application

### Users

The system comes with pre-seeded users:

1. **alice-admin** (ADMIN)
   - Can manage sites and rooms
   - Can view all bookings and activity
   - Email: alice@example.com

2. **bob-user** (USER)
   - Regular user
   - Email: bob@example.com

3. **connor-user** (USER)
   - Regular user
   - Email: connor@example.com

### Switching Users

Use the dropdown in the top navigation bar to switch between users (mock authentication for development).

### Main Features

#### 1. **Dashboard → Availability**

- Search for available rooms by:
  - Site (SF, NY, London, Shanghai)
  - Date/date range
  - Minimum capacity
  - Time window
- View availability grid with color coding:
  - Green: Available
  - Dark Blue: Your booking
  - Light Blue: You're attending
  - Red: Others' booking
  - Gray: Closed/Past
- Drag to select multiple time slots
- Click to create a booking

#### 2. **Dashboard → My Bookings**

- View your upcoming and past bookings
- See bookings you own and ones you're attending
- Cancel bookings you own
- View booking details and notes

#### 3. **Admin Features** (alice-admin only)

- **Dashboard → Admin → Sites**: Manage office locations
- **Dashboard → Admin → Rooms**: Manage rooms per site
- **Dashboard → Admin → Activity**: View global activity log

## Creating a Booking

1. Go to **Dashboard → Availability**
2. Select filters (site, date, capacity)
3. Click **Search**
4. Drag across available slots to select time range
5. In the modal:
   - Add attendees by email (up to 3)
   - Add optional notes
   - Click **Confirm Booking**

## Key Features

- **Timezone Support**: All times shown in both room's local time and your timezone
- **Attendee Management**: Add colleagues to bookings; non-existing users are auto-created
- **Notes**: Add private notes to bookings (visible to owner, attendees, and admins)
- **Concurrency Safe**: Prevents double-booking through database constraints
- **Activity Tracking**: All actions are logged for audit

## Troubleshooting

### Port Already in Use

If port 3000 is busy, the server will automatically use 3001, 3002, etc.

### Authentication Issues

If you see "Unauthorized" errors:

```bash
# Re-sync authentication IDs
npx tsx scripts/fix-auth.ts
# Clear browser cookies for localhost
```

### Database Issues

```bash
# Reset database completely
npx prisma migrate reset
# This will drop all data and re-run migrations + seed
```

## Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio (database GUI)
npm test            # Run tests
```

## Data Generation Scripts

For testing different booking scenarios, use these data generation scripts:

```bash
# Clean up existing bookings (keeps users, sites, rooms)
npm run db:cleanup-bookings

# Generate light/realistic dataset (~30-40% utilization)
npm run db:generate-light

# Generate chaotic/busy dataset (~70-85% utilization)
npm run db:generate-chaotic

# Full reset and reseed
npm run db:reset
```

### Dataset Characteristics

**Light Dataset** (`db:generate-light`):

- Moderate booking density typical of a real office
- Recurring weekly meetings (standups, sprint ceremonies)
- Scattered 1:1s and project meetings
- Business hours only (8am-6pm), no weekends
- ~30-40% room utilization

**Chaotic Dataset** (`db:generate-chaotic`):

- Very high booking density simulating a busy office
- Includes weekend meetings and off-hours sessions (5am-10pm)
- Emergency meetings, crisis sessions, deadline crunches
- Back-to-back bookings with high conflict rate
- Some meetings start off the 30-minute grid
- ~70-85% peak hour utilization

Use the chaotic dataset to test:

- UI performance with many bookings
- Conflict detection and handling
- Calendar navigation with dense schedules
- Availability search in busy periods

## Architecture

- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Database**: MySQL 8 with Prisma ORM
- **Authentication**: Mock auth for development (replace with real auth in production)
- **UI Components**: Radix UI primitives with shadcn/ui

## Sample Data

The seed includes:

- 4 sites with different timezones
- 5 rooms per site (20 total)
- Various pre-existing bookings to demonstrate the system
- All rooms open 8:00 AM - 8:00 PM local time

## Support

For issues or questions, check the CLAUDE.md file for detailed technical specifications.
