import { User } from "./types"

// TODO: Replace with database queries once Prisma migrations are run
// These mock users match the seed data in prisma/seed.ts
// After running migrations, use prisma.user.findMany() instead
// IMPORTANT: Our tech spec includes a real database (MySQL with Prisma)
// This hard-coded data is temporary for initial development only
export const MOCK_USERS: User[] = [
  {
    id: "user-alice",
    email: "alice@example.com",
    name: "alice-user",
    timezone: "America/Los_Angeles",
    role: "USER",
  },
  {
    id: "user-bob",
    email: "bob@example.com",
    name: "bob-user",
    timezone: "America/New_York",
    role: "USER",
  },
  {
    id: "user-connor",
    email: "connor@example.com",
    name: "connor-admin",
    timezone: "Europe/London",
    role: "ADMIN",
  },
]

export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find(user => user.id === id)
}

export function getUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find(user => user.email === email)
}
