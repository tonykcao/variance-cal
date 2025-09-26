"use client"

import { useState, useEffect } from "react"
import { BookingCard } from "./BookingCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, CalendarOff } from "lucide-react"

interface Booking {
  id: string
  roomId: string
  roomName: string
  siteName: string
  timezone: string
  startUtc: string
  endUtc: string
  startLocal: string
  endLocal: string
  isOwner: boolean
  owner: {
    id: string
    name: string
    email: string
  }
  attendees: Array<{
    id: string
    name: string
    email: string
  }>
  canceledAt: string | null
}

interface BookingsListProps {
  bookings: Booking[]
  userTimezone: string
  isLoading: boolean
  onCancelBooking: (bookingId: string) => Promise<void>
  activeTab: "upcoming" | "past"
  currentUser: { id: string; role: string } | null
}

export function BookingsList({
  bookings,
  userTimezone,
  isLoading,
  onCancelBooking,
  activeTab,
  currentUser,
}: BookingsListProps) {
  const [sortedBookings, setSortedBookings] = useState<Booking[]>([])

  useEffect(() => {
    // Sort bookings by start time
    const sorted = [...bookings].sort((a, b) => {
      const dateA = new Date(a.startUtc).getTime()
      const dateB = new Date(b.startUtc).getTime()
      // Upcoming bookings: ascending order (nearest first)
      // Past bookings: descending order (most recent first)
      return activeTab === "upcoming" ? dateA - dateB : dateB - dateA
    })
    setSortedBookings(sorted)
  }, [bookings, activeTab])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-9 w-20" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (sortedBookings.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12">
        <div className="text-center">
          {activeTab === "upcoming" ? (
            <>
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No upcoming bookings</p>
              <p className="text-sm text-muted-foreground">
                Your future reservations will appear here.
              </p>
            </>
          ) : (
            <>
              <CalendarOff className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">No past bookings</p>
              <p className="text-sm text-muted-foreground">
                Your booking history will appear here.
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedBookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          userTimezone={userTimezone}
          onCancel={onCancelBooking}
          showActivity={false}
          isAdmin={currentUser?.role === "ADMIN"}
        />
      ))}
    </div>
  )
}