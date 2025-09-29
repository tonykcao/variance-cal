import { User } from "./types"

// Mock users using email as ID for simplicity
export const MOCK_USERS: User[] = [
  {
    id: "alice@example.com",
    email: "alice@example.com",
    name: "alice-admin",
    timezone: "America/Los_Angeles",
    role: "ADMIN",
  },
  {
    id: "bob@example.com",
    email: "bob@example.com",
    name: "bob-user",
    timezone: "America/New_York",
    role: "USER",
  },
  {
    id: "connor@example.com",
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
