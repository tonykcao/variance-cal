"use client"

import { useState, useEffect } from "react"
import { User } from "@/lib/auth/types"
import { getUserById, MOCK_USERS } from "@/lib/auth/mock-users"

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Get current user from cookie
        let cookieValue = document.cookie
          .split("; ")
          .find(row => row.startsWith("mock-user-id="))
          ?.split("=")[1]

        // Decode the cookie value (handles %40 -> @)
        if (cookieValue) {
          cookieValue = decodeURIComponent(cookieValue)
        }

        // If no cookie, set default user (alice-admin)
        if (!cookieValue) {
          const defaultUserId = "alice@example.com"
          document.cookie = `mock-user-id=${encodeURIComponent(defaultUserId)}; path=/; sameSite=lax`
          cookieValue = defaultUserId
        }

        // Try database first, fallback to mock
        try {
          const response = await fetch(`/api/users/${cookieValue}`)
          if (response.ok) {
            const user = await response.json()
            setCurrentUser(user)
            setLoading(false)
            return
          }
        } catch (error) {
          // Database not available, use mock
        }

        // Fallback to mock user
        const mockUser = getUserById(cookieValue) || MOCK_USERS[0]
        setCurrentUser(mockUser)
        setLoading(false)
      } catch (error) {
        console.error("Failed to fetch current user:", error)
        // Set default user on error
        const defaultUser = getUserById("alice@example.com") || MOCK_USERS[0]
        setCurrentUser(defaultUser)
        setLoading(false)
      }
    }

    fetchCurrentUser()
  }, [])

  const isAdmin = currentUser?.role === "ADMIN"

  return { currentUser, loading, isAdmin }
}
