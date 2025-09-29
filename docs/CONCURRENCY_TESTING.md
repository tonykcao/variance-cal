# Concurrency Testing Documentation

## Overview

This document outlines the concurrency testing strategy for NookBook's room booking system. The primary goal is to ensure data integrity and prevent double-bookings under concurrent load.

## Test Scenarios

### 1. Double-Booking Prevention

**Scenario**: Multiple users attempt to book the same room slot simultaneously.

**Test Implementation**:

```javascript
// Located at: test/concurrency/double-booking-test.js
// Run with: node test/concurrency/double-booking-test.js [rounds]
```

**What it tests**:

- 3 concurrent users (alice-user, bob-user, david-guest)
- All attempt to book the same slot (tomorrow 14:00-15:30)
- Database unique constraint on BookingSlot table prevents duplicates
- Only one booking should succeed

**Expected Results**:

- Exactly 1 successful booking
- 2 failed bookings with "Unique constraint failed" error
- Database verification shows single booking record
- Automatic cleanup after test

**Demo Instructions**:

1. Reset database: `npm run db:seed`
2. Run test: `node test/concurrency/double-booking-test.js`
3. Observe results showing prevention of double-booking

### 2. Race Condition - Last-Minute Booking

**Scenario**: User attempts to book a slot while another user is in the process of booking it.

**Test Steps**:

1. User A initiates booking process (fills form)
2. User B initiates same booking (fills form)
3. User A submits first
4. User B submits milliseconds later

**Expected Behavior**:

- User A's booking succeeds
- User B receives error: "This slot has just been booked"
- UI should refresh to show updated availability

### 3. Concurrent Cancellations

**Scenario**: Multiple admins attempt to cancel the same booking simultaneously.

**Test Implementation**:

```typescript
async function testConcurrentCancellation() {
  const bookingId = "test-booking-id"

  // Two admins try to cancel simultaneously
  const promises = [cancelBooking(bookingId, "admin1"), cancelBooking(bookingId, "admin2")]

  const results = await Promise.allSettled(promises)

  // Only one should succeed
  const successful = results.filter(r => r.status === "fulfilled")
  expect(successful).toHaveLength(1)
}
```

**Expected Behavior**:

- First cancellation succeeds
- Second cancellation fails gracefully
- No data corruption
- Activity log shows single cancellation

### 4. Bulk Operations Under Load

**Scenario**: Admin performs bulk operations while users are actively booking.

**Test Cases**:

1. Admin changes room hours while bookings are being created
2. Admin bulk cancels bookings for maintenance
3. Multiple rooms being updated simultaneously

**Expected Behavior**:

- Operations complete atomically
- No partial updates
- Clear error messages for conflicts
- System remains responsive

### 5. Slot Boundary Conflicts

**Scenario**: Adjacent bookings with precise timing boundaries.

**Example**:

- Booking A: 09:00-10:00
- Booking B: 10:00-11:00
- Both submitted at exact same time

**Expected Behavior**:

- Both bookings should succeed (no overlap)
- Slot enumeration must be precise
- No off-by-one errors

### 6. Transaction Rollback Testing

**Scenario**: Booking creation fails mid-transaction.

**Test Implementation**:

```typescript
async function testTransactionRollback() {
  try {
    await prisma.$transaction(async (tx) => {
      // Create booking
      const booking = await tx.booking.create({...})

      // Create slots (this might fail on duplicate)
      await tx.bookingSlot.createMany({...})

      // If slot creation fails, entire transaction rolls back
    })
  } catch (error) {
    // Verify no partial data exists
    const orphanedBooking = await prisma.booking.findUnique({...})
    expect(orphanedBooking).toBeNull()
  }
}
```

### 7. High Load Stress Testing

**Scenario**: System under heavy concurrent load.

**Parameters**:

- 50 concurrent users
- 100 booking attempts per minute
- Mixed operations (create, cancel, query)

**Metrics to Monitor**:

- Response time percentiles (p50, p95, p99)
- Error rate
- Database connection pool utilization
- Lock wait times

## Database-Level Protections

### Unique Constraints

```prisma
model BookingSlot {
  @@unique([roomId, slotStartUtc]) // Prevents double-booking
}
```

### Transaction Isolation Levels

- Default: READ COMMITTED
- For critical operations: SERIALIZABLE
- Prevents phantom reads and ensures consistency

### Lock Strategies

1. **Optimistic Locking**: Version fields on rooms
2. **Pessimistic Locking**: Row-level locks for updates
3. **Advisory Locks**: For complex multi-step operations

## Testing Tools and Scripts

### Automated Test Runner

```bash
# Run all concurrency tests
npm run test:concurrency

# Run specific scenario
npm run test:concurrency -- --scenario double-booking

# Stress test with custom load
npm run test:concurrency -- --users 100 --duration 60s
```

### Manual Testing Scripts

#### Windows

```batch
# test-concurrency.bat
@echo off
echo Running concurrency tests...
node test/concurrency/double-booking-test.js %1
```

#### Unix/Mac

```bash
#!/bin/bash
# test-concurrency.sh
echo "Running concurrency tests..."
node test/concurrency/double-booking-test.js $1
```

### Cleanup Scripts

```javascript
// cleanup-test-data.js
async function cleanupTestData() {
  await prisma.$transaction([
    prisma.bookingSlot.deleteMany({
      where: { booking: { owner: { email: { contains: "test" } } } },
    }),
    prisma.booking.deleteMany({
      where: { owner: { email: { contains: "test" } } },
    }),
  ])
}
```

## Monitoring and Verification

### Key Metrics

1. **Booking Success Rate**: Should be 100% for non-conflicting requests
2. **Constraint Violations**: Expected for conflicting requests
3. **Transaction Rollback Rate**: Should be low (<1%)
4. **Response Time**: <200ms for booking creation

### Database Queries for Verification

```sql
-- Check for double-booked slots
SELECT roomId, slotStartUtc, COUNT(*) as count
FROM BookingSlot
GROUP BY roomId, slotStartUtc
HAVING count > 1;

-- Find orphaned booking records
SELECT b.id FROM Booking b
LEFT JOIN BookingSlot bs ON b.id = bs.bookingId
WHERE bs.id IS NULL AND b.canceledAt IS NULL;

-- Activity log for concurrent operations
SELECT * FROM ActivityLog
WHERE action IN ('BOOKING_CREATED', 'BOOKING_CANCELED')
  AND createdAt > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY createdAt DESC;
```

## Best Practices

### For Development

1. Always use transactions for multi-table operations
2. Implement proper error handling and rollback
3. Use database constraints as primary defense
4. Add application-level validation as secondary defense

### For Testing

1. Reset database state before each test
2. Use deterministic test data
3. Clean up after tests complete
4. Log all operations for debugging

### For Production

1. Monitor constraint violation rates
2. Set up alerts for high conflict rates
3. Implement retry logic with exponential backoff
4. Use connection pooling appropriately

## Common Issues and Solutions

### Issue 1: Deadlocks

**Symptom**: Database deadlock errors under high load

**Solution**:

- Order lock acquisition consistently
- Reduce transaction scope
- Implement deadlock retry logic

### Issue 2: Connection Pool Exhaustion

**Symptom**: "Too many connections" errors

**Solution**:

- Tune pool size based on load
- Implement connection timeout
- Use connection pooling middleware

### Issue 3: Slow Queries Under Concurrency

**Symptom**: Degraded performance with many concurrent users

**Solution**:

- Add appropriate indexes
- Optimize query patterns
- Consider read replicas for queries

## Test Results Archive

### Latest Test Run

```
Date: 2025-09-25
Test: Double-booking prevention
Rounds: 3
Results:
  Round 1: 1 success, 2 failures (PASSED)
  Round 2: 1 success, 2 failures (PASSED)
  Round 3: 1 success, 2 failures (PASSED)
Database Verification: PASSED
Cleanup: SUCCESSFUL
```

### Performance Benchmarks

```
Operation         | Avg Time | P95    | P99
------------------|----------|--------|--------
Create Booking    | 45ms     | 120ms  | 200ms
Cancel Booking    | 30ms     | 80ms   | 150ms
Query Availability| 25ms     | 60ms   | 100ms
Bulk Cancel (10)  | 200ms    | 400ms  | 600ms
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Concurrency Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm run db:setup
      - run: npm run test:concurrency
      - run: npm run test:cleanup
```

## References

- [Prisma Transactions Documentation](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [MySQL Locking Documentation](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking.html)
- [Database Concurrency Control](https://en.wikipedia.org/wiki/Concurrency_control)
