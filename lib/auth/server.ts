import { cookies, headers } from "next/headers"
import { getUserById, MOCK_USERS } from "./mock-users"
import { User } from "./types"
import { prisma } from "@/lib/db"

export async function getCurrentUser(): Promise<User | null> {
  try {
    // Check headers first (for API routes)
    const headersList = await headers()
    const userIdHeader = headersList.get("x-user-id")

    // Then check cookies
    const cookieStore = await cookies()
    const userCookie = cookieStore.get("mock-user-id")

    // Get user ID with fallback to alice-admin
    // Note: Next.js automatically decodes cookie values
    const userId = userIdHeader || userCookie?.value || "alice@example.com"

    // Try database first
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (dbUser) {
        return {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          timezone: dbUser.timezone,
          role: dbUser.role as "USER" | "ADMIN",
        }
      }
    } catch (error) {
      // Database not available, fall through to mock
    }

    // Fallback to mock user
    return getUserById(userId) || MOCK_USERS[0]
  } catch (error) {
    console.error("Error getting current user:", error)
    return MOCK_USERS[0] // Return alice-admin as fallback
  }
}

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()

  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required")
  }

  return user
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("Unauthorized: User not found")
  }

  return user
}