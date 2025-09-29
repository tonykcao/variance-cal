/**
 * DST (Daylight Saving Time) Test Helpers
 * Utilities for testing timezone transitions and edge cases
 */

import { toZonedTime, fromZonedTime } from "date-fns-tz"

/**
 * Known DST transition dates for testing
 * These are fixed dates to ensure consistent tests
 */
export const DST_TRANSITIONS = {
  "America/New_York": {
    2025: {
      springForward: new Date("2025-03-09T07:00:00Z"), // 2 AM EST -> 3 AM EDT
      fallBack: new Date("2025-11-02T06:00:00Z"), // 2 AM EDT -> 1 AM EST
    },
    2026: {
      springForward: new Date("2026-03-08T07:00:00Z"),
      fallBack: new Date("2026-11-01T06:00:00Z"),
    },
  },
  "America/Los_Angeles": {
    2025: {
      springForward: new Date("2025-03-09T10:00:00Z"), // 2 AM PST -> 3 AM PDT
      fallBack: new Date("2025-11-02T09:00:00Z"), // 2 AM PDT -> 1 AM PST
    },
    2026: {
      springForward: new Date("2026-03-08T10:00:00Z"),
      fallBack: new Date("2026-11-01T09:00:00Z"),
    },
  },
  "Europe/London": {
    2025: {
      springForward: new Date("2025-03-30T01:00:00Z"), // 1 AM GMT -> 2 AM BST
      fallBack: new Date("2025-10-26T01:00:00Z"), // 2 AM BST -> 1 AM GMT
    },
    2026: {
      springForward: new Date("2026-03-29T01:00:00Z"),
      fallBack: new Date("2026-10-25T01:00:00Z"),
    },
  },
  "Asia/Shanghai": {
    // China doesn't observe DST
    2025: { springForward: null, fallBack: null },
    2026: { springForward: null, fallBack: null },
  },
} as const

/**
 * Check if a date falls within DST for a given timezone
 */
export function isDST(date: Date, timezone: string): boolean {
  const transitions = DST_TRANSITIONS[timezone as keyof typeof DST_TRANSITIONS]
  if (!transitions) return false

  const year = date.getFullYear()
  const yearTransitions = transitions[year as keyof typeof transitions]
  if (!yearTransitions || !yearTransitions.springForward || !yearTransitions.fallBack) {
    return false
  }

  return date >= yearTransitions.springForward && date < yearTransitions.fallBack
}

/**
 * Get the UTC offset for a timezone at a specific date
 */
export function getTimezoneOffset(date: Date, timezone: string): number {
  const zonedDate = toZonedTime(date, timezone)
  const utcDate = fromZonedTime(zonedDate, "UTC")
  return (utcDate.getTime() - date.getTime()) / (1000 * 60 * 60)
}

/**
 * Create a date that spans a DST transition
 */
export function createDSTSpanningDates(
  timezone: string,
  year: number = 2025,
  transition: "spring" | "fall" = "spring"
): { before: Date; after: Date; transitionTime: Date } {
  const transitions = DST_TRANSITIONS[timezone as keyof typeof DST_TRANSITIONS]
  if (!transitions) {
    throw new Error(`No DST data for timezone: ${timezone}`)
  }

  const yearTransitions = transitions[year as keyof typeof transitions]
  if (!yearTransitions) {
    throw new Error(`No DST data for year: ${year}`)
  }

  const transitionTime =
    transition === "spring" ? yearTransitions.springForward : yearTransitions.fallBack

  if (!transitionTime) {
    throw new Error(`Timezone ${timezone} doesn't observe DST`)
  }

  // Create dates 1 hour before and after the transition
  const before = new Date(transitionTime.getTime() - 60 * 60 * 1000)
  const after = new Date(transitionTime.getTime() + 60 * 60 * 1000)

  return { before, after, transitionTime }
}

/**
 * Test if a booking would span a DST transition
 */
export function spansDSTTransition(startUtc: Date, endUtc: Date, timezone: string): boolean {
  const transitions = DST_TRANSITIONS[timezone as keyof typeof DST_TRANSITIONS]
  if (!transitions) return false

  const year = startUtc.getFullYear()
  const yearTransitions = transitions[year as keyof typeof transitions]
  if (!yearTransitions) return false

  const springForward = yearTransitions.springForward
  const fallBack = yearTransitions.fallBack

  // Check if the booking spans either transition
  if (springForward && startUtc <= springForward && endUtc > springForward) {
    return true
  }
  if (fallBack && startUtc <= fallBack && endUtc > fallBack) {
    return true
  }

  return false
}

/**
 * Calculate actual duration in minutes accounting for DST
 */
export function getDurationAcrossDST(startUtc: Date, endUtc: Date, timezone: string): number {
  const baseMinutes = (endUtc.getTime() - startUtc.getTime()) / (1000 * 60)

  if (!spansDSTTransition(startUtc, endUtc, timezone)) {
    return baseMinutes
  }

  // Determine which transition we're crossing
  const transitions = DST_TRANSITIONS[timezone as keyof typeof DST_TRANSITIONS]
  const year = startUtc.getFullYear()
  const yearTransitions = transitions?.[year as keyof typeof transitions]

  if (!yearTransitions) return baseMinutes

  // Spring forward: lose an hour (60 minutes less)
  if (
    yearTransitions.springForward &&
    startUtc <= yearTransitions.springForward &&
    endUtc > yearTransitions.springForward
  ) {
    return baseMinutes - 60
  }

  // Fall back: gain an hour (60 minutes more)
  if (
    yearTransitions.fallBack &&
    startUtc <= yearTransitions.fallBack &&
    endUtc > yearTransitions.fallBack
  ) {
    return baseMinutes + 60
  }

  return baseMinutes
}

/**
 * Get test dates for DST scenarios
 */
export function getDSTTestDates(timezone: string) {
  const transitions = DST_TRANSITIONS[timezone as keyof typeof DST_TRANSITIONS]
  if (!transitions?.["2025"]) {
    return null
  }

  const { springForward, fallBack } = transitions["2025"]
  if (!springForward || !fallBack) return null

  return {
    // Spring forward test cases
    beforeSpring: new Date(springForward.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
    duringSpring: springForward,
    afterSpring: new Date(springForward.getTime() + 2 * 60 * 60 * 1000), // 2 hours after

    // Fall back test cases
    beforeFall: new Date(fallBack.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
    duringFall: fallBack,
    afterFall: new Date(fallBack.getTime() + 2 * 60 * 60 * 1000), // 2 hours after

    // Non-DST period (January)
    winterDate: new Date("2025-01-15T12:00:00Z"),
    // DST period (July)
    summerDate: new Date("2025-07-15T12:00:00Z"),
  }
}

/**
 * Format a date showing both standard and DST time
 */
export function formatWithDSTInfo(date: Date, timezone: string): string {
  const inDST = isDST(date, timezone)
  const offset = getTimezoneOffset(date, timezone)
  const zonedDate = toZonedTime(date, timezone)

  const timeStr = zonedDate.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })

  const offsetStr = `UTC${offset >= 0 ? "+" : ""}${offset}`
  const dstStr = inDST ? "DST" : "ST"

  return `${timeStr} ${offsetStr} (${dstStr})`
}

/**
 * Validate that slots are correctly generated across DST
 */
export function validateDSTSlots(
  slots: Date[],
  startUtc: Date,
  endUtc: Date,
  timezone: string
): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // Check if we span DST
  if (spansDSTTransition(startUtc, endUtc, timezone)) {
    const transitions = DST_TRANSITIONS[timezone as keyof typeof DST_TRANSITIONS]
    const year = startUtc.getFullYear()
    const yearTransitions = transitions?.[year as keyof typeof transitions]

    if (yearTransitions?.springForward) {
      // During spring forward, there should be a gap
      const gapStart = yearTransitions.springForward
      const gapEnd = new Date(gapStart.getTime() + 60 * 60 * 1000)

      const slotsInGap = slots.filter(slot => slot >= gapStart && slot < gapEnd)

      if (slotsInGap.length > 0) {
        issues.push(`Found ${slotsInGap.length} slots in DST gap (should be none)`)
      }
    }

    if (yearTransitions?.fallBack) {
      // During fall back, there should be duplicate hour
      const duplicateHourStart = new Date(yearTransitions.fallBack.getTime() - 60 * 60 * 1000)
      const duplicateHourEnd = new Date(yearTransitions.fallBack.getTime() + 60 * 60 * 1000)

      const slotsInDuplicate = slots.filter(
        slot => slot >= duplicateHourStart && slot < duplicateHourEnd
      )

      // Should have extra slots for the repeated hour
      const expectedSlots = 4 // 2 hours * 2 slots per hour
      if (slotsInDuplicate.length !== expectedSlots) {
        issues.push(
          `Expected ${expectedSlots} slots in duplicate hour, found ${slotsInDuplicate.length}`
        )
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
