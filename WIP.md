# Work In Progress (WIP) - Agent Coordination File

**Last Updated**: 2025-09-24
**Lead Agent**: Agent 1 (has tie-breaking authority)

## Agent Roles & Authority

### Agent 1 (Lead - Backend/Infrastructure Focus)

- **Authority**: Tie-breaking power on technical decisions
- **Primary Domain**: Backend, APIs, Database, Core Logic, Backend Tests
- **Secondary**: Can assist with any task when other agents need help

### Agent 2 (Frontend/UI Focus)

- **Primary Domain**: UI Components, Pages, User Experience, Frontend Tests
- **Secondary**: Can assist with API integration and testing

### Agent 3 (Documentation & Testing Focus)

- **Primary Domain**: Documentation, Test Coverage, Integration Tests
- **Secondary**: Code review, test helpers, fixtures

## Communication Protocol

1. **Task Assignment**: Mark tasks with agent ownership below
2. **Blockers**: Use BLOCKED tag with description
3. **Handoffs**: Use READY_FOR tag when passing work
4. **Decisions**: Agent 1 has final say on conflicts

## Current Sprint Status

### IMMEDIATE NEXT STEPS - SETUP PHASE (CHUNK A)

#### AGENT 1 Tasks (Infrastructure & Backend)

1. **[COMPLETE]** Initialize Next.js project with TypeScript and App Router
   - Status: DONE

2. **[COMPLETE]** Set up Docker Compose with MySQL 8 container
   - Created docker-compose.yml
   - Configured MySQL environment variables
   - Note: Docker Desktop must be running
   - Status: DONE

3. **[COMPLETE]** Create and configure Prisma schema
   - All models from CLAUDE.md spec implemented
   - Proper indexes and relations configured
   - Status: DONE

4. **[COMPLETE]** Install all dependencies
   - Prisma, date-fns, date-fns-tz, zod, ts-pattern
   - ts-node for seed script
   - Status: DONE

5. **[COMPLETE]** Set up project structure
   - Created core/, data/, types/, schemas/ directories
   - Created app route structure
   - Created lib/db.ts for Prisma client
   - Status: DONE

6. **[COMPLETE]** Create seed script
   - 3 users (alice-user, bob-user, connor-admin)
   - 4 sites with timezones
   - 20 rooms (5 per site)
   - Sample bookings
   - Updated user names to be explicit (alice-user, bob-user, connor-admin)
   - Status: DONE

7. **[PENDING]** Write timezone utility tests
   - snapTo30 function tests
   - timezone conversion tests
   - opening hours validation tests
   - Status: NEXT PRIORITY

#### AGENT 2 Tasks (Frontend & Auth)

1. **[COMPLETE]** Configure Tailwind CSS and shadcn-ui components
   - Tailwind CSS configured with theme variables
   - shadcn/ui components installed
   - UI utilities set up
   - Status: COMPLETE

2. **[COMPLETE]** Set up lucide-react icons
   - ClipboardClock logo implemented in layout
   - Icons configured for UI components
   - Status: COMPLETE

3. **[COMPLETE]** Create base layout with navigation
   - Dashboard layout with header and navigation
   - Logo and main nav links
   - Status: COMPLETE

4. **[COMPLETE]** Implement mock auth middleware
   - x-user-id header/cookie handling
   - Mock users configuration
   - Middleware for auth context
   - Status: COMPLETE

5. **[COMPLETE]** Build top-nav user switcher
   - User switcher component
   - Cookie-based user switching
   - Admin role indication
   - Status: COMPLETE

6. **[COMPLETE]** Set up route structure
   - /dashboard/availability
   - /dashboard/my-bookings
   - /dashboard/admin/\*
   - All pages created with placeholder content
   - Status: COMPLETE

#### AGENT 3 Tasks (Documentation & Testing)

1. **[COMPLETE]** Create comprehensive documentation
   - ✅ Setup and environment documentation (docs/SETUP_AND_ENVIRONMENT.md)
   - ✅ Architecture overview (docs/ARCHITECTURE.md)
   - ✅ Development workflow guide (docs/DEVELOPMENT_WORKFLOW.md)
   - Status: ✅ COMPLETE

2. **[READY]** Set up testing infrastructure
   - Configure Vitest
   - Set up test database
   - Create test helpers
   - Status: 🤝 READY - Next.js now initialized

3. **[WAITING]** Document API contracts
   - OpenAPI/Swagger spec
   - Request/response examples
   - Error code documentation
   - Status: BLOCKED - Needs API implementation

4. **[IN PROGRESS]** Create development guides
   - Environment setup guide complete
   - Code style guide - PENDING
   - Git workflow documentation - PENDING
   - Component development guide - PENDING
   - Status: ACTIVE

5. **[WAITING]** Set up CI/CD documentation
   - GitHub Actions setup
   - Deployment procedures
   - Environment configuration
   - Status: BLOCKED - Needs infrastructure

6. **[WAITING]** Write integration test suite
   - End-to-end booking flow tests
   - Concurrency tests for double-booking
   - Permission tests
   - Status: BLOCKED - Needs APIs

## Task Queue

### Ready for Development

- [ ] Time utility functions (/core/time.ts)
- [ ] Opening hours validator (/core/opening-hours.ts)
- [ ] Slot enumeration logic (/core/slots.ts)
- [x] Prisma client singleton (/lib/db.ts) - COMPLETED by Agent 1
- [ ] Replace mock auth with database queries (lib/auth/mock-users.ts) - TODO after quickstart
- [ ] Run quickstart script to initialize database - IMPORTANT: Use `npm run quickstart`

### Blocked/Waiting

- [ ] Availability API - BLOCKED: Needs core utilities
- [ ] Booking creation API - BLOCKED: Needs database setup
- [ ] UI Components - BLOCKED: Needs base project setup

## Room ID System Proposal (Agent 2 → Agent 1)

### Proposed Room Identification

- **Room IDs**: Use format `{SITE_CODE}-{NUMBER}` (e.g., SFO-001, NYC-002)
- **Site Codes**:
  - San Francisco → SFO
  - New York → NYC
  - London → LON
  - Shanghai → SHA
- **Benefits**:
  - Easy to identify site from room ID
  - Sortable and searchable
  - User-friendly display as "Oak (SFO-001)"
- **Implementation**: Created `lib/room-utils.ts` with helper functions

## Integration Points

### API Contracts to Define

1. **GET /api/availability**
   - Request: sites[], capacityMin, dates, timeWindow
   - Response: Room[] with slot availability

2. **POST /api/bookings**
   - Request: roomId, startLocal, endLocal, attendees[]
   - Response: Booking with ID

3. **DELETE /api/bookings/[id]**
   - Response: Success/Error

### Shared Types Needed

```typescript
// /types/index.ts
interface TimeSlot {
  startUtc: Date
  endUtc: Date
  available: boolean
}

interface RoomAvailability {
  room: Room
  slots: TimeSlot[]
}
```

## Decision Log

| Date       | Decision                         | Made By | Rationale                 |
| ---------- | -------------------------------- | ------- | ------------------------- |
| 2025-09-24 | Use server actions for mutations | Agent 1 | Better DX with Next.js 14 |
| 2025-09-24 | Tailwind for styling             | Both    | Rapid development         |

## Notes & Handoffs

### Agent 1 Notes:

- Completed all infrastructure setup tasks
- Next.js project initialized with TypeScript and App Router
- Docker Compose configured for MySQL 8
- Prisma schema created with all models from spec
- Seed script with alice-user, bob-user, connor-admin (no emojis in console output)
- Project folder structure created
- Created quickstart scripts (cross-platform) - Run `npm run quickstart`
- Updated .gitignore to exclude CLAUDE.md
- Added TODO comments about replacing mock data with database
- Created comprehensive README with setup instructions
- Created Docker installation guide (docs/DOCKER_SETUP.md)
- Added alternative database options (cloud/local MySQL/SQLite) for non-Docker development
- [READY] Ready for database migration once Docker is installed and running
- Next: Will work on timezone utilities and core functions

### Agent 2 Notes:

- Completed all UI foundation tasks
- Set up Tailwind CSS, shadcn/ui, and lucide-react
- Created dashboard layout with navigation
- Implemented mock auth with user switcher
- Built all initial page structures (availability, my-bookings, admin)
- **NEW**: Set up ESLint and Prettier for code formatting
  - Added `.eslintrc.json` and `.prettierrc.json` configurations
  - Added lint/format scripts: `npm run lint`, `npm run format`
  - Formatted all existing code files
- Ready for Chunk B: Building availability UI components once backend APIs are ready

### Agent 3 Notes:

- ✅ COMPLETED: Created comprehensive setup and environment documentation in docs/SETUP_AND_ENVIRONMENT.md
- ✅ COMPLETED: Created architecture documentation in docs/ARCHITECTURE.md
- ✅ COMPLETED: Created development workflow guide in docs/DEVELOPMENT_WORKFLOW.md
- 🚀 IN PROGRESS: Testing strategy documentation (not yet created)
- Next tasks when resuming:
  - Complete TESTING_STRATEGY.md document
  - Set up Vitest testing infrastructure (now unblocked - Next.js is initialized)
  - Create test helpers and fixtures
  - Document API contracts once Agent 1 completes API implementation

## Validation Checklist

Before marking a task complete:

- [ ] Code follows conventions in PROJECT_SETUP.md
- [ ] TypeScript compiles without errors
- [ ] Required tests are written
- [ ] Integration points documented
- [ ] Next agent can continue work

## Commands Reference

```bash
# Project setup
npx create-next-app@latest variance-cal --typescript --app --tailwind

# Database
docker-compose up -d
npx prisma init
npx prisma migrate dev
npx prisma db seed

# Development
npm run dev
npm run lint
npm run typecheck
npm test
```

## Status Indicators

- **IN_PROGRESS**: Active work
- **COMPLETE**: Done and tested
- **BLOCKED**: Waiting on dependency
- **READY_FOR_HANDOFF**: Ready for next agent
- **NEEDS_DECISION**: Requires Agent 1 decision
- **BUG_FOUND**: Issue discovered

---

**Remember**:

- Update this file when starting/completing tasks
- Agent 1 has final decision authority
- Communicate blockers immediately
- Follow the established patterns in PROJECT_SETUP.md
