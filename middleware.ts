import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getUserById } from "./lib/auth/mock-users"

export function middleware(request: NextRequest) {
  // Check for x-user-id header (for development)
  const userIdHeader = request.headers.get("x-user-id")

  // Check for user cookie
  const userCookie = request.cookies.get("mock-user-id")

  // Get the current user ID (default to alice-admin)
  // Note: Next.js automatically decodes cookie values, so userCookie?.value is already decoded
  const currentUserId = userIdHeader || userCookie?.value || "alice@example.com"

  // Create response that will be returned
  let response = NextResponse.next()

  // Always ensure a user cookie is set for dashboard/api routes
  if (
    (request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/api"))
  ) {
    // If no cookie, set it
    if (!userCookie) {
      response = NextResponse.next()
      // Next.js will automatically encode the cookie value
      response.cookies.set("mock-user-id", currentUserId, {
        httpOnly: false, // Allow client-side access for development
        sameSite: "lax",
        path: "/",
      })
    }

    // Check admin access
    if (request.nextUrl.pathname.startsWith("/dashboard/admin")) {
      const user = getUserById(currentUserId)

      // If user is not an admin, redirect to dashboard
      if (!user || user.role !== "ADMIN") {
        const redirectUrl = new URL("/dashboard/availability", request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
