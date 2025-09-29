"use client"

import { useState, useEffect } from "react"

export default function TestBookingsPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/bookings?scope=upcoming")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then(data => {
        setData(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="p-4">Loading...</div>
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Test Bookings Page</h1>

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Current User:</h2>
        <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(data?.currentUser, null, 2)}</pre>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Number of Bookings: {data?.bookings?.length || 0}</h2>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Bookings:</h2>
        {data?.bookings?.map((booking: any, idx: number) => (
          <div key={booking.id} className="mb-4 p-4 border rounded">
            <div>
              Booking {idx + 1}: {booking.roomName} at {booking.siteName}
            </div>
            <div className="text-sm text-gray-600">Start: {booking.startLocal} (room time)</div>
            <div className="text-sm text-gray-600">
              Owner: {booking.owner.name} {booking.isOwner ? "(You)" : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Raw Response:</h2>
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  )
}
