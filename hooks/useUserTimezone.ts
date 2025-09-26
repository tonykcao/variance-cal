import { useState, useEffect } from "react"

// Get user's timezone from their browser
// In production, this would also check user preferences from the database
export function useUserTimezone(): string {
  const [timezone, setTimezone] = useState<string>("UTC")

  useEffect(() => {
    // Get the browser's timezone
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // In production, we would fetch user's preferred timezone from their profile
    // For now, we'll use the browser timezone
    setTimezone(browserTimezone || "UTC")
  }, [])

  return timezone
}