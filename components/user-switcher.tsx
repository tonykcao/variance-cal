"use client"

import { useState, useEffect } from "react"
import { ChevronDown, User as UserIcon } from "lucide-react"
import { MOCK_USERS, getUserById } from "@/lib/auth/mock-users"
import { User } from "@/lib/auth/types"
import { Button } from "@/components/ui/button"

export function UserSwitcher() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Initialize with database users or fallback to mock
    initializeUsers()
  }, [])

  const initializeUsers = async () => {
    let availableUsers: User[] = []

    // Try to fetch users from database
    try {
      const response = await fetch("/api/users")
      if (response.ok) {
        availableUsers = await response.json()
      } else {
        availableUsers = MOCK_USERS
      }
    } catch (error) {
      // Database not available, use mock
      availableUsers = MOCK_USERS
    }

    setUsers(availableUsers)

    // Get current user from cookie
    let cookieValue = document.cookie
      .split("; ")
      .find(row => row.startsWith("mock-user-id="))
      ?.split("=")[1]

    // Decode the cookie value (handles %40 -> @)
    if (cookieValue) {
      cookieValue = decodeURIComponent(cookieValue)
    }

    // If no cookie, set default
    if (!cookieValue) {
      const defaultUserId = "alice@example.com"
      document.cookie = `mock-user-id=${encodeURIComponent(defaultUserId)}; path=/; sameSite=lax`
      cookieValue = defaultUserId
    }

    // Find user in available users or fallback to mock
    const user = availableUsers.find(u => u.id === cookieValue) ||
                 getUserById(cookieValue) ||
                 availableUsers[0]

    if (user) {
      setCurrentUser(user)
    }
  }


  const switchUser = (user: User) => {
    // Only switch if different user
    if (user.id === currentUser?.id) {
      setIsOpen(false)
      return
    }

    // Set cookie (encode to handle @ symbol)
    document.cookie = `mock-user-id=${encodeURIComponent(user.id)}; path=/; sameSite=lax`
    setCurrentUser(user)
    setIsOpen(false)
    // Reload to apply new user context
    window.location.reload()
  }

  // Show loading state while initializing
  if (!currentUser || users.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <UserIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <UserIcon className="h-4 w-4" />
        <span className="text-sm font-medium">{currentUser.name}</span>
        {currentUser.role === "ADMIN" && (
          <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            Admin
          </span>
        )}
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-background border">
          <div className="p-2">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Switch User
            </div>
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => switchUser(user)}
                className={`w-full text-left px-2 py-2 text-sm rounded hover:bg-accent transition-colors ${
                  user.id === currentUser.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                  {user.role === "ADMIN" && (
                    <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{user.timezone}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
