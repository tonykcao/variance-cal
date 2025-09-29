"use client"

import { ClipboardClock } from "lucide-react"
import Link from "next/link"
import { UserSwitcher } from "@/components/user-switcher"
import { useCurrentUser } from "@/hooks/use-current-user"

function DashboardNavigation() {
  const { isAdmin } = useCurrentUser()

  return (
    <nav className="ml-10 flex items-center space-x-6">
      <Link
        href="/dashboard/availability"
        className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
      >
        Find Rooms
      </Link>
      <Link
        href="/dashboard/my-bookings"
        className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
      >
        My Bookings
      </Link>
      {isAdmin && (
        <Link
          href="/dashboard/admin"
          className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
        >
          Admin
        </Link>
      )}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full bg-gray-900 border-b border-gray-800">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center space-x-3 group">
                <ClipboardClock className="h-5 w-5 text-gray-400 group-hover:text-gray-200 transition-colors" />
                <span className="text-base font-semibold text-gray-100 tracking-tight">
                  NookBook
                </span>
              </Link>

              {/* Main Navigation */}
              <DashboardNavigation />
            </div>

            {/* User Switcher */}
            <div className="flex items-center">
              <UserSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  )
}
