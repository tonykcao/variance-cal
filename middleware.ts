import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Check for x-user-id header (for development)
  const userIdHeader = request.headers.get("x-user-id")

  // Check for user cookie
  const userCookie = request.cookies.get("mock-user-id")

  // Set default user if none is set (alice-user)
  if (!userIdHeader && !userCookie) {
    response.cookies.set("mock-user-id", "user-alice", {
      httpOnly: false, // Allow client-side access for development
      sameSite: "lax",
      path: "/",
    })
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
