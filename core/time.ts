/**
 * Core time utilities for NookBook
 * All functions work with UTC dates and timezone conversions
 */

import { addMinutes, startOfDay, differenceInMinutes, format, parse } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Duration of each booking slot in minutes
 */
export const SLOT_DURATION_MINUTES = 30 as const;

/**
 * Snap a date to the nearest 30-minute boundary
 * @param date - The date to snap
 * @param direction - 'floor' rounds down, 'ceil' rounds up, 'round' rounds to nearest
 * @returns Date snapped to 30-minute boundary
 */
export function snapTo30(date: Date, direction: 'floor' | 'ceil' | 'round' = 'floor'): Date {
  const minutes = date.getMinutes();
  const remainder = minutes % SLOT_DURATION_MINUTES;

  if (remainder === 0) return date;

  const baseDate = new Date(date);

  switch (direction) {
    case 'floor':
      baseDate.setMinutes(minutes - remainder, 0, 0);
      break;
    case 'ceil':
      baseDate.setMinutes(minutes + (SLOT_DURATION_MINUTES - remainder), 0, 0);
      break;
    case 'round':
      if (remainder <= SLOT_DURATION_MINUTES / 2) {
        baseDate.setMinutes(minutes - remainder, 0, 0);
      } else {
        baseDate.setMinutes(minutes + (SLOT_DURATION_MINUTES - remainder), 0, 0);
      }
      break;
  }

  return baseDate;
}

/**
 * Convert a local time string to UTC date
 * @param localTimeStr - Time string in format "YYYY-MM-DDTHH:mm" or "HH:mm"
 * @param timezone - IANA timezone identifier
 * @param referenceDate - Reference date for time-only strings
 * @returns UTC Date
 */
export function localToUtc(
  localTimeStr: string,
  timezone: string,
  referenceDate?: Date
): Date {
  // Handle full datetime strings
  if (localTimeStr.includes('T')) {
    const localDate = new Date(localTimeStr);
    return fromZonedTime(localDate, timezone);
  }

  // Handle time-only strings (HH:mm)
  const refDate = referenceDate || new Date();
  const zonedRef = toZonedTime(refDate, timezone);
  const [hours, minutes] = localTimeStr.split(':').map(Number);

  zonedRef.setHours(hours, minutes, 0, 0);
  return fromZonedTime(zonedRef, timezone);
}

/**
 * Convert UTC date to local time
 * @param utcDate - UTC date
 * @param timezone - IANA timezone identifier
 * @returns Date in specified timezone
 */
export function utcToLocal(utcDate: Date, timezone: string): Date {
  return toZonedTime(utcDate, timezone);
}

/**
 * Format a UTC date as local time string
 * @param utcDate - UTC date
 * @param timezone - IANA timezone identifier
 * @param formatStr - date-fns format string
 * @returns Formatted string in local timezone
 */
export function formatInTimezone(
  utcDate: Date,
  timezone: string,
  formatStr: string = 'yyyy-MM-dd HH:mm'
): string {
  const zonedDate = toZonedTime(utcDate, timezone);
  return format(zonedDate, formatStr);
}

/**
 * Enumerate all 30-minute slot start times between two dates
 * @param startUtc - Start date in UTC
 * @param endUtc - End date in UTC (exclusive)
 * @returns Array of UTC dates representing slot starts
 */
export function enumerateSlots(startUtc: Date, endUtc: Date): Date[] {
  const slots: Date[] = [];
  let current = new Date(startUtc);

  while (current < endUtc) {
    slots.push(new Date(current));
    current = addMinutes(current, SLOT_DURATION_MINUTES);
  }

  return slots;
}

/**
 * Get the day of week for a date in a specific timezone
 * @param utcDate - UTC date
 * @param timezone - IANA timezone identifier
 * @returns Day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayInTimezone(utcDate: Date, timezone: string): number {
  // Format the date in the target timezone to get the actual day
  const dateStr = formatInTimezone(utcDate, timezone, 'yyyy-MM-dd');
  // Parse it back as a date to get the day of week
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  return localDate.getDay();
}

/**
 * Get the weekday name for a date in a specific timezone
 * @param utcDate - UTC date
 * @param timezone - IANA timezone identifier
 * @returns Weekday name in lowercase (mon, tue, wed, thu, fri, sat, sun)
 */
export function getWeekdayInTimezone(utcDate: Date, timezone: string): string {
  const day = getDayInTimezone(utcDate, timezone);
  const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return weekdays[day];
}

/**
 * Check if two dates are on the same day in a specific timezone
 * @param date1 - First UTC date
 * @param date2 - Second UTC date
 * @param timezone - IANA timezone identifier
 * @returns True if dates are on the same day
 */
export function isSameDayInTimezone(
  date1: Date,
  date2: Date,
  timezone: string
): boolean {
  // Format both dates in the target timezone to compare the actual date strings
  const date1Str = formatInTimezone(date1, timezone, 'yyyy-MM-dd');
  const date2Str = formatInTimezone(date2, timezone, 'yyyy-MM-dd');
  return date1Str === date2Str;
}

/**
 * Get start of day in a specific timezone
 * @param date - UTC date
 * @param timezone - IANA timezone identifier
 * @returns UTC date representing start of day in timezone
 */
export function getStartOfDayInTimezone(date: Date, timezone: string): Date {
  const localDate = toZonedTime(date, timezone);
  const startLocal = startOfDay(localDate);
  return fromZonedTime(startLocal, timezone);
}

/**
 * Parse a time string (HH:mm) into hours and minutes
 * @param timeStr - Time string in format "HH:mm"
 * @returns Object with hours and minutes
 */
export function parseTimeString(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Combine a date with a time string in a specific timezone
 * @param date - Base date
 * @param timeStr - Time string in format "HH:mm"
 * @param timezone - IANA timezone identifier
 * @returns UTC date with the specified time
 */
export function combineDateAndTime(
  date: Date,
  timeStr: string,
  timezone: string
): Date {
  const localDate = toZonedTime(date, timezone);
  const { hours, minutes } = parseTimeString(timeStr);

  localDate.setHours(hours, minutes, 0, 0);
  return fromZonedTime(localDate, timezone);
}