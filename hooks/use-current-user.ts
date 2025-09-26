"use client"

import { useState, useEffect } from "react"
import { User } from "@/lib/auth/types"
import { getUserById } from "@/lib/auth/mock-users"

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        // Get current user from cookie
        const cookieValue = document.cookie
          .split("; ")
          .find(row => row.startsWith("mock-user-id="))
          ?.split("=")[1]

        if (cookieValue) {
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
            console.warn("Using mock user, database not available:", error)
          }

          // Fallback to mock user
          const mockUser = getUserById(cookieValue)
          if (mockUser) {
            setCurrentUser(mockUser)
          }
        }
      } catch (error) {
        console.error("Failed to fetch current user:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentUser()
  }, [])

  const isAdmin = currentUser?.role === "ADMIN"

  return { currentUser, loading, isAdmin }
}