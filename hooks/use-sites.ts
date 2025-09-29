"use client"

import { useState, useEffect } from "react"

export interface Site {
  id: string
  name: string
  timezone: string
  roomCount: number
}

export function useSites() {
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await fetch("/api/sites")
        if (!response.ok) {
          throw new Error("Failed to fetch sites")
        }
        const data = await response.json()
        setSites(data.sites || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sites")
      } finally {
        setLoading(false)
      }
    }

    fetchSites()
  }, [])

  return { sites, loading, error }
}
