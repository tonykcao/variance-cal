export interface User {
  id: string
  email: string
  name: string
  timezone: string
  role: "USER" | "ADMIN"
}

export interface AuthContext {
  currentUser: User | null
  setCurrentUser: (user: User | null) => void
}
