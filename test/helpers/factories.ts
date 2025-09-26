/**
 * Test Data Factories
 * Use these to generate consistent test data
 */

import { faker } from '@faker-js/faker'
import { Role } from '@prisma/client'

// Set seed for consistent test data
faker.seed(123)

/**
 * User factory
 */
export function createMockUser(overrides?: Partial<any>) {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    name: faker.person.fullName(),
    timezone: faker.helpers.arrayElement([
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Asia/Shanghai',
    ]),
    role: faker.helpers.arrayElement(['USER', 'ADMIN'] as Role[]),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

/**
 * Site factory
 */
export function createMockSite(overrides?: Partial<any>) {
  const siteOptions = [
    { name: 'San Francisco', timezone: 'America/Los_Angeles' },
    { name: 'New York', timezone: 'America/New_York' },
    { name: 'London', timezone: 'Europe/London' },
    { name: 'Shanghai', timezone: 'Asia/Shanghai' },
  ]

  const selected = faker.helpers.arrayElement(siteOptions)

  return {
    id: faker.string.uuid(),
    name: selected.name,
    timezone: selected.timezone,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

/**
 * Room factory
 */
export function createMockRoom(siteId: string, overrides?: Partial<any>) {
  const roomNames = ['Oak', 'Maple', 'Cedar', 'Pine', 'Birch', 'Redwood', 'Willow']

  return {
    id: faker.string.uuid(),
    siteId,
    name: faker.helpers.arrayElement(roomNames),
    capacity: faker.number.int({ min: 2, max: 12 }),
    opening: {
      mon: { open: '08:00', close: '20:00' },
      tue: { open: '08:00', close: '20:00' },
      wed: { open: '08:00', close: '20:00' },
      thu: { open: '08:00', close: '20:00' },
      fri: { open: '08:00', close: '20:00' },
      sat: { open: '10:00', close: '16:00' },
      sun: { open: '10:00', close: '16:00' },
    },
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

/**
 * Booking factory
 */
export function createMockBooking(roomId: string, ownerId: string, overrides?: Partial<any>) {
  const startUtc = faker.date.future()
  const endUtc = new Date(startUtc.getTime() + faker.number.int({ min: 30, max: 180 }) * 60 * 1000)

  return {
    id: faker.string.uuid(),
    roomId,
    ownerId,
    startUtc,
    endUtc,
    canceledAt: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  }
}

/**
 * Create a complete test scenario with related data
 */
export function createTestScenario() {
  const user = createMockUser({ role: 'USER' })
  const admin = createMockUser({ role: 'ADMIN' })
  const site = createMockSite()
  const room1 = createMockRoom(site.id)
  const room2 = createMockRoom(site.id)
  const booking1 = createMockBooking(room1.id, user.id)
  const booking2 = createMockBooking(room2.id, admin.id)

  return {
    users: [user, admin],
    sites: [site],
    rooms: [room1, room2],
    bookings: [booking1, booking2],
  }
}