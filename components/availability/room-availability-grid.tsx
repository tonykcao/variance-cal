"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { Users } from "lucide-react"

interface Room {
  id: string
  name: string
  capacity: number
  siteId: string
  siteName: string
  siteTimezone: string
}

interface TimeSlot {
  time: string // HH:mm format in room's local timezone
  available: boolean
  isPast?: boolean
  isClosed?: boolean
  isOwnBooking?: boolean
  isAttending?: boolean
}

interface RoomAvailability {
  room: Room
  slots: TimeSlot[]
}

interface RoomAvailabilityGridProps {
  availability: RoomAvailability[]
  date: Date
  userTimezone: string
  onSlotSelect: (room: Room, startTime: string, endTime: string) => void
}

export function RoomAvailabilityGrid({
  availability,
  date,
  userTimezone,
  onSlotSelect,
}: RoomAvailabilityGridProps) {
  const [selectedSlots, setSelectedSlots] = useState<{
    roomId?: string
    startIndex?: number
    endIndex?: number
  }>({})
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{roomId: string, index: number} | null>(null)

  const handleMouseDown = (roomId: string, slotIndex: number, slot: TimeSlot) => {
    if (!slot.available || slot.isPast || slot.isClosed) return

    setIsDragging(true)
    setDragStart({roomId, index: slotIndex})
    setSelectedSlots({
      roomId,
      startIndex: slotIndex,
      endIndex: slotIndex,
    })
  }

  const handleMouseEnter = (roomId: string, slotIndex: number, slot: TimeSlot) => {
    if (!isDragging || !dragStart || dragStart.roomId !== roomId) return
    if (!slot.available || slot.isPast || slot.isClosed) return

    const start = Math.min(dragStart.index, slotIndex)
    const end = Math.max(dragStart.index, slotIndex)

    setSelectedSlots({
      roomId,
      startIndex: start,
      endIndex: end,
    })
  }

  const handleMouseUp = () => {
    if (isDragging && selectedSlots.roomId && selectedSlots.startIndex !== undefined && selectedSlots.endIndex !== undefined) {
      const roomAvail = availability.find((a) => a.room.id === selectedSlots.roomId)
      if (roomAvail) {
        const startSlot = roomAvail.slots[selectedSlots.startIndex]
        const endSlot = roomAvail.slots[selectedSlots.endIndex]

        if (startSlot && endSlot) {
          // Calculate end time (add 30 minutes to the last slot)
          const [endHour, endMin] = endSlot.time.split(":").map(Number)
          let endTime: string
          if (endMin === 30) {
            endTime = `${(endHour + 1).toString().padStart(2, "0")}:00`
          } else {
            endTime = `${endHour.toString().padStart(2, "0")}:30`
          }

          onSlotSelect(roomAvail.room, startSlot.time, endTime)
          setSelectedSlots({}) // Clear selection after booking
        }
      }
    }
    setIsDragging(false)
    setDragStart(null)
  }

  // Helper function to convert room time to user time
  const convertToUserTime = (roomTime: string, roomTimezone: string, userTimezone: string) => {
    try {
      // Create a date object for today with the room time
      const today = new Date().toISOString().split('T')[0]
      const roomDateTime = new Date(`${today}T${roomTime}:00`)

      // Convert from room timezone to UTC, then to user timezone
      const userTime = formatInTimeZone(roomDateTime, userTimezone, 'HH:mm')
      return userTime
    } catch (error) {
      return roomTime // fallback to room time if conversion fails
    }
  }

  // Generate time labels (every hour for display)
  const timeLabels = []
  for (let hour = 0; hour < 24; hour++) {
    timeLabels.push(`${hour.toString().padStart(2, "0")}:00`)
  }

  const handleSlotClick = (
    roomId: string,
    slotIndex: number,
    slot: TimeSlot
  ) => {
    if (!slot.available || slot.isPast || slot.isClosed) return

    if (!selectedSlots.roomId || selectedSlots.roomId !== roomId) {
      // Start new selection
      setSelectedSlots({
        roomId,
        startIndex: slotIndex,
        endIndex: slotIndex,
      })
    } else if (selectedSlots.startIndex !== undefined) {
      // Complete selection
      const start = Math.min(selectedSlots.startIndex, slotIndex)
      const end = Math.max(selectedSlots.startIndex, slotIndex)

      // Find the room and slots
      const roomAvail = availability.find((a) => a.room.id === roomId)
      if (roomAvail) {
        const startTime = roomAvail.slots[start].time
        const endSlot = roomAvail.slots[end]
        // Add 30 minutes to get end time
        const [endHour, endMin] = endSlot.time.split(":").map(Number)
        const endTime = `${endHour.toString().padStart(2, "0")}:${
          endMin === 0 ? "30" : "00"
        }`
        if (endMin === 30) {
          const nextHour = (endHour + 1).toString().padStart(2, "0")
          onSlotSelect(roomAvail.room, startTime, `${nextHour}:00`)
        } else {
          onSlotSelect(roomAvail.room, startTime, endTime)
        }
      }

      // Clear selection after booking
      setSelectedSlots({})
    }
  }

  const isSlotSelected = (roomId: string, slotIndex: number) => {
    if (selectedSlots.roomId !== roomId) return false
    if (
      selectedSlots.startIndex === undefined ||
      selectedSlots.endIndex === undefined
    )
      return false

    const start = Math.min(selectedSlots.startIndex, selectedSlots.endIndex)
    const end = Math.max(selectedSlots.startIndex, selectedSlots.endIndex)
    return slotIndex >= start && slotIndex <= end
  }

  if (availability.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground">
          No rooms found. Try widening time window, lowering capacity, or
          selecting more sites.
        </p>
      </div>
    )
  }

  // Group rooms by site
  const roomsBySite = availability.reduce((acc, item) => {
    const siteName = item.room.siteName
    if (!acc[siteName]) {
      acc[siteName] = []
    }
    acc[siteName].push(item)
    return acc
  }, {} as Record<string, RoomAvailability[]>)

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-medium text-muted-foreground">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-800 border border-green-700 rounded" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-800 border border-blue-700 rounded" />
            <span>Your Booking</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-700 border border-blue-600 rounded" />
            <span>You're Attending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-800 border border-red-700 rounded" />
            <span>Others' Booking</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-700 border border-gray-600 rounded" />
            <span>Closed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-800 border border-gray-700 rounded" />
            <span>Past</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-blue-700 border border-blue-600 ring-2 ring-blue-500 rounded" />
            <span>Selected</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Drag to select multiple time slots. Times shown as Room Time (Site) | Local Time
        </p>
      </div>

      {Object.entries(roomsBySite).map(([siteName, rooms]) => (
        <div key={siteName} className="rounded-lg border bg-card">
          <div className="border-b p-4">
            <h3 className="font-semibold text-card-foreground">{siteName}</h3>
            <p className="text-sm text-muted-foreground">
              {rooms[0].room.siteTimezone}
            </p>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px] p-4">
              {/* Time header */}
              <div className="mb-2 grid grid-cols-[200px_repeat(48,_20px)] gap-0">
                <div /> {/* Empty cell for room name column */}
                {timeLabels.map((label, i) => (
                  <div
                    key={label}
                    className="col-span-2 text-center text-xs text-muted-foreground"
                  >
                    {i % 2 === 0 && label}
                  </div>
                ))}
              </div>

              {/* Room rows */}
              {rooms.map((roomAvail) => (
                <div
                  key={roomAvail.room.id}
                  className="mb-3 grid grid-cols-[200px_repeat(48,_20px)] gap-0"
                >
                  {/* Room info */}
                  <div className="flex items-center space-x-2 pr-4">
                    <span className="font-medium text-card-foreground">{roomAvail.room.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      <Users className="mr-1 h-3 w-3" />
                      {roomAvail.room.capacity}
                    </Badge>
                  </div>

                  {/* Slots */}
                  {roomAvail.slots.map((slot, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        handleSlotClick(roomAvail.room.id, i, slot)
                      }
                      disabled={!slot.available || slot.isPast || slot.isClosed}
                      className={cn(
                        "h-8 border-l border-t border-b transition-colors cursor-pointer select-none",
                        i === roomAvail.slots.length - 1 && "border-r",
                        slot.available && !slot.isPast && !slot.isClosed
                          ? "bg-green-800 hover:bg-green-700 border-green-700 text-green-100"
                          : "",
                        !slot.available && !slot.isPast && !slot.isClosed && slot.isOwnBooking && "bg-blue-800 border-blue-700 text-blue-100",
                        !slot.available && !slot.isPast && !slot.isClosed && slot.isAttending && "bg-blue-700 border-blue-600 text-blue-100",
                        !slot.available && !slot.isPast && !slot.isClosed && !slot.isOwnBooking && !slot.isAttending && "bg-red-800 border-red-700 text-red-100",
                        slot.isClosed && "bg-gray-700 border-gray-600 text-gray-300",
                        slot.isPast && "bg-gray-800 border-gray-700 text-gray-400",
                        isSlotSelected(roomAvail.room.id, i) &&
                          "bg-blue-700 ring-2 ring-blue-500 border-blue-600 text-blue-100"
                      )}
                      onMouseDown={() => handleMouseDown(roomAvail.room.id, i, slot)}
                      onMouseEnter={() => handleMouseEnter(roomAvail.room.id, i, slot)}
                      onMouseUp={handleMouseUp}
                      title={`${slot.time} (${roomAvail.room.siteName}) | ${convertToUserTime(slot.time, roomAvail.room.siteTimezone, userTimezone)} (Local) - ${
                        slot.available
                          ? "Available"
                          : slot.isClosed
                          ? "Closed"
                          : slot.isPast
                          ? "Past"
                          : slot.isOwnBooking
                          ? "Your Booking"
                          : slot.isAttending
                          ? "You're Attending"
                          : "Other's Booking"
                      }`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      ))}
    </div>
  )
}