"use client"

import { useState } from "react"
import { useBookings } from "@/hooks/useBookings"
import { useUserTimezone } from "@/hooks/useUserTimezone"
import { BookingsList } from "@/components/bookings/BookingsList"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")
  const userTimezone = useUserTimezone()

  const { bookings, isLoading, error, cancelBooking, refetch, currentUser } = useBookings(activeTab)

  const handleTabChange = (tab: "upcoming" | "past") => {
    setActiveTab(tab)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
        <p className="text-muted-foreground">View and manage your room reservations.</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          <button
            onClick={() => handleTabChange("upcoming")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "upcoming"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => handleTabChange("past")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "past"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Past
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <button onClick={() => refetch()} className="ml-2 underline hover:no-underline">
              Try again
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Bookings List */}
      <BookingsList
        bookings={bookings}
        userTimezone={userTimezone}
        isLoading={isLoading}
        onCancelBooking={cancelBooking}
        activeTab={activeTab}
        currentUser={currentUser}
      />
    </div>
  )
}
