/**
 * Vitest Global Test Setup
 * This file runs before all tests
 */

import { beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Extend the global namespace for test utilities
declare global {
  var __TEST_PRISMA_CLIENT__: PrismaClient | undefined
}

// Setup test environment
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

  console.log('[TEST SETUP] Initializing test environment')
})

// Cleanup after each test
beforeEach(async () => {
  // Reset any mocks or test state
})

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  if (global.__TEST_PRISMA_CLIENT__) {
    await global.__TEST_PRISMA_CLIENT__.$disconnect()
  }

  console.log('[TEST CLEANUP] Test environment cleaned up')
})