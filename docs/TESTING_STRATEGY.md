# Testing Strategy

This document outlines the comprehensive testing strategy for the NookBook room booking system.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Test Structure](#test-structure)
- [Testing Tools](#testing-tools)
- [Test Categories](#test-categories)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)

## Testing Philosophy

Our testing approach follows these principles:

1. **Test-First Development**: Write tests before implementation when possible
2. **Clear Test Names**: Tests should describe what they test and expected behavior
3. **Isolated Tests**: Each test should be independent and not rely on others
4. **Fast Feedback**: Unit tests should run quickly for rapid development
5. **Comprehensive Coverage**: Aim for >80% code coverage with meaningful tests
6. **No Emojis**: Keep all test output professional and text-based

## Test Structure

```
test/
├── unit/              # Unit tests for individual functions
│   ├── time.test.ts   # Time utility tests
│   ├── slots.test.ts  # Slot enumeration tests
│   └── opening-hours.test.ts
├── integration/       # Integration tests
│   ├── booking-flow.test.ts
│   └── availability.test.ts
├── e2e/              # End-to-end tests
│   └── user-journey.test.ts
├── fixtures/         # Test data fixtures
│   ├── users.ts
│   ├── sites.ts
│   └── bookings.ts
├── helpers/          # Test utilities
│   ├── db.ts        # Database helpers
│   └── factories.ts # Data factories
└── setup.ts         # Global test setup
```

## Testing Tools

### Core Tools

- **Vitest**: Fast unit test runner with excellent TypeScript support
- **Happy DOM**: Lightweight DOM implementation for testing
- **Testing Library**: React component testing utilities
- **Faker.js**: Generate realistic test data

### Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
})
```

## Test Categories

### 1. Unit Tests

**Purpose**: Test individual functions and utilities in isolation

**Location**: `test/unit/`

**Examples**:

- Time utilities (snapTo30, timezone conversions)
- Opening hours validation
- Slot enumeration logic
- Permission checks

**Best Practices**:

```typescript
describe("snapTo30", () => {
  it("should snap to 30-minute boundaries with floor", () => {
    const input = new Date("2025-09-24T10:15:00Z")
    const expected = new Date("2025-09-24T10:00:00Z")
    expect(snapTo30(input, "floor")).toEqual(expected)
  })
})
```

### 2. Integration Tests

**Purpose**: Test how different modules work together

**Location**: `test/integration/`

**Examples**:

- Database transactions
- API route handlers
- Booking creation flow
- Availability calculation

**Database Strategy**:

```typescript
beforeEach(async () => {
  await resetTestDatabase()
  await seedTestData("minimal")
})

afterEach(async () => {
  await cleanupDatabase()
})
```

### 3. Component Tests

**Purpose**: Test React components in isolation

**Location**: Alongside components or in `test/components/`

**Examples**:

```typescript
import { render, screen } from '@testing-library/react'
import { RoomCard } from '@/components/RoomCard'

test('displays room information', () => {
  render(<RoomCard room={mockRoom} />)
  expect(screen.getByText('Conference Room')).toBeInTheDocument()
  expect(screen.getByText('Capacity: 8')).toBeInTheDocument()
})
```

### 4. End-to-End Tests

**Purpose**: Test complete user workflows

**Location**: `test/e2e/`

**Examples**:

- Complete booking journey
- Admin site management
- Multi-user concurrent bookings

### 5. Concurrency Tests

**Purpose**: Ensure system handles concurrent operations correctly

**Critical for**:

- Double-booking prevention
- Slot locking mechanism
- Transaction isolation

**Example**:

```typescript
test("prevents double-booking under concurrency", async () => {
  const room = await createTestRoom()
  const slot = "2025-09-24T10:00:00Z"

  // Attempt parallel bookings
  const results = await Promise.allSettled([
    createBooking(room.id, slot),
    createBooking(room.id, slot),
    createBooking(room.id, slot),
  ])

  // Only one should succeed
  const successes = results.filter(r => r.status === "fulfilled")
  expect(successes).toHaveLength(1)
})
```

## Running Tests

### Available Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- test/unit/time.test.ts

# Run tests matching pattern
npm test -- --grep "timezone"
```

### Test Database Setup

For integration tests requiring a database:

1. **Option 1**: Use test database

   ```bash
   TEST_DATABASE_URL=mysql://root:password@localhost:3307/nookbook_test
   ```

2. **Option 2**: Use in-memory database
   ```typescript
   // For unit tests that need Prisma
   import { mockDeep } from "vitest-mock-deep"
   const prismaMock = mockDeep<PrismaClient>()
   ```

## Writing Tests

### Test Structure Template

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"

describe("Feature Name", () => {
  // Setup
  beforeEach(async () => {
    // Test preparation
  })

  afterEach(async () => {
    // Cleanup
  })

  describe("Specific Function", () => {
    it("should handle normal case", () => {
      // Arrange
      const input = createTestData()

      // Act
      const result = functionUnderTest(input)

      // Assert
      expect(result).toMatchExpectedOutput()
    })

    it("should handle edge case", () => {
      // Test edge cases
    })

    it("should handle error case", () => {
      // Test error handling
    })
  })
})
```

### Data Factories

Use factories for consistent test data:

```typescript
import { createMockUser, createMockRoom } from "@/test/helpers/factories"

const testUser = createMockUser({
  role: "ADMIN",
  timezone: "America/New_York",
})

const testRoom = createMockRoom(siteId, {
  capacity: 10,
  name: "Large Conference Room",
})
```

### Mocking Best Practices

```typescript
// Mock external dependencies
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}))

// Mock date/time for consistent tests
vi.useFakeTimers()
vi.setSystemTime(new Date("2025-09-24T12:00:00Z"))
```

## Test Coverage Goals

### Target Coverage

- **Overall**: >80%
- **Core Business Logic**: >90%
- **Utilities**: >95%
- **API Routes**: >85%
- **Components**: >70%

### Critical Areas Requiring Tests

1. **Booking Creation**
   - Slot validation
   - Concurrency handling
   - Transaction rollback

2. **Availability Calculation**
   - Timezone handling
   - Opening hours
   - Capacity filtering

3. **Permission System**
   - Role-based access
   - Owner vs attendee rights
   - Admin overrides

4. **Time Utilities**
   - Timezone conversions
   - DST transitions
   - Slot boundaries

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: nookbook_test
        ports:
          - 3307:3306

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - run: npm ci
      - run: npm run db:migrate
        env:
          DATABASE_URL: mysql://root:test@localhost:3307/nookbook_test

      - run: npm run test:coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hooks

```json
// .husky/pre-commit
npm run test -- --run --changed
```

## Debugging Tests

### Debugging Commands

```bash
# Run tests in debug mode
node --inspect-brk ./node_modules/.bin/vitest

# Run single test with verbose output
npm test -- test/unit/time.test.ts --reporter=verbose

# Show test execution time
npm test -- --reporter=verbose --logHeapUsage
```

### VSCode Debug Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal"
}
```

## Performance Testing

### Load Testing Bookings

```typescript
test("handles 100 concurrent booking attempts", async () => {
  const room = await createTestRoom()
  const users = await createTestUsers(100)

  const startTime = performance.now()

  const results = await Promise.allSettled(
    users.map(user =>
      createBooking({
        roomId: room.id,
        userId: user.id,
        startTime: randomSlot(),
      })
    )
  )

  const duration = performance.now() - startTime

  expect(duration).toBeLessThan(5000) // Should complete within 5s
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength.greaterThan(0)
})
```

## Test Maintenance

### Regular Tasks

1. **Weekly**: Review failing tests
2. **Sprint**: Update test coverage reports
3. **Monthly**: Remove obsolete tests
4. **Quarterly**: Performance test review

### Test Quality Checklist

- [ ] Test name clearly describes behavior
- [ ] Test is independent of other tests
- [ ] Test uses appropriate assertions
- [ ] Test covers both success and failure cases
- [ ] Test data is realistic
- [ ] No hardcoded dates/times (use relative dates)
- [ ] No console.log statements
- [ ] Proper cleanup in afterEach

## Common Testing Patterns

### Testing Async Operations

```typescript
it("should handle async operations", async () => {
  const result = await asyncFunction()
  expect(result).toBeDefined()
})
```

### Testing Errors

```typescript
it("should throw on invalid input", () => {
  expect(() => functionThatThrows()).toThrow("Expected error message")
})
```

### Testing Database Operations

```typescript
it("should create booking in database", async () => {
  const booking = await createBooking(testData)

  const saved = await prisma.booking.findUnique({
    where: { id: booking.id },
  })

  expect(saved).toBeDefined()
  expect(saved.roomId).toBe(testData.roomId)
})
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Jest Matchers Reference](https://vitest.dev/api/expect.html)
