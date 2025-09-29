import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth/current-user"

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser(request)

  // Also check raw headers and cookies for debugging
  const mockUserId = request.headers.get("Cookie")?.match(/mock-user-id=([^;]+)/)?.[1]
  const xUserId = request.headers.get("x-user-id")

  return NextResponse.json({
    currentUser: currentUser
      ? {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        }
      : null,
    debug: {
      mockUserIdFromCookie: mockUserId,
      xUserIdFromHeader: xUserId,
      allCookies: request.headers.get("Cookie"),
    },
  })
}
