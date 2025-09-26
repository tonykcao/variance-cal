import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getUserById } from "./lib/auth/mock-users"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Check for x-user-id header (for development)
  const userIdHeader = request.headers.get("x-user-id")

  // Check for user cookie
  const userCookie = request.cookies.get("mock-user-id")

  // Get the current user ID (default to alice-admin)
  const currentUserId = userIdHeader || userCookie?.value || "cmg2v5ftb0000vcm83ujio2gd"

  // Only set default user if none is set AND we're on a protected route
  // Don't override existing cookies!
  if (!userIdHeader && !userCookie && request.nextUrl.pathname.startsWith("/dashboard")) {
    response.cookies.set("mock-user-id", "cmg2v5ftb0000vcm83ujio2gd", {
      httpOnly: false, // Allow client-side access for development
      sameSite: "lax",
      path: "/",
    })
  }

  // Check if the user is trying to access admin routes
  if (request.nextUrl.pathname.startsWith("/dashboard/admin")) {
    const user = getUserById(currentUserId)

    // If user is not an admin, redirect to dashboard
    if (!user || user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
