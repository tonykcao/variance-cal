/**
 * Slot enumeration and availability logic
 */

import {
  enumerateSlots,
  snapTo30,
  formatInTimezone,
  utcToLocal,
  isSameDayInTimezone,
  getStartOfDayInTimezone,
  SLOT_DURATION_MINUTES,
} from './time';
import {
  isSlotWithinOpeningHours,
  getAvailableSlotsForDay,
  OpeningHours,
} from './opening-hours';
import { addDays, addMinutes, isBefore, isAfter, isEqual, startOfDay, endOfDay } from 'date-fns';

/**
 * Slot availability status
 */
export interface SlotAvailability {
  startUtc: Date;
  endUtc: Date;
  available: boolean;
  reason?: 'outside-hours' | 'booked' | 'past';
  isOwnBooking?: boolean;
  isAttending?: boolean;
}

/**
 * Room availability for a date range
 */
export interface RoomAvailability {
  roomId: string;
  roomName: string;
  siteId: string;
  siteName: string;
  timezone: string;
  capacity: number;
  dates: DateAvailability[];
}

/**
 * Availability for a specific date
 */
export interface DateAvailability {
  date: string; // YYYY-MM-DD in room timezone
  slots: SlotAvailability[];
}

/**
 * Filter options for availability search
 */
export interface AvailabilityFilter {
  sites?: string[];
  capacityMin?: number;
  startDate: Date;
  endDate?: Date;
  timeWindow?: {
    startTime: string; // HH:mm
    endTime: string; // HH:mm
  };
}

/**
 * Generate slots for a room within a date range
 * @param startDate - Start date (in UTC)
 * @param endDate - End date (in UTC)
 * @param openingHours - Room opening hours
 * @param timezone - Room timezone
 * @param bookedSlots - Map of booked slot start times to booking info
 * @returns Array of slot availability
 */
export function generateRoomSlots(
  startDate: Date,
  endDate: Date,
  openingHours: OpeningHours,
  timezone: string,
  bookedSlots: Map<string, { isOwnBooking?: boolean; isAttending?: boolean }>
): DateAvailability[] {
  const result: DateAvailability[] = [];
  const now = new Date();

  // Iterate through each day
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayStart = getStartOfDayInTimezone(currentDate, timezone);
    const dayEnd = addDays(dayStart, 1);

    // Get available slots for this day based on opening hours
    const availableSlots = getAvailableSlotsForDay(currentDate, openingHours, timezone);

    const daySlots: SlotAvailability[] = [];

    // Check each potential slot in the day
    const allDaySlots = enumerateSlots(dayStart, dayEnd);

    for (const slotStart of allDaySlots) {
      const slotEnd = addMinutes(slotStart, SLOT_DURATION_MINUTES);
      const slotKey = slotStart.toISOString();

      let available = false;
      let reason: SlotAvailability['reason'] = undefined;
      let isOwnBooking: boolean | undefined = undefined;
      let isAttending: boolean | undefined = undefined;

      // Check if slot is in the past
      if (isBefore(slotStart, now)) {
        available = false;
        reason = 'past';
      }
      // Check if slot is within opening hours
      else if (!availableSlots.some(s => isEqual(s, slotStart))) {
        available = false;
        reason = 'outside-hours';
      }
      // Check if slot is booked
      else if (bookedSlots.has(slotKey)) {
        available = false;
        reason = 'booked';
        const bookingInfo = bookedSlots.get(slotKey);
        isOwnBooking = bookingInfo?.isOwnBooking;
        isAttending = bookingInfo?.isAttending;
      } else {
        available = true;
      }

      daySlots.push({
        startUtc: slotStart,
        endUtc: slotEnd,
        available,
        reason,
        isOwnBooking,
        isAttending,
      });
    }

    // Format date in room timezone
    const dateStr = formatInTimezone(currentDate, timezone, 'yyyy-MM-dd');

    result.push({
      date: dateStr,
      slots: daySlots,
    });

    currentDate = addDays(currentDate, 1);
  }

  return result;
}

/**
 * Apply time window filter to slots
 * @param slots - Slots to filter
 * @param startTime - Start time (HH:mm)
 * @param endTime - End time (HH:mm)
 * @param timezone - Timezone for time comparison
 * @returns Filtered slots
 */
export function applyTimeWindowFilter(
  slots: SlotAvailability[],
  startTime: string,
  endTime: string,
  timezone: string
): SlotAvailability[] {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  return slots.filter(slot => {
    const localTime = utcToLocal(slot.startUtc, timezone);
    const slotHour = localTime.getHours();
    const slotMin = localTime.getMinutes();
    const slotTotalMinutes = slotHour * 60 + slotMin;

    const windowStartMinutes = startHour * 60 + startMin;
    const windowEndMinutes = endHour * 60 + endMin;

    return slotTotalMinutes >= windowStartMinutes && slotTotalMinutes < windowEndMinutes;
  });
}

/**
 * Create a slot availability bitmap (for compact representation)
 * @param slots - Array of slot availability
 * @returns Boolean array where true = available
 */
export function createSlotBitmap(slots: SlotAvailability[]): boolean[] {
  return slots.map(slot => slot.available);
}

/**
 * Find contiguous available slots
 * @param slots - Array of slot availability
 * @param minDuration - Minimum duration in minutes
 * @returns Array of contiguous slot ranges
 */
export function findContiguousSlots(
  slots: SlotAvailability[],
  minDuration: number = SLOT_DURATION_MINUTES
): { start: Date; end: Date; durationMinutes: number }[] {
  const ranges: { start: Date; end: Date; durationMinutes: number }[] = [];
  let currentRange: { start: Date; end: Date } | null = null;

  for (const slot of slots) {
    if (slot.available) {
      if (!currentRange) {
        currentRange = { start: slot.startUtc, end: slot.endUtc };
      } else {
        // Check if this slot is contiguous with the current range
        if (isEqual(currentRange.end, slot.startUtc)) {
          currentRange.end = slot.endUtc;
        } else {
          // Gap found, save current range if it meets minimum duration
          const durationMinutes = (currentRange.end.getTime() - currentRange.start.getTime()) / 60000;
          if (durationMinutes >= minDuration) {
            ranges.push({
              start: currentRange.start,
              end: currentRange.end,
              durationMinutes,
            });
          }
          currentRange = { start: slot.startUtc, end: slot.endUtc };
        }
      }
    } else {
      // Not available, save current range if exists and meets minimum
      if (currentRange) {
        const durationMinutes = (currentRange.end.getTime() - currentRange.start.getTime()) / 60000;
        if (durationMinutes >= minDuration) {
          ranges.push({
            start: currentRange.start,
            end: currentRange.end,
            durationMinutes,
          });
        }
        currentRange = null;
      }
    }
  }

  // Handle any remaining range
  if (currentRange) {
    const durationMinutes = (currentRange.end.getTime() - currentRange.start.getTime()) / 60000;
    if (durationMinutes >= minDuration) {
      ranges.push({
        start: currentRange.start,
        end: currentRange.end,
        durationMinutes,
      });
    }
  }

  return ranges;
}

/**
 * Check if a specific time range is available
 * @param startUtc - Start time in UTC
 * @param endUtc - End time in UTC
 * @param slots - Available slots
 * @returns True if entire range is available
 */
export function isRangeAvailable(
  startUtc: Date,
  endUtc: Date,
  slots: SlotAvailability[]
): boolean {
  // Snap times to slot boundaries
  const rangeStart = snapTo30(startUtc, 'floor');
  const rangeEnd = snapTo30(endUtc, 'ceil');

  // Generate required slots for the range
  const requiredSlots = enumerateSlots(rangeStart, rangeEnd);

  // Check if all required slots are available
  for (const required of requiredSlots) {
    const slot = slots.find(s => isEqual(s.startUtc, required));
    if (!slot || !slot.available) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate room utilization for a date range
 * @param slots - Array of slot availability
 * @returns Utilization percentage (0-100)
 */
export function calculateUtilization(slots: SlotAvailability[]): number {
  if (slots.length === 0) return 0;

  const totalSlots = slots.length;
  const bookedSlots = slots.filter(s => s.reason === 'booked').length;

  return Math.round((bookedSlots / totalSlots) * 100);
}

/**
 * Get the next available time after a given time
 * @param afterTime - Time to search after
 * @param slots - Array of slot availability
 * @returns Next available slot or null
 */
export function getNextAvailableTime(
  afterTime: Date,
  slots: SlotAvailability[]
): Date | null {
  for (const slot of slots) {
    if (slot.available && isAfter(slot.startUtc, afterTime)) {
      return slot.startUtc;
    }
  }
  return null;
}

/**
 * Format slot time for display
 * @param slot - Slot to format
 * @param timezone - Timezone for display
 * @param includeDate - Whether to include date in format
 * @returns Formatted time string
 */
export function formatSlotTime(
  slot: SlotAvailability,
  timezone: string,
  includeDate: boolean = false
): string {
  const format = includeDate ? 'MMM d, HH:mm' : 'HH:mm';
  const start = formatInTimezone(slot.startUtc, timezone, format);
  const end = formatInTimezone(slot.endUtc, timezone, 'HH:mm');
  return `${start} - ${end}`;
}