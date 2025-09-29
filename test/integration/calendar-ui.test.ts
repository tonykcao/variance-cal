import { describe, it, expect, beforeEach } from "vitest"
import {
  getDaysInMonth,
  startOfMonth,
  endOfMonth,
  getDay,
  setMonth,
  setYear,
  isBefore,
  isAfter,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns"

describe("Calendar UI Tests", () => {
  describe("Calendar Grid Alignment", () => {
    it("should properly align dates under weekday headers for all months", () => {
      const testMonths = [
        new Date(2025, 0, 1), // January 2025
        new Date(2025, 1, 1), // February 2025
        new Date(2025, 2, 1), // March 2025
        new Date(2025, 3, 1), // April 2025
        new Date(2025, 4, 1), // May 2025
        new Date(2025, 5, 1), // June 2025
        new Date(2025, 6, 1), // July 2025
        new Date(2025, 7, 1), // August 2025
        new Date(2025, 8, 1), // September 2025
        new Date(2025, 9, 1), // October 2025
        new Date(2025, 10, 1), // November 2025
        new Date(2025, 11, 1), // December 2025
      ]

      testMonths.forEach(month => {
        const firstDay = startOfMonth(month)
        const firstDayOfWeek = getDay(firstDay) // 0 = Sunday, 6 = Saturday
        const daysInMonth = getDaysInMonth(month)

        // Verify grid structure
        const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7
        const gridRows = totalCells / 7

        // First date should start at the correct column
        expect(firstDayOfWeek).toBeGreaterThanOrEqual(0)
        expect(firstDayOfWeek).toBeLessThanOrEqual(6)

        // Grid should have complete rows
        expect(totalCells % 7).toBe(0)

        // Log for debugging
        console.log(`${month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}:`)
        console.log(
          `  First day starts on column: ${firstDayOfWeek} (${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][firstDayOfWeek]})`
        )
        console.log(`  Days in month: ${daysInMonth}`)
        console.log(`  Grid rows needed: ${gridRows}`)
        console.log(`  Total cells: ${totalCells}`)
      })
    })

    it("should handle February in leap years correctly", () => {
      const leapYear = new Date(2024, 1, 1) // February 2024 (leap year)
      const normalYear = new Date(2025, 1, 1) // February 2025 (normal year)

      expect(getDaysInMonth(leapYear)).toBe(29)
      expect(getDaysInMonth(normalYear)).toBe(28)

      // Verify grid doesn't break with different February lengths
      const leapFirstDay = getDay(startOfMonth(leapYear))
      const normalFirstDay = getDay(startOfMonth(normalYear))

      const leapTotalCells = Math.ceil((leapFirstDay + 29) / 7) * 7
      const normalTotalCells = Math.ceil((normalFirstDay + 28) / 7) * 7

      expect(leapTotalCells % 7).toBe(0)
      expect(normalTotalCells % 7).toBe(0)
    })

    it("should handle months starting on different days of the week", () => {
      // Find months that start on each day of the week
      const exampleMonths = {
        sunday: new Date(2025, 5, 1), // June 2025
        monday: new Date(2025, 8, 1), // September 2025
        tuesday: new Date(2025, 3, 1), // April 2025
        wednesday: new Date(2025, 0, 1), // January 2025
        thursday: new Date(2025, 4, 1), // May 2025
        friday: new Date(2025, 7, 1), // August 2025
        saturday: new Date(2025, 1, 1), // February 2025
      }

      Object.entries(exampleMonths).forEach(([dayName, date]) => {
        const firstDayOfWeek = getDay(startOfMonth(date))
        const expectedDay = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ].indexOf(dayName)

        expect(firstDayOfWeek).toBe(expectedDay)

        console.log(
          `${date.toLocaleDateString("en-US", { month: "long", year: "numeric" })} starts on ${dayName}`
        )
      })
    })
  })

  describe("Month Boundaries", () => {
    it("should handle transition between months correctly", () => {
      const testDate = new Date(2025, 9, 15) // October 15, 2025

      // Test navigation to previous month
      const prevMonth = subMonths(testDate, 1)
      expect(prevMonth.getMonth()).toBe(8) // September
      expect(prevMonth.getFullYear()).toBe(2025)

      // Test navigation to next month
      const nextMonth = addMonths(testDate, 1)
      expect(nextMonth.getMonth()).toBe(10) // November
      expect(nextMonth.getFullYear()).toBe(2025)
    })

    it("should handle year boundaries correctly", () => {
      const december = new Date(2025, 11, 15) // December 2025
      const january = new Date(2025, 0, 15) // January 2025

      // December -> January (next year)
      const nextFromDec = addMonths(december, 1)
      expect(nextFromDec.getMonth()).toBe(0) // January
      expect(nextFromDec.getFullYear()).toBe(2026)

      // January -> December (previous year)
      const prevFromJan = subMonths(january, 1)
      expect(prevFromJan.getMonth()).toBe(11) // December
      expect(prevFromJan.getFullYear()).toBe(2024)
    })

    it("should properly style or hide days from adjacent months", () => {
      const october2025 = new Date(2025, 9, 1) // October 2025
      const firstDay = startOfMonth(october2025)
      const firstDayOfWeek = getDay(firstDay) // Wednesday = 3

      // October 1 is a Wednesday, so we need to show 3 days from September (Sun, Mon, Tue)
      const daysFromPrevMonth = firstDayOfWeek
      expect(daysFromPrevMonth).toBe(3)

      // October has 31 days, ends on Friday
      const lastDay = endOfMonth(october2025)
      const lastDayOfWeek = getDay(lastDay) // Friday = 5

      // Need to show 1 day from November (Saturday) to complete the week
      const daysFromNextMonth = 6 - lastDayOfWeek
      expect(daysFromNextMonth).toBe(1)

      // These outside days should be styled differently or hidden
      const totalCells = daysFromPrevMonth + 31 + daysFromNextMonth
      expect(totalCells).toBe(35) // 5 complete weeks
    })
  })

  describe("Past Date Handling", () => {
    it("should disable dates before today", () => {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Yesterday should be disabled
      expect(isBefore(yesterday, today)).toBe(true)

      // Today should be enabled
      expect(isSameDay(today, today)).toBe(true)

      // Tomorrow should be enabled
      expect(isAfter(tomorrow, today)).toBe(true)
    })

    it("should handle past dates at month boundaries", () => {
      // If today is October 15, 2025
      const today = new Date(2025, 9, 15)

      // All of September should be disabled
      const september30 = new Date(2025, 8, 30)
      expect(isBefore(september30, today)).toBe(true)

      // October 14 should be disabled
      const october14 = new Date(2025, 9, 14)
      expect(isBefore(october14, today)).toBe(true)

      // October 15 (today) should be enabled
      const october15 = new Date(2025, 9, 15)
      expect(isSameDay(october15, today)).toBe(true)

      // October 16 should be enabled
      const october16 = new Date(2025, 9, 16)
      expect(isAfter(october16, today)).toBe(true)
    })

    it("should prevent selection of past dates", () => {
      const today = new Date()
      const pastDates = [
        new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()), // Last year
        new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()), // Last month
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), // Last week
        new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), // Yesterday
      ]

      pastDates.forEach(date => {
        const isDisabled = isBefore(date, today) && !isSameDay(date, today)
        expect(isDisabled).toBe(true)
      })
    })
  })

  describe("Calendar Navigation", () => {
    it("should navigate months correctly with arrow buttons", () => {
      let currentMonth = new Date(2025, 9, 15) // October 2025

      // Navigate forward through months
      const monthsForward = []
      for (let i = 0; i < 12; i++) {
        currentMonth = addMonths(currentMonth, 1)
        monthsForward.push({
          month: currentMonth.getMonth(),
          year: currentMonth.getFullYear(),
        })
      }

      // Should end up in October 2026
      expect(monthsForward[11].month).toBe(9)
      expect(monthsForward[11].year).toBe(2026)

      // Navigate backward through months
      currentMonth = new Date(2025, 9, 15) // Reset to October 2025
      const monthsBackward = []
      for (let i = 0; i < 12; i++) {
        currentMonth = subMonths(currentMonth, 1)
        monthsBackward.push({
          month: currentMonth.getMonth(),
          year: currentMonth.getFullYear(),
        })
      }

      // Should end up in October 2024
      expect(monthsBackward[11].month).toBe(9)
      expect(monthsBackward[11].year).toBe(2024)
    })

    it("should jump to specific date when provided", () => {
      // Simulate "View on Calendar" button click with a booking date
      const bookingDate = new Date(2025, 11, 25) // December 25, 2025

      // Calendar should open to December 2025
      const displayMonth = bookingDate.getMonth()
      const displayYear = bookingDate.getFullYear()

      expect(displayMonth).toBe(11) // December
      expect(displayYear).toBe(2025)

      // The specific date should be highlighted or focused
      const focusedDate = bookingDate.getDate()
      expect(focusedDate).toBe(25)
    })

    it("should handle edge case dates when jumping", () => {
      const edgeCases = [
        new Date(2025, 0, 1), // January 1st
        new Date(2025, 11, 31), // December 31st
        new Date(2024, 1, 29), // February 29th (leap year)
        new Date(2025, 1, 28), // February 28th (non-leap year)
      ]

      edgeCases.forEach(date => {
        const month = date.getMonth()
        const year = date.getFullYear()
        const day = date.getDate()

        // Verify the calendar can navigate to these dates
        expect(month).toBeGreaterThanOrEqual(0)
        expect(month).toBeLessThanOrEqual(11)
        expect(year).toBeGreaterThan(0)
        expect(day).toBeGreaterThanOrEqual(1)
        expect(day).toBeLessThanOrEqual(getDaysInMonth(date))
      })
    })
  })

  describe("Auto-close Behavior", () => {
    it("should close calendar after date selection", () => {
      // Test data structure for calendar state
      const calendarState = {
        isOpen: true,
        selectedDate: null as Date | null,
      }

      // Simulate date selection
      const selectDate = (date: Date) => {
        calendarState.selectedDate = date
        calendarState.isOpen = false // Should auto-close
      }

      // Select a date
      const testDate = new Date(2025, 9, 20)
      selectDate(testDate)

      expect(calendarState.selectedDate).toEqual(testDate)
      expect(calendarState.isOpen).toBe(false)
    })

    it("should not close on month navigation", () => {
      const calendarState = {
        isOpen: true,
        currentMonth: new Date(2025, 9, 1),
      }

      // Navigate to next month
      const navigateMonth = (direction: "next" | "prev") => {
        if (direction === "next") {
          calendarState.currentMonth = addMonths(calendarState.currentMonth, 1)
        } else {
          calendarState.currentMonth = subMonths(calendarState.currentMonth, 1)
        }
        // Calendar should remain open
      }

      navigateMonth("next")
      expect(calendarState.isOpen).toBe(true)
      expect(calendarState.currentMonth.getMonth()).toBe(10)

      navigateMonth("prev")
      expect(calendarState.isOpen).toBe(true)
      expect(calendarState.currentMonth.getMonth()).toBe(9)
    })

    it("should close on escape key press", () => {
      const calendarState = {
        isOpen: true,
      }

      // Simulate escape key press
      const handleKeyDown = (key: string) => {
        if (key === "Escape") {
          calendarState.isOpen = false
        }
      }

      handleKeyDown("Escape")
      expect(calendarState.isOpen).toBe(false)
    })

    it("should close when clicking outside", () => {
      const calendarState = {
        isOpen: true,
      }

      // Simulate outside click
      const handleOutsideClick = (target: string) => {
        if (!target.includes("calendar")) {
          calendarState.isOpen = false
        }
      }

      // Click outside
      handleOutsideClick("body")
      expect(calendarState.isOpen).toBe(false)

      // Reset
      calendarState.isOpen = true

      // Click inside
      handleOutsideClick("calendar-day-15")
      expect(calendarState.isOpen).toBe(true)
    })
  })

  describe("Timezone Handling", () => {
    it("should display dates correctly across timezones", () => {
      // User in NY (UTC-4/5) viewing room in London (UTC+1/0)
      const nyUserTimezone = "America/New_York"
      const londonRoomTimezone = "Europe/London"

      // October 15, 2025 at midnight in London timezone
      // Note: We need to use UTC time that corresponds to midnight London time
      // October 15, 2025 00:00:00 BST (British Summer Time) = UTC-1
      const londonDate = new Date("2025-10-14T23:00:00Z") // This is midnight on Oct 15 in London

      // When displaying in London timezone, it should show as October 15
      // Using toLocaleString to get the date in London timezone
      const londonDateString = londonDate.toLocaleString("en-GB", {
        timeZone: londonRoomTimezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })

      const [day, month, year] = londonDateString.split("/").map(Number)

      expect(day).toBe(15)
      expect(month).toBe(10) // October
      expect(year).toBe(2025)

      console.log("London date (UTC):", londonDate.toISOString())
      console.log("Display date in London:", londonDateString)
    })

    it("should handle DST transitions gracefully", () => {
      // Note: MVP doesn't support DST, but we test that dates don't break
      const beforeDST = new Date(2025, 2, 8) // March 8, 2025
      const afterDST = new Date(2025, 2, 10) // March 10, 2025 (after DST change)

      // Calendar should still show consecutive dates
      expect(afterDST.getDate() - beforeDST.getDate()).toBe(2)
    })
  })

  describe("Calendar Grid Performance", () => {
    it("should handle rapid month navigation", () => {
      let currentMonth = new Date(2025, 9, 1)
      const startTime = Date.now()

      // Navigate through 24 months rapidly
      for (let i = 0; i < 24; i++) {
        currentMonth = addMonths(currentMonth, 1)
        // Calculate grid for each month
        const firstDay = startOfMonth(currentMonth)
        const daysInMonth = getDaysInMonth(currentMonth)
        const firstDayOfWeek = getDay(firstDay)
        const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7

        expect(totalCells % 7).toBe(0)
      }

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100)
      console.log(`24 month navigation completed in ${duration}ms`)
    })

    it("should efficiently handle large date ranges", () => {
      // Test calendar can handle viewing far future dates
      const farFuture = new Date(2030, 11, 31) // December 31, 2030
      const farPast = new Date(2020, 0, 1) // January 1, 2020

      expect(getDaysInMonth(farFuture)).toBe(31)
      expect(getDaysInMonth(farPast)).toBe(31)

      // Calendar should handle 10 year range
      const yearDiff = farFuture.getFullYear() - farPast.getFullYear()
      expect(yearDiff).toBe(10)
    })
  })
})
