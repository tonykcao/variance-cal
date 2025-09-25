import { ClipboardClock } from "lucide-react"
import Link from "next/link"
import { UserSwitcher } from "@/components/user-switcher"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <ClipboardClock className="h-6 w-6" />
            <span className="font-bold">NookBook</span>
          </Link>

          {/* Main Navigation */}
          <nav className="ml-8 flex items-center space-x-6">
            <Link
              href="/dashboard/availability"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Find Rooms
            </Link>
            <Link
              href="/dashboard/my-bookings"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              My Bookings
            </Link>
            <Link
              href="/dashboard/admin"
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Admin
            </Link>
          </nav>

          {/* User Switcher */}
          <div className="ml-auto flex items-center space-x-4">
            <UserSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-6">{children}</main>
    </div>
  )
}
