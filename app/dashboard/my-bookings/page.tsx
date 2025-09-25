"use client"

import { useState } from "react"

export default function MyBookingsPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Bookings</h1>
        <p className="text-muted-foreground">View and manage your room reservations.</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "upcoming"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab("past")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "past"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Past
          </button>
        </div>
      </div>

      {/* Bookings List */}
      <div className="rounded-lg border bg-card p-6">
        {activeTab === "upcoming" ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No upcoming bookings</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your future reservations will appear here.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No past bookings</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your booking history will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
