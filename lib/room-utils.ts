/**
 * Utility functions for room identification and display
 */

// Site codes for room IDs
const SITE_CODES = {
  "San Francisco": "SFO",
  "New York": "NYC",
  London: "LON",
  Shanghai: "SHA",
} as const

/**
 * Generate a room ID based on site and room index
 * Example: SFO-001, NYC-002
 */
export function generateRoomId(siteName: string, index: number): string {
  const siteCode = SITE_CODES[siteName as keyof typeof SITE_CODES] || "XXX"
  return `${siteCode}-${String(index).padStart(3, "0")}`
}

/**
 * Parse room ID to get site code and index
 */
export function parseRoomId(roomId: string): { siteCode: string; index: number } | null {
  const match = roomId.match(/^([A-Z]{3})-(\d{3})$/)
  if (!match) return null

  return {
    siteCode: match[1],
    index: parseInt(match[2], 10),
  }
}

/**
 * Format room display name
 * Example: "Oak (SFO-001)" or just "Oak" depending on preference
 */
export function formatRoomDisplayName(
  roomName: string,
  roomId: string,
  includeId: boolean = true
): string {
  if (!includeId) return roomName
  return `${roomName} (${roomId})`
}

/**
 * Get site name from site code
 */
export function getSiteNameFromCode(siteCode: string): string | undefined {
  const entry = Object.entries(SITE_CODES).find(([_, code]) => code === siteCode)
  return entry?.[0]
}
