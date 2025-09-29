"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, MapPin, Clock, Calendar } from "lucide-react"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"

interface Room {
  id: string
  name: string
  capacity: number
  siteId: string
  siteName: string
  siteTimezone: string
}

interface CreateBookingModalProps {
  open: boolean
  onClose: () => void
  room: Room | null
  date: Date
  startTime: string // HH:mm format in room's local timezone
  endTime: string // HH:mm format in room's local timezone
  userTimezone: string
  onConfirm: (attendeeIds: string[]) => void
}

export function CreateBookingModal({
  open,
  onClose,
  room,
  date,
  startTime,
  endTime,
  userTimezone,
  onConfirm,
}: CreateBookingModalProps) {
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([])
  const [emailInput, setEmailInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!room) return null

  const handleAddAttendee = () => {
    if (emailInput && attendeeEmails.length < 3) {
      setAttendeeEmails([...attendeeEmails, emailInput])
      setEmailInput("")
    }
  }

  const handleRemoveAttendee = (index: number) => {
    setAttendeeEmails(attendeeEmails.filter((_, i) => i !== index))
  }

  const handleConfirm = async () => {
    setIsSubmitting(true)
    // TODO: Convert emails to user IDs
    await onConfirm(attendeeEmails)
    setIsSubmitting(false)
    setAttendeeEmails([])
    onClose()
  }

  // Format times for display
  const roomLocalTime = `${startTime} - ${endTime}`

  // Convert to user's timezone (simplified for now)
  const userLocalTime =
    room.siteTimezone === userTimezone ? roomLocalTime : `${roomLocalTime} (${room.siteTimezone})`

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
          <DialogDescription>
            Reserve {room.name} in {room.siteName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Room Details */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{room.siteName}</span>
              <span className="text-muted-foreground">•</span>
              <span>{room.name}</span>
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Capacity: {room.capacity} people</span>
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(date, "EEEE, MMMM d, yyyy")}</span>
            </div>

            <div className="flex items-center space-x-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium">{roomLocalTime}</span>
                {room.siteTimezone !== userTimezone && (
                  <span className="text-xs text-muted-foreground">
                    Your timezone: {userLocalTime}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Additional Attendees (Optional)</Label>
            <p className="text-xs text-muted-foreground">
              Add up to 3 people who will join this meeting
            </p>

            {attendeeEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attendeeEmails.map((email, index) => (
                  <Badge key={index} variant="secondary">
                    {email}
                    <button
                      onClick={() => handleRemoveAttendee(index)}
                      className="ml-1 text-xs hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {attendeeEmails.length < 3 && (
              <div className="flex space-x-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyPress={e => e.key === "Enter" && handleAddAttendee()}
                  placeholder="Enter email address"
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddAttendee}
                  disabled={!emailInput || attendeeEmails.length >= 3}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Confirm Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
