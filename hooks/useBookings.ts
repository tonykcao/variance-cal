import { useState, useEffect, useCallback } from "react"

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

interface UseBookingsReturn {
  bookings: Booking[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  cancelBooking: (bookingId: string) => Promise<void>
  currentUser: { id: string; role: string } | null
}

export function useBookings(scope: "upcoming" | "past"): UseBookingsReturn {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)

  const fetchBookings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/bookings?scope=${scope}`)

      if (!response.ok) {
        throw new Error("Failed to fetch bookings")
      }

      const data = await response.json()
      setBookings(data.bookings || [])
      setCurrentUser(data.currentUser || null)
    } catch (err) {
      console.error("Error fetching bookings:", err)
      setError(err instanceof Error ? err.message : "Failed to load bookings")
      setBookings([])
    } finally {
      setIsLoading(false)
    }
  }, [scope])

  const cancelBooking = useCallback(async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to cancel booking")
      }

      // Refetch bookings after successful cancellation
      await fetchBookings()
    } catch (err) {
      console.error("Error canceling booking:", err)
      throw err
    }
  }, [fetchBookings])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  return {
    bookings,
    isLoading,
    error,
    refetch: fetchBookings,
    cancelBooking,
    currentUser,
  }
}