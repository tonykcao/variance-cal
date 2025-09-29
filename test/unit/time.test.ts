/**
 * Tests for core time utilities
 */

import { describe, it, expect } from "vitest"
import {
  snapTo30,
  localToUtc,
  utcToLocal,
  formatInTimezone,
  enumerateSlots,
  getDayInTimezone,
  getWeekdayInTimezone,
  isSameDayInTimezone,
  getStartOfDayInTimezone,
  parseTimeString,
  combineDateAndTime,
  SLOT_DURATION_MINUTES,
} from "@/core/time"

describe("Time Utilities", () => {
  describe("snapTo30", () => {
    it("should snap to 30-minute boundaries with floor", () => {
      const date1 = new Date("2025-09-24T10:15:00Z")
      const date2 = new Date("2025-09-24T10:45:00Z")
      const date3 = new Date("2025-09-24T10:30:00Z")

      expect(snapTo30(date1, "floor")).toEqual(new Date("2025-09-24T10:00:00Z"))
      expect(snapTo30(date2, "floor")).toEqual(new Date("2025-09-24T10:30:00Z"))
      expect(snapTo30(date3, "floor")).toEqual(new Date("2025-09-24T10:30:00Z"))
    })

    it("should snap to 30-minute boundaries with ceil", () => {
      const date1 = new Date("2025-09-24T10:15:00Z")
      const date2 = new Date("2025-09-24T10:45:00Z")
      const date3 = new Date("2025-09-24T10:30:00Z")

      expect(snapTo30(date1, "ceil")).toEqual(new Date("2025-09-24T10:30:00Z"))
      expect(snapTo30(date2, "ceil")).toEqual(new Date("2025-09-24T11:00:00Z"))
      expect(snapTo30(date3, "ceil")).toEqual(new Date("2025-09-24T10:30:00Z"))
    })

    it("should snap to 30-minute boundaries with round", () => {
      const date1 = new Date("2025-09-24T10:10:00Z") // Closer to 10:00
      const date2 = new Date("2025-09-24T10:20:00Z") // Closer to 10:30
      const date3 = new Date("2025-09-24T10:15:00Z") // Exactly in middle, rounds down

      expect(snapTo30(date1, "round")).toEqual(new Date("2025-09-24T10:00:00Z"))
      expect(snapTo30(date2, "round")).toEqual(new Date("2025-09-24T10:30:00Z"))
      expect(snapTo30(date3, "round")).toEqual(new Date("2025-09-24T10:00:00Z"))
    })

    it("should not modify dates already on boundaries", () => {
      const date = new Date("2025-09-24T10:00:00Z")
      expect(snapTo30(date)).toEqual(date)
    })
  })

  describe("localToUtc", () => {
    it("should convert local datetime string to UTC", () => {
      // 10:00 AM in New York (EST) should be 15:00 UTC in September
      const localTime = "2025-09-24T10:00"
      const utc = localToUtc(localTime, "America/New_York")

      // New York is UTC-4 in September (EDT)
      expect(utc.toISOString()).toBe("2025-09-24T14:00:00.000Z")
    })

    it("should handle time-only strings with reference date", () => {
      const referenceDate = new Date("2025-09-24T12:00:00Z")
      const utc = localToUtc("10:00", "America/New_York", referenceDate)

      // Should use reference date and convert 10:00 NY time to UTC
      expect(utc.getUTCHours()).toBe(14) // 10:00 EDT = 14:00 UTC
    })

    it("should work with different timezones", () => {
      const localTime = "2025-09-24T12:00"

      const utcFromLA = localToUtc(localTime, "America/Los_Angeles")
      const utcFromLondon = localToUtc(localTime, "Europe/London")
      const utcFromShanghai = localToUtc(localTime, "Asia/Shanghai")

      // LA is UTC-7 in September (PDT)
      expect(utcFromLA.toISOString()).toBe("2025-09-24T19:00:00.000Z")
      // London is UTC+1 in September (BST)
      expect(utcFromLondon.toISOString()).toBe("2025-09-24T11:00:00.000Z")
      // Shanghai is UTC+8 always
      expect(utcFromShanghai.toISOString()).toBe("2025-09-24T04:00:00.000Z")
    })
  })

  describe("utcToLocal", () => {
    it("should convert UTC to local timezone", () => {
      const utc = new Date("2025-09-24T14:00:00Z")
      const localNY = utcToLocal(utc, "America/New_York")

      expect(localNY.getHours()).toBe(10) // 14:00 UTC = 10:00 EDT
    })
  })

  describe("formatInTimezone", () => {
    it("should format UTC date in specified timezone", () => {
      const utc = new Date("2025-09-24T14:00:00Z")

      const formattedNY = formatInTimezone(utc, "America/New_York", "yyyy-MM-dd HH:mm")
      const formattedLA = formatInTimezone(utc, "America/Los_Angeles", "yyyy-MM-dd HH:mm")

      expect(formattedNY).toBe("2025-09-24 10:00")
      expect(formattedLA).toBe("2025-09-24 07:00")
    })

    it("should use default format if not specified", () => {
      const utc = new Date("2025-09-24T14:00:00Z")
      const formatted = formatInTimezone(utc, "America/New_York")

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })
  })

  describe("enumerateSlots", () => {
    it("should enumerate 30-minute slots between dates", () => {
      const start = new Date("2025-09-24T10:00:00Z")
      const end = new Date("2025-09-24T12:00:00Z")

      const slots = enumerateSlots(start, end)

      expect(slots).toHaveLength(4) // 10:00, 10:30, 11:00, 11:30
      expect(slots[0]).toEqual(new Date("2025-09-24T10:00:00Z"))
      expect(slots[1]).toEqual(new Date("2025-09-24T10:30:00Z"))
      expect(slots[2]).toEqual(new Date("2025-09-24T11:00:00Z"))
      expect(slots[3]).toEqual(new Date("2025-09-24T11:30:00Z"))
    })

    it("should handle single slot", () => {
      const start = new Date("2025-09-24T10:00:00Z")
      const end = new Date("2025-09-24T10:30:00Z")

      const slots = enumerateSlots(start, end)

      expect(slots).toHaveLength(1)
      expect(slots[0]).toEqual(start)
    })

    it("should return empty array for invalid range", () => {
      const start = new Date("2025-09-24T12:00:00Z")
      const end = new Date("2025-09-24T10:00:00Z")

      const slots = enumerateSlots(start, end)

      expect(slots).toHaveLength(0)
    })
  })

  describe("getDayInTimezone", () => {
    it("should get correct day of week in timezone", () => {
      // 2025-09-24 is a Wednesday at 02:00 UTC
      const utc = new Date("2025-09-24T02:00:00Z") // 2 AM UTC on Wednesday

      // In New York (22:00 Tuesday night)
      expect(getDayInTimezone(utc, "America/New_York")).toBe(2) // Tuesday

      // In Shanghai (10:00 Wednesday morning)
      expect(getDayInTimezone(utc, "Asia/Shanghai")).toBe(3) // Wednesday
    })
  })

  describe("getWeekdayInTimezone", () => {
    it("should return correct weekday name", () => {
      const utc = new Date("2025-09-24T12:00:00Z") // Wednesday at 12:00 UTC

      expect(getWeekdayInTimezone(utc, "America/New_York")).toBe("wed")
      expect(getWeekdayInTimezone(utc, "Europe/London")).toBe("wed")
    })

    it("should handle timezone day differences", () => {
      // Tuesday 20:00 UTC that crosses into Wednesday in Shanghai
      const utc = new Date("2025-09-23T20:00:00Z") // Tuesday 20:00 UTC

      expect(getWeekdayInTimezone(utc, "America/New_York")).toBe("tue") // Still Tuesday in NY
      expect(getWeekdayInTimezone(utc, "Asia/Shanghai")).toBe("wed") // Wednesday in Shanghai (+8 hours)
    })
  })

  describe("isSameDayInTimezone", () => {
    it("should correctly compare dates in same timezone", () => {
      const date1 = new Date("2025-09-24T10:00:00Z")
      const date2 = new Date("2025-09-24T20:00:00Z")
      const date3 = new Date("2025-09-25T10:00:00Z")

      expect(isSameDayInTimezone(date1, date2, "America/New_York")).toBe(true)
      expect(isSameDayInTimezone(date1, date3, "America/New_York")).toBe(false)
    })

    it("should handle timezone boundaries", () => {
      // 11 PM UTC on the 24th
      const date1 = new Date("2025-09-24T23:00:00Z")
      // 1 AM UTC on the 25th
      const date2 = new Date("2025-09-25T01:00:00Z")

      // In LA (PDT, UTC-7), these are both on the 24th
      expect(isSameDayInTimezone(date1, date2, "America/Los_Angeles")).toBe(true)

      // In Shanghai (UTC+8), both dates are on the 25th
      // 24th 23:00 UTC = 25th 07:00 Shanghai
      // 25th 01:00 UTC = 25th 09:00 Shanghai
      expect(isSameDayInTimezone(date1, date2, "Asia/Shanghai")).toBe(true)
    })
  })

  describe("getStartOfDayInTimezone", () => {
    it("should return start of day in UTC for timezone", () => {
      const date = new Date("2025-09-24T15:00:00Z")

      // Start of day in New York (00:00 EDT = 04:00 UTC)
      const startNY = getStartOfDayInTimezone(date, "America/New_York")
      expect(startNY.toISOString()).toBe("2025-09-24T04:00:00.000Z")

      // Start of day in Shanghai (00:00 CST = 16:00 UTC previous day)
      const startSH = getStartOfDayInTimezone(date, "Asia/Shanghai")
      expect(startSH.toISOString()).toBe("2025-09-23T16:00:00.000Z")
    })
  })

  describe("parseTimeString", () => {
    it("should parse time string correctly", () => {
      expect(parseTimeString("09:30")).toEqual({ hours: 9, minutes: 30 })
      expect(parseTimeString("23:59")).toEqual({ hours: 23, minutes: 59 })
      expect(parseTimeString("00:00")).toEqual({ hours: 0, minutes: 0 })
    })
  })

  describe("combineDateAndTime", () => {
    it("should combine date with time in timezone", () => {
      const date = new Date("2025-09-24T12:00:00Z")

      // Set to 10:00 in New York
      const combined = combineDateAndTime(date, "10:00", "America/New_York")

      // 10:00 EDT = 14:00 UTC
      expect(combined.getUTCHours()).toBe(14)
    })

    it("should work across different timezones", () => {
      const date = new Date("2025-09-24T00:00:00Z")

      const combinedLA = combineDateAndTime(date, "09:00", "America/Los_Angeles")
      const combinedSH = combineDateAndTime(date, "09:00", "Asia/Shanghai")

      // 09:00 PDT = 16:00 UTC
      expect(combinedLA.getUTCHours()).toBe(16)
      // 09:00 CST = 01:00 UTC
      expect(combinedSH.getUTCHours()).toBe(1)
    })
  })

  describe("Constants", () => {
    it("should have correct slot duration", () => {
      expect(SLOT_DURATION_MINUTES).toBe(30)
    })
  })
})
