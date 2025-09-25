"use client"

import { useState, useEffect } from "react"
import { ChevronDown, User as UserIcon } from "lucide-react"
import { MOCK_USERS, getUserById } from "@/lib/auth/mock-users"
import { User } from "@/lib/auth/types"
import { Button } from "@/components/ui/button"

export function UserSwitcher() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Get current user from cookie
    const cookieValue = document.cookie
      .split("; ")
      .find(row => row.startsWith("mock-user-id="))
      ?.split("=")[1]

    if (cookieValue) {
      const user = getUserById(cookieValue)
      if (user) {
        setCurrentUser(user)
      }
    }
  }, [])

  const switchUser = (user: User) => {
    // Set cookie
    document.cookie = `mock-user-id=${user.id}; path=/; sameSite=lax`
    setCurrentUser(user)
    setIsOpen(false)
    // Reload to apply new user context
    window.location.reload()
  }

  if (!currentUser) return null

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
            {MOCK_USERS.map(user => (
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
