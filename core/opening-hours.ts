/**
 * Opening hours validation and utilities
 */

import {
  getDayInTimezone,
  getWeekdayInTimezone,
  parseTimeString,
  combineDateAndTime,
  utcToLocal,
  enumerateSlots,
  isSameDayInTimezone,
  SLOT_DURATION_MINUTES,
} from "./time"
import { addMinutes, isAfter, isBefore, isEqual } from "date-fns"

/**
 * Opening hours for a single day
 */
export interface DayHours {
  open: string // HH:mm format
  close: string // HH:mm format
}

/**
 * Opening hours for all weekdays
 */
export interface OpeningHours {
  mon?: DayHours
  tue?: DayHours
  wed?: DayHours
  thu?: DayHours
  fri?: DayHours
  sat?: DayHours
  sun?: DayHours
}

/**
 * Check if a time range falls within opening hours
 * @param startUtc - Start time in UTC
 * @param endUtc - End time in UTC
 * @param openingHours - Opening hours configuration
 * @param timezone - IANA timezone identifier
 * @returns True if entire range is within opening hours
 */
export function isWithinOpeningHours(
  startUtc: Date,
  endUtc: Date,
  openingHours: OpeningHours,
  timezone: string
): boolean {
  // Check each slot in the range
  const slots = enumerateSlots(startUtc, endUtc)

  for (const slotStart of slots) {
    if (!isSlotWithinOpeningHours(slotStart, openingHours, timezone)) {
      return false
    }
  }

  return true
}

/**
 * Check if a single slot is within opening hours
 * @param slotStartUtc - Slot start time in UTC
 * @param openingHours - Opening hours configuration
 * @param timezone - IANA timezone identifier
 * @returns True if slot is within opening hours
 */
export function isSlotWithinOpeningHours(
  slotStartUtc: Date,
  openingHours: OpeningHours,
  timezone: string
): boolean {
  const weekday = getWeekdayInTimezone(slotStartUtc, timezone)
  const dayHours = openingHours[weekday as keyof OpeningHours]

  // If no hours defined for this day, it's closed
  if (!dayHours) return false

  // Get the slot end time
  const slotEndUtc = addMinutes(slotStartUtc, SLOT_DURATION_MINUTES)

  // Convert slot times to local
  const slotStartLocal = utcToLocal(slotStartUtc, timezone)
  const slotEndLocal = utcToLocal(slotEndUtc, timezone)

  // Create opening/closing times for comparison
  const openTime = combineDateAndTime(slotStartUtc, dayHours.open, timezone)
  const closeTime = combineDateAndTime(slotStartUtc, dayHours.close, timezone)

  // Convert to local for comparison
  const openLocal = utcToLocal(openTime, timezone)
  const closeLocal = utcToLocal(closeTime, timezone)

  // Check if slot is within hours
  // Slot start must be at or after open time
  // Slot end must be at or before close time
  return (
    (isAfter(slotStartLocal, openLocal) || isEqual(slotStartLocal, openLocal)) &&
    (isBefore(slotEndLocal, closeLocal) || isEqual(slotEndLocal, closeLocal))
  )
}

/**
 * Get available slots for a day based on opening hours
 * @param date - Date to check (in UTC)
 * @param openingHours - Opening hours configuration
 * @param timezone - IANA timezone identifier
 * @returns Array of available slot start times in UTC
 */
export function getAvailableSlotsForDay(
  date: Date,
  openingHours: OpeningHours,
  timezone: string
): Date[] {
  const weekday = getWeekdayInTimezone(date, timezone)
  const dayHours = openingHours[weekday as keyof OpeningHours]

  // If no hours defined for this day, no slots available
  if (!dayHours) return []

  // Get opening and closing times in UTC
  const openTime = combineDateAndTime(date, dayHours.open, timezone)
  const closeTime = combineDateAndTime(date, dayHours.close, timezone)

  // Generate all slots between open and close
  return enumerateSlots(openTime, closeTime)
}

/**
 * Validate opening hours format
 * @param hours - Opening hours to validate
 * @returns True if valid
 */
export function validateOpeningHours(hours: unknown): hours is OpeningHours {
  if (typeof hours !== "object" || hours === null) return false

  const validDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
  const hoursObj = hours as Record<string, unknown>

  for (const [day, dayHours] of Object.entries(hoursObj)) {
    if (!validDays.includes(day)) return false

    if (typeof dayHours !== "object" || dayHours === null) return false

    const dayHoursObj = dayHours as Record<string, unknown>

    if (typeof dayHoursObj.open !== "string" || typeof dayHoursObj.close !== "string") {
      return false
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/
    if (!timeRegex.test(dayHoursObj.open) || !timeRegex.test(dayHoursObj.close)) {
      return false
    }

    // Validate that close time is after open time
    const openParts = parseTimeString(dayHoursObj.open)
    const closeParts = parseTimeString(dayHoursObj.close)

    const openMinutes = openParts.hours * 60 + openParts.minutes
    const closeMinutes = closeParts.hours * 60 + closeParts.minutes

    if (closeMinutes <= openMinutes) return false
  }

  return true
}

/**
 * Get the next available slot after a given time
 * @param afterTime - Time to search after (in UTC)
 * @param openingHours - Opening hours configuration
 * @param timezone - IANA timezone identifier
 * @param maxDaysAhead - Maximum days to search ahead
 * @returns Next available slot start time or null
 */
export function getNextAvailableSlot(
  afterTime: Date,
  openingHours: OpeningHours,
  timezone: string,
  maxDaysAhead: number = 30
): Date | null {
  let currentDate = new Date(afterTime)

  for (let i = 0; i < maxDaysAhead; i++) {
    const slots = getAvailableSlotsForDay(currentDate, openingHours, timezone)

    for (const slot of slots) {
      if (isAfter(slot, afterTime)) {
        return slot
      }
    }

    // Move to next day
    currentDate = new Date(currentDate)
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return null
}

/**
 * Create default opening hours (8am - 8pm every day)
 * @returns Default opening hours configuration
 */
export function createDefaultOpeningHours(): OpeningHours {
  const defaultHours: DayHours = { open: "08:00", close: "20:00" }

  return {
    mon: defaultHours,
    tue: defaultHours,
    wed: defaultHours,
    thu: defaultHours,
    fri: defaultHours,
    sat: defaultHours,
    sun: defaultHours,
  }
}

/**
 * Check if a room is currently open
 * @param now - Current time (defaults to now)
 * @param openingHours - Opening hours configuration
 * @param timezone - IANA timezone identifier
 * @returns True if currently open
 */
export function isCurrentlyOpen(
  openingHours: OpeningHours,
  timezone: string,
  now: Date = new Date()
): boolean {
  const weekday = getWeekdayInTimezone(now, timezone)
  const dayHours = openingHours[weekday as keyof OpeningHours]

  if (!dayHours) return false

  const nowLocal = utcToLocal(now, timezone)
  const openTime = combineDateAndTime(now, dayHours.open, timezone)
  const closeTime = combineDateAndTime(now, dayHours.close, timezone)

  const openLocal = utcToLocal(openTime, timezone)
  const closeLocal = utcToLocal(closeTime, timezone)

  return (
    (isAfter(nowLocal, openLocal) || isEqual(nowLocal, openLocal)) && isBefore(nowLocal, closeLocal)
  )
}
