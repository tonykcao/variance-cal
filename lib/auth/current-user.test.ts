/**
 * Test version of getCurrentUser that works without request context
 * This file is imported in tests to override the production version
 */

import { prisma } from '@/lib/db';
import type { User } from '@prisma/client';

// Store test user ID in a module-level variable
let testUserId: string | null = null;

/**
 * Set the test user ID for the current test session
 */
export function setTestUserId(userId: string | null) {
  testUserId = userId;
}

/**
 * Test-safe version of getCurrentUser
 * Uses the test user ID set via setTestUserId
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    if (!testUserId) {
      // Return default user in test environment
      const defaultUser = await prisma.user.findFirst({
        where: { email: 'alice@example.com' },
      });
      return defaultUser;
    }

    const user = await prisma.user.findUnique({
      where: { id: testUserId },
    });

    return user;
  } catch (error) {
    console.error('Error getting current user in test:', error);
    return null;
  }
}

/**
 * Get current user or throw
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'ADMIN';
}