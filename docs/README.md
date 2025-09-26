# NookBook Documentation Index

## Quick Start Guides

- **[Main README](../README.md)** - Complete developer guide with quickstart, testing, and code style
- **[For LLM Agents](../LLM.md)** - Cold-start guide for AI agents working on the codebase
- **[Product Specification](../CLAUDE.md)** - Original requirements and technical specifications

## Technical Documentation

### Architecture & Design
- **[Architecture Overview](ARCHITECTURE.md)** - System design, tech stack, and architectural decisions
- **[API Contracts](API_CONTRACTS.md)** - Detailed API endpoint specifications and examples
- **[Database Schema](../prisma/schema.prisma)** - Source of truth for data models

### Development Guides
- **[Development Workflow](DEVELOPMENT_WORKFLOW.md)** - Git flow, PR process, and team collaboration
- **[Setup & Environment](SETUP_AND_ENVIRONMENT.md)** - Detailed environment setup instructions
- **[Docker Setup](DOCKER_SETUP.md)** - Container configuration and Docker installation guide
- **[Testing Strategy](TESTING_STRATEGY.md)** - Testing approach, patterns, and best practices

### Feature Documentation
- **[Coworking Space Model](COWORKING_SPACE_MODEL.md)** - Business logic and domain model
- **[Room Hours Edge Cases](ROOM_HOURS_EDGE_CASES.md)** - Handling complex timezone and scheduling scenarios
- **[Concurrency Testing](CONCURRENCY_TESTING.md)** - Ensuring thread-safe booking operations

## Repository Structure

```
/
├── app/              # Next.js App Router pages & API routes
├── components/       # Reusable React components
├── lib/             # Utilities and client instances
├── core/            # Business logic (pure functions)
├── data/            # Database access layer
├── types/           # TypeScript type definitions
├── schemas/         # Zod validation schemas
├── prisma/          # Database schema and migrations
├── test/            # Test suites
└── docs/            # This documentation
```

## Key Concepts

### Database Design
- **BookingSlot Table** - Unique constraint prevents double-booking
- **UTC Storage** - All timestamps stored in UTC
- **Soft Deletes** - Bookings marked with `canceledAt`
- **Activity Logging** - Complete audit trail

### Business Rules
- **30-minute slots** - All bookings align to half-hour boundaries
- **No DST Support** - MVP assumes fixed UTC offsets
- **Timezone Inheritance** - Rooms inherit timezone from their site
- **Concurrency Safety** - Database constraints prevent race conditions

### User Roles
- **USER** - Can book rooms, view/cancel own bookings
- **ADMIN** - All user abilities plus site/room management

## Development Commands

```bash
# Daily development
npm run dev              # Start development server
npm run db:studio        # Visual database explorer

# Testing
npm test                 # Run all tests
npm run lint            # Check code style
npm run typecheck       # Verify TypeScript

# Database
npm run db:migrate      # Run migrations
npm run db:seed         # Seed test data
npm run db:reset        # Clean reset

# Production
npm run build           # Production build
npm start              # Start production server
```

## Testing Users

After seeding the database:
- `alice-admin` - Administrator (Pacific timezone)
- `bob-user` - Regular user (Eastern timezone)
- `connor-user` - Regular user (London timezone)

## Common Tasks

### Adding a New Feature
1. Define types in `types/`
2. Create Zod schema in `schemas/`
3. Write tests first (TDD)
4. Implement business logic in `core/`
5. Add database queries in `data/`
6. Build API endpoint in `app/api/`
7. Create UI components
8. Update documentation

### Debugging Issues
1. Check browser console for client errors
2. Review server logs in terminal
3. Inspect database with `npm run db:studio`
4. Verify timezone calculations
5. Check for race conditions in bookings

## Contributing

1. Read the relevant documentation
2. Follow code style guidelines
3. Write tests for new features
4. Ensure all tests pass
5. Update documentation as needed
6. Submit PR with clear description

## Support

- Check this documentation index first
- Review test files for usage examples
- Examine existing code for patterns
- Open GitHub issue for bugs/features