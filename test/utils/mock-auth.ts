/**
 * Mock authentication utilities for testing
 * Provides a way to test API routes that use headers() and cookies()
 */

import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@prisma/client';

// Store the current mock user for the test session
let mockUser: User | null = null;

/**
 * Set the mock user for testing
 */
export function setMockUser(user: User | null) {
  mockUser = user;
}

/**
 * Get the current mock user
 */
export function getMockUser(): User | null {
  return mockUser;
}

/**
 * Mock the Next.js headers and cookies functions
 * Call this before running API route handlers in tests
 */
export function mockAuthContext(userId: string) {
  // Store original functions
  const originalHeaders = (global as any).headers;
  const originalCookies = (global as any).cookies;

  // Create mock implementations
  const mockHeaders = () => ({
    get: (name: string) => (name === 'x-user-id' ? userId : null),
    has: (name: string) => name === 'x-user-id',
    getAll: () => [],
    forEach: () => {},
    entries: () => [],
    keys: () => [],
    values: () => [],
    [Symbol.iterator]: () => [],
  });

  const mockCookies = () => ({
    get: (name: string) => (name === 'x-user-id' ? { name, value: userId } : undefined),
    has: (name: string) => name === 'x-user-id',
    getAll: () => [{ name: 'x-user-id', value: userId }],
    set: () => {},
    delete: () => {},
    [Symbol.iterator]: () => [],
  });

  // Replace global functions
  (global as any).headers = mockHeaders;
  (global as any).cookies = mockCookies;

  // Return cleanup function
  return () => {
    (global as any).headers = originalHeaders;
    (global as any).cookies = originalCookies;
  };
}

/**
 * Create a test request with authentication
 */
export function createAuthenticatedRequest(
  url: string,
  options: RequestInit & { userId?: string } = {}
) {
  const { userId, ...init } = options;
  const headers = new Headers(init.headers);

  if (userId) {
    headers.set('x-user-id', userId);
  }

  return new NextRequest(url, {
    ...init,
    headers,
  });
}

/**
 * Execute an API handler with mocked authentication
 */
export async function withMockAuth<T = any>(
  userId: string,
  handler: () => Promise<T>
): Promise<T> {
  const cleanup = mockAuthContext(userId);
  try {
    return await handler();
  } finally {
    cleanup();
  }
}