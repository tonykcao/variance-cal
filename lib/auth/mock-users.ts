import { User } from "./types"

// Fallback mock users - these IDs should match the database
// These are used when the database is not available
// The actual user IDs from the database will be used when available
export const MOCK_USERS: User[] = [
  {
    id: "cmg2v5ftb0000vcm83ujio2gd",
    email: "alice@example.com",
    name: "alice-admin",
    timezone: "America/Los_Angeles",
    role: "ADMIN",
  },
  {
    id: "cmg2v5ftr0001vcm816b29mrv",
    email: "bob@example.com",
    name: "bob-user",
    timezone: "America/New_York",
    role: "USER",
  },
  {
    id: "cmg2v5fu20002vcm8wwixoqsy",
    email: "connor@example.com",
    name: "connor-user",
    timezone: "Europe/London",
    role: "USER",
  },
]

export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find(user => user.id === id)
}

export function getUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find(user => user.email === email)
}
