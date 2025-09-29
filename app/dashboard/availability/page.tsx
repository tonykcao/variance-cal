"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { AvailabilitySidebar, SearchFilters } from "@/components/availability/availability-sidebar"
import { RoomAvailabilityGrid } from "@/components/availability/room-availability-grid"
import { CreateBookingModal } from "@/components/availability/create-booking-modal"
import { format, parseISO } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { useCurrentUser } from "@/hooks/use-current-user"

// Transform API response to UI format
function transformAvailabilityData(apiData: any, targetDate: Date) {
  if (!apiData || !apiData.rooms) return []

  const targetDateStr = format(targetDate, "yyyy-MM-dd")

  return apiData.rooms.map((room: any) => {
    // Find the date matching our search date
    const dateData = room.dates.find((d: any) => d.date === targetDateStr)
    const slots = dateData ? dateData.slots : []

    return {
      room: {
        id: room.roomId,
        name: room.roomName,
        capacity: room.capacity,
        siteId: room.siteId,
        siteName: room.siteName,
        siteTimezone: room.timezone,
      },
      slots: slots.map((slot: any) => {
        // Convert UTC time to room's local time for display
        const startUtc = new Date(slot.startUtc)
        const localTime = formatInTimeZone(startUtc, room.timezone, "HH:mm")

        return {
          time: localTime,
          available: slot.available,
          isClosed: slot.reason === "outside-hours",
          isPast: slot.reason === "past",
          isOwnBooking: slot.isOwnBooking,
          isAttending: slot.isAttending,
        }
      }),
    }
  })
}

export default function AvailabilityPage() {
  const searchParams = useSearchParams()
  const { currentUser, loading: userLoading } = useCurrentUser()

  // Parse initial values from URL params
  const initialDate = searchParams.get("date") ? parseISO(searchParams.get("date")!) : undefined
  const initialSite = searchParams.get("site") || undefined

  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentFilters, setCurrentFilters] = useState<SearchFilters | null>(null)
  const [bookingModal, setBookingModal] = useState<{
    open: boolean
    room: any | null
    date: Date
    startTime: string
    endTime: string
  }>({
    open: false,
    room: null,
    date: new Date(),
    startTime: "",
    endTime: "",
  })

  // Load initial data on mount after user is loaded
  useEffect(() => {
    // Wait for user to be loaded before fetching data
    if (userLoading) return

    // Wait for sites to load first, then search with all site IDs
    const loadInitialData = async () => {
      try {
        const response = await fetch("/api/sites")
        const data = await response.json()
        if (response.ok && data.sites) {
          const allSiteIds = data.sites.map((site: any) => site.id)
          // Use next Monday to ensure we have available future slots
          const nextMonday = new Date()
          nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7))
          const initialFilters: SearchFilters = {
            sites: allSiteIds,
            capacityMin: 1,
            date: nextMonday,
          }
          handleSearch(initialFilters)
        }
      } catch (error) {
        console.error("Failed to load initial site data:", error)
      }
    }
    loadInitialData()
  }, [userLoading])

  const handleSearch = async (filters: SearchFilters) => {
    // Search initiated with filters
    setIsSearching(true)
    setCurrentFilters(filters)

    try {
      // Build query params
      const params = new URLSearchParams()

      // Sites are already names, not IDs
      if (filters.sites.length > 0) {
        params.set("sites", filters.sites.join(","))
      }

      if (filters.capacityMin > 1) {
        params.set("capacityMin", filters.capacityMin.toString())
      }

      const dateStr = format(filters.date, "yyyy-MM-dd")
      params.set("from", dateStr)
      params.set("to", dateStr)

      if (filters.timeWindow) {
        params.set("windowStart", filters.timeWindow.start)
        params.set("windowEnd", filters.timeWindow.end)
      }

      const response = await fetch(`/api/availability?${params}`)
      const data = await response.json()

      if (response.ok) {
        const transformedData = transformAvailabilityData(data, filters.date)
        setSearchResults(transformedData)
      } else {
        console.error("API error:", data.error)
        setSearchResults([])
      }
    } catch (error) {
      console.error("Failed to fetch availability:", error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSlotSelect = (room: any, startTime: string, endTime: string) => {
    // Slot selected for booking
    setBookingModal({
      open: true,
      room,
      date: currentFilters?.date || new Date(),
      startTime,
      endTime,
    })
  }

  const handleBookingConfirm = async (attendeeIds: string[]) => {
    // Creating booking with attendees

    if (!bookingModal.room || !currentFilters) {
      console.error("Missing booking details")
      return
    }

    try {
      // Format the date and times for the API
      const dateStr = format(currentFilters.date, "yyyy-MM-dd")
      const startLocal = `${dateStr}T${bookingModal.startTime}`
      const endLocal = `${dateStr}T${bookingModal.endTime}`

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: bookingModal.room.id,
          startLocal,
          endLocal,
          attendees: attendeeIds, // TODO: Convert emails to user IDs
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Booking created successfully
        setBookingModal({ ...bookingModal, open: false })
        // Refresh availability data
        if (currentFilters) {
          handleSearch(currentFilters)
        }
      } else {
        console.error("Failed to create booking:", data.error)
        alert(`Failed to create booking: ${data.error || "Unknown error"}`)
      }
    } catch (error) {
      console.error("Error creating booking:", error)
      alert("Failed to create booking. Please try again.")
    }
  }

  // Show loading state while user is being loaded
  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading user data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <AvailabilitySidebar
        onSearch={handleSearch}
        isSearching={isSearching}
        initialDate={initialDate}
        initialSite={initialSite}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Header */}
            <div className="border-b pb-6">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Available Rooms</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {currentFilters?.date
                  ? format(currentFilters.date, "EEEE, MMMM d, yyyy")
                  : "Select filters to search"}
              </p>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {isSearching ? (
                <div className="rounded-lg border bg-card p-16 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <p className="text-sm text-muted-foreground">
                      Searching for available rooms...
                    </p>
                  </div>
                </div>
              ) : searchResults.length === 0 && currentFilters ? (
                <div className="rounded-lg border bg-card p-16 text-center">
                  <div className="text-amber-500 mb-2 text-lg font-semibold">WARNING</div>
                  <p className="text-sm text-muted-foreground">
                    No rooms found matching your criteria
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-2">
                    Try adjusting your filters
                  </p>
                </div>
              ) : (
                <RoomAvailabilityGrid
                  availability={searchResults}
                  date={currentFilters?.date || new Date()}
                  userTimezone={currentUser?.timezone || "America/Los_Angeles"}
                  onSlotSelect={handleSlotSelect}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateBookingModal
        open={bookingModal.open}
        onClose={() => setBookingModal({ ...bookingModal, open: false })}
        room={bookingModal.room}
        date={bookingModal.date}
        startTime={bookingModal.startTime}
        endTime={bookingModal.endTime}
        userTimezone={currentUser?.timezone || "America/Los_Angeles"}
        onConfirm={handleBookingConfirm}
      />
    </div>
  )
}
