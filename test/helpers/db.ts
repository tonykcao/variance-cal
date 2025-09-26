/**
 * Database Test Helpers
 * Utilities for setting up and tearing down test databases
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

let prisma: PrismaClient

/**
 * Get or create a Prisma client for testing
 */
export function getTestPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
        },
      },
      log: process.env.DEBUG ? ['query', 'info', 'warn', 'error'] : [],
    })
  }
  return prisma
}

/**
 * Reset the test database
 * WARNING: This will delete all data!
 */
export async function resetTestDatabase(): Promise<void> {
  const prisma = getTestPrismaClient()

  // Get all table names
  const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME NOT LIKE '_prisma%'
  `

  // Disable foreign key checks and truncate all tables
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`

  for (const { TABLE_NAME } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``)
  }

  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`
}

/**
 * Seed test data
 */
export async function seedTestData(scenario: 'minimal' | 'full' = 'minimal'): Promise<void> {
  const prisma = getTestPrismaClient()

  if (scenario === 'minimal') {
    // Create minimal test data
    const site = await prisma.site.create({
      data: {
        name: 'Test Site',
        timezone: 'America/New_York',
      },
    })

    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'America/New_York',
        role: 'USER',
      },
    })

    await prisma.room.create({
      data: {
        siteId: site.id,
        name: 'Test Room',
        capacity: 4,
        opening: {
          mon: { open: '09:00', close: '17:00' },
          tue: { open: '09:00', close: '17:00' },
          wed: { open: '09:00', close: '17:00' },
          thu: { open: '09:00', close: '17:00' },
          fri: { open: '09:00', close: '17:00' },
          sat: { open: '10:00', close: '14:00' },
          sun: { open: '10:00', close: '14:00' },
        },
      },
    })
  } else {
    // Run the full seed script
    execSync('npm run db:seed', { stdio: 'inherit' })
  }
}

/**
 * Clean up database connections
 */
export async function cleanupDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
  }
}