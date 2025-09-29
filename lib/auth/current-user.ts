/**
 * Get current user from request
 */

import { cookies, headers } from "next/headers"
import { prisma } from "@/lib/db"
import type { User } from "@prisma/client"
import { NextRequest } from "next/server"

/**
 * Get the current authenticated user
 * In development, this uses the x-user-id cookie or header
 * In production, this would use a real auth system
 */
export async function getCurrentUser(request?: NextRequest): Promise<User | null> {
  try {
    let userId: string | undefined

    // If request is provided (for testing), extract user ID from it
    if (request) {
      // First try header
      userId = request.headers.get("x-user-id") || undefined

      // If no header, try cookie
      if (!userId) {
        const cookieHeader = request.headers.get("cookie")
        if (cookieHeader) {
          // Parse cookies manually
          const cookies = cookieHeader.split(";").reduce(
            (acc, cookie) => {
              const [key, value] = cookie.trim().split("=")
              acc[key] = value
              return acc
            },
            {} as Record<string, string>
          )

          userId = cookies["mock-user-id"] || cookies["x-user-id"]
          // Decode URL-encoded user ID (handles %40 -> @)
          if (userId) {
            userId = decodeURIComponent(userId)
          }
        }
      }
    } else {
      // Use Next.js headers and cookies (for production)
      try {
        // First check headers (for testing and API calls)
        const headersList = await headers()
        const headerUserId = headersList.get("x-user-id")

        if (headerUserId) {
          userId = headerUserId
        } else {
          // Fall back to cookie (for browser requests)
          const cookieStore = await cookies()
          const xUserIdCookie = cookieStore.get("x-user-id")
          const mockUserIdCookie = cookieStore.get("mock-user-id")

          userId = xUserIdCookie?.value || mockUserIdCookie?.value
          // Next.js already decodes cookie values, but double-check
          if (userId && userId.includes("%40")) {
            userId = decodeURIComponent(userId)
          }
        }
      } catch (error) {
        // Headers/cookies not available (e.g., in tests)
        console.error("Headers/cookies not available:", error)
      }
    }

    if (!userId) {
      return null
    }

    // Look up user by ID
    let user = await prisma.user.findUnique({
      where: { id: userId },
    })

    // If user not found by ID, try to find by email (for backwards compatibility with mock data)
    if (!user && userId.includes("@")) {
      user = await prisma.user.findUnique({
        where: { email: userId },
      })
    }

    // Don't fallback to alice in development - return null if user not found
    // This ensures each user sees their own bookings
    if (!user) {
      console.warn(`User with ID ${userId} not found`)
      return null
    }

    return user
  } catch (error) {
    console.error("Error getting current user:", error)
    return null
  }
}

/**
 * Get current user or throw
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized")
  }

  return user
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === "ADMIN"
}
