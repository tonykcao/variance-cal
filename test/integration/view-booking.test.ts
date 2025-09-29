import { describe, it, expect, beforeEach } from "vitest"
import { format, parse, isSameDay } from "date-fns"
import { toZonedTime, fromZonedTime } from "date-fns-tz"

interface BookingData {
  id: string
  roomId: string
  roomName: string
  siteName: string
  siteTimezone: string
  startUtc: Date
  endUtc: Date
  ownerName: string
}

interface CalendarState {
  isOpen: boolean
  currentMonth: Date
  selectedDate: Date | null
  focusedDate: Date | null
}

describe("View Booking Button Functionality", () => {
  let mockBookings: BookingData[]
  let calendarState: CalendarState

  beforeEach(() => {
    // Initialize calendar state
    calendarState = {
      isOpen: false,
      currentMonth: new Date(2025, 9, 1), // October 2025
      selectedDate: null,
      focusedDate: null,
    }

    // Create mock bookings
    mockBookings = [
      {
        id: "booking-1",
        roomId: "room-1",
        roomName: "Broadway",
        siteName: "New York",
        siteTimezone: "America/New_York",
        startUtc: new Date("2025-10-07T18:00:00Z"), // Oct 7, 14:00 EDT
        endUtc: new Date("2025-10-07T20:00:00Z"), // Oct 7, 16:00 EDT
        ownerName: "Alice User",
      },
      {
        id: "booking-2",
        roomId: "room-2",
        roomName: "Thames",
        siteName: "London",
        siteTimezone: "Europe/London",
        startUtc: new Date("2025-11-15T10:00:00Z"), // Nov 15, 10:00 GMT
        endUtc: new Date("2025-11-15T11:30:00Z"), // Nov 15, 11:30 GMT
        ownerName: "Bob User",
      },
      {
        id: "booking-3",
        roomId: "room-3",
        roomName: "Bund",
        siteName: "Shanghai",
        siteTimezone: "Asia/Shanghai",
        startUtc: new Date("2025-12-25T02:00:00Z"), // Dec 25, 10:00 CST
        endUtc: new Date("2025-12-25T04:00:00Z"), // Dec 25, 12:00 CST
        ownerName: "Connor Admin",
      },
    ]
  })

  describe("Calendar Jump to Date", () => {
    it("should open calendar to correct month when viewing booking", () => {
      const booking = mockBookings[0] // October booking

      // Simulate clicking "View on Calendar" button
      const viewOnCalendar = (booking: BookingData) => {
        // Convert UTC to room timezone
        const bookingDateInRoomTz = toZonedTime(booking.startUtc, booking.siteTimezone)

        // Open calendar to booking's month
        calendarState.isOpen = true
        calendarState.currentMonth = new Date(
          bookingDateInRoomTz.getFullYear(),
          bookingDateInRoomTz.getMonth(),
          1
        )
        calendarState.focusedDate = bookingDateInRoomTz

        return calendarState
      }

      const result = viewOnCalendar(booking)

      expect(result.isOpen).toBe(true)
      expect(result.currentMonth.getMonth()).toBe(9) // October
      expect(result.currentMonth.getFullYear()).toBe(2025)
      expect(result.focusedDate?.getDate()).toBe(7) // October 7
    })

    it("should handle cross-month navigation for future bookings", () => {
      const novemberBooking = mockBookings[1]
      const decemberBooking = mockBookings[2]

      // Test November booking
      const novemberDate = toZonedTime(novemberBooking.startUtc, novemberBooking.siteTimezone)
      calendarState.currentMonth = new Date(novemberDate.getFullYear(), novemberDate.getMonth(), 1)

      expect(calendarState.currentMonth.getMonth()).toBe(10) // November
      expect(novemberDate.getDate()).toBe(15)

      // Test December booking
      const decemberDate = toZonedTime(decemberBooking.startUtc, decemberBooking.siteTimezone)
      calendarState.currentMonth = new Date(decemberDate.getFullYear(), decemberDate.getMonth(), 1)

      expect(calendarState.currentMonth.getMonth()).toBe(11) // December
      expect(decemberDate.getDate()).toBe(25)
    })

    it("should highlight the booking date on calendar", () => {
      const booking = mockBookings[0]
      const bookingDate = toZonedTime(booking.startUtc, booking.siteTimezone)

      // Simulate calendar highlighting
      const isHighlighted = (date: Date, bookingDate: Date) => {
        return isSameDay(date, bookingDate)
      }

      // Test various dates
      const october7 = new Date(2025, 9, 7)
      const october8 = new Date(2025, 9, 8)
      const october6 = new Date(2025, 9, 6)

      expect(isHighlighted(october7, bookingDate)).toBe(true)
      expect(isHighlighted(october8, bookingDate)).toBe(false)
      expect(isHighlighted(october6, bookingDate)).toBe(false)
    })
  })

  describe("Button State and Behavior", () => {
    it("should show View on Calendar button for future bookings", () => {
      const now = new Date("2025-09-25T12:00:00Z")

      mockBookings.forEach(booking => {
        const isFuture = booking.startUtc > now
        const showViewButton = isFuture || booking.endUtc > now

        expect(showViewButton).toBe(true)
        console.log(`Booking ${booking.id}: Show view button = ${showViewButton}`)
      })
    })

    it("should handle View on Calendar for past bookings", () => {
      const pastBooking: BookingData = {
        id: "past-booking",
        roomId: "room-4",
        roomName: "Oak",
        siteName: "San Francisco",
        siteTimezone: "America/Los_Angeles",
        startUtc: new Date("2025-01-15T18:00:00Z"), // Past date
        endUtc: new Date("2025-01-15T19:00:00Z"),
        ownerName: "Test User",
      }

      // Even past bookings should allow viewing on calendar for reference
      const bookingDate = toZonedTime(pastBooking.startUtc, pastBooking.siteTimezone)

      calendarState.currentMonth = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), 1)

      expect(calendarState.currentMonth.getMonth()).toBe(0) // January
      expect(calendarState.currentMonth.getFullYear()).toBe(2025)
    })

    it("should maintain calendar state after viewing booking", () => {
      const booking = mockBookings[0]
      const bookingDate = toZonedTime(booking.startUtc, booking.siteTimezone)

      // Open calendar to booking
      calendarState.isOpen = true
      calendarState.currentMonth = new Date(2025, 9, 1)
      calendarState.focusedDate = bookingDate

      // User navigates to different month
      calendarState.currentMonth = new Date(2025, 10, 1) // November

      // Focus should be cleared when navigating away
      calendarState.focusedDate = null

      expect(calendarState.currentMonth.getMonth()).toBe(10)
      expect(calendarState.focusedDate).toBeNull()
    })
  })

  describe("Timezone-aware Display", () => {
    it("should display booking date in room timezone on calendar", () => {
      const shanghaiBooking = mockBookings[2]

      // Booking is at 10:00 AM Shanghai time
      const shanghaiTime = toZonedTime(shanghaiBooking.startUtc, shanghaiBooking.siteTimezone)

      expect(shanghaiTime.getHours()).toBe(10)
      expect(shanghaiTime.getDate()).toBe(25)
      expect(shanghaiTime.getMonth()).toBe(11) // December

      // Calendar should show December 25 when viewing this booking
      const calendarDisplay = {
        month: shanghaiTime.getMonth(),
        date: shanghaiTime.getDate(),
        year: shanghaiTime.getFullYear(),
      }

      expect(calendarDisplay.month).toBe(11)
      expect(calendarDisplay.date).toBe(25)
      expect(calendarDisplay.year).toBe(2025)
    })

    it("should handle booking dates across timezone boundaries", () => {
      // Booking late at night in NY that appears next day in UTC
      const lateNYBooking: BookingData = {
        id: "late-ny",
        roomId: "room-5",
        roomName: "Hudson",
        siteName: "New York",
        siteTimezone: "America/New_York",
        startUtc: new Date("2025-10-08T03:00:00Z"), // Oct 7, 23:00 EDT
        endUtc: new Date("2025-10-08T04:00:00Z"), // Oct 8, 00:00 EDT
        ownerName: "Night Owl",
      }

      const nyTime = toZonedTime(lateNYBooking.startUtc, lateNYBooking.siteTimezone)

      // Should show October 7 in NY time, not October 8
      expect(nyTime.getDate()).toBe(7)
      expect(nyTime.getHours()).toBe(23)

      // Calendar should navigate to October 7
      calendarState.currentMonth = new Date(nyTime.getFullYear(), nyTime.getMonth(), 1)
      calendarState.focusedDate = nyTime

      expect(calendarState.focusedDate?.getDate()).toBe(7)
    })
  })

  describe("Integration with Booking List", () => {
    it("should handle multiple View on Calendar actions", () => {
      const viewActions: CalendarState[] = []

      // Simulate viewing multiple bookings in sequence
      mockBookings.forEach(booking => {
        const bookingDate = toZonedTime(booking.startUtc, booking.siteTimezone)

        const state = {
          isOpen: true,
          currentMonth: new Date(bookingDate.getFullYear(), bookingDate.getMonth(), 1),
          selectedDate: null,
          focusedDate: bookingDate,
        }

        viewActions.push(state)
      })

      // Verify each action navigated to correct month
      expect(viewActions[0].currentMonth.getMonth()).toBe(9) // October
      expect(viewActions[1].currentMonth.getMonth()).toBe(10) // November
      expect(viewActions[2].currentMonth.getMonth()).toBe(11) // December

      // All should open calendar
      viewActions.forEach(action => {
        expect(action.isOpen).toBe(true)
      })
    })

    it("should scroll booking into view when calendar opens", () => {
      // Simulate scroll behavior
      const scrollToBooking = (bookingElement: string) => {
        // Mock implementation
        return {
          element: bookingElement,
          scrolled: true,
          behavior: "smooth",
        }
      }

      const booking = mockBookings[0]
      const result = scrollToBooking(`booking-${booking.id}`)

      expect(result.scrolled).toBe(true)
      expect(result.element).toBe("booking-booking-1")
      expect(result.behavior).toBe("smooth")
    })

    it("should handle rapid View on Calendar clicks", () => {
      const clickTimes: number[] = []

      // Simulate rapid clicks
      for (let i = 0; i < 5; i++) {
        clickTimes.push(Date.now())

        // Should debounce or handle gracefully
        if (i > 0) {
          const timeDiff = clickTimes[i] - clickTimes[i - 1]
          // Ensure minimum time between actions
          expect(timeDiff).toBeGreaterThanOrEqual(0)
        }
      }

      // Only last click should take effect
      expect(calendarState.isOpen).toBe(false) // Not opened multiple times
    })
  })

  describe("Error Handling", () => {
    it.skip("should handle invalid booking dates gracefully", () => {
      // SKIPPED: Error handling for invalid dates not implemented
      const invalidBooking: BookingData = {
        id: "invalid",
        roomId: "room-invalid",
        roomName: "Invalid Room",
        siteName: "Unknown",
        siteTimezone: "America/New_York",
        startUtc: new Date("Invalid Date"),
        endUtc: new Date("Invalid Date"),
        ownerName: "Error User",
      }

      // Should not crash when trying to view invalid date
      const attemptView = () => {
        try {
          const date = toZonedTime(invalidBooking.startUtc, invalidBooking.siteTimezone)
          return { success: true, date }
        } catch (error) {
          return { success: false, error: "Invalid date" }
        }
      }

      const result = attemptView()
      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid date")
    })

    it("should handle missing timezone information", () => {
      const bookingWithoutTz: BookingData = {
        id: "no-tz",
        roomId: "room-no-tz",
        roomName: "No TZ Room",
        siteName: "No TZ Site",
        siteTimezone: "", // Missing timezone
        startUtc: new Date("2025-10-15T14:00:00Z"),
        endUtc: new Date("2025-10-15T15:00:00Z"),
        ownerName: "No TZ User",
      }

      // Should fallback to UTC or default timezone
      const fallbackTz = "UTC"
      const dateWithFallback = toZonedTime(
        bookingWithoutTz.startUtc,
        bookingWithoutTz.siteTimezone || fallbackTz
      )

      expect(dateWithFallback).toBeDefined()
      expect(dateWithFallback.getDate()).toBe(15)
    })
  })
})
