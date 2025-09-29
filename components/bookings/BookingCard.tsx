"use client"

import { useState } from "react"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { useRouter } from "next/navigation"
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  X,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Booking {
  id: string
  roomId: string
  roomName: string
  siteName: string
  timezone: string
  startUtc: string
  endUtc: string
  startLocal: string
  endLocal: string
  isOwner: boolean
  isAttendee?: boolean
  owner: {
    id: string
    name: string
    email: string
  }
  attendees: Array<{
    id: string
    name: string
    email: string
  }>
  canceledAt: string | null
}

interface BookingCardProps {
  booking: Booking
  userTimezone: string
  onCancel: (bookingId: string) => Promise<void>
  showActivity?: boolean
  isAdmin?: boolean
}

export function BookingCard({
  booking,
  userTimezone,
  onCancel,
  showActivity = false,
  isAdmin = false,
}: BookingCardProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)

  const startDate = new Date(booking.startUtc)
  const endDate = new Date(booking.endUtc)
  const now = new Date()

  const isUpcoming = startDate > now
  const isInProgress = startDate <= now && endDate > now
  const isPast = endDate < now
  const isCanceled = booking.canceledAt !== null

  // Format dates in user's timezone
  const startUserLocal = formatInTimeZone(startDate, userTimezone, "MMM d, yyyy h:mm a")
  const endUserLocal = formatInTimeZone(endDate, userTimezone, "h:mm a")

  // Parse the room's local time from API (format: "2025-10-07 14:00")
  const startLocalParts = booking.startLocal.split(" ")
  // Parse the date string properly to display it
  const [year, month, day] = (startLocalParts[0] || "").split("-")
  const startRoomDate =
    year && month && day
      ? format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), "MMM d, yyyy")
      : ""
  const startRoomTime = startLocalParts[1] || ""

  const endLocalParts = booking.endLocal.split(" ")
  const endRoomTime = endLocalParts[1] || ""

  const handleViewOnCalendar = () => {
    // Navigate to availability page with the booking date pre-selected
    // Use the room's local date, not the user's timezone date
    // startLocal format is "yyyy-MM-dd HH:mm", extract just the date part
    const bookingDate = booking.startLocal.split(" ")[0]
    router.push(`/dashboard/availability?date=${bookingDate}&site=${booking.siteName}`)
  }

  const handleCancel = async () => {
    try {
      setIsCanceling(true)
      await onCancel(booking.id)
      setIsCancelDialogOpen(false)
    } catch (error) {
      console.error("Failed to cancel booking:", error)
    } finally {
      setIsCanceling(false)
    }
  }

  const getStatusBadge = () => {
    if (isCanceled) {
      return <Badge variant="secondary">Canceled</Badge>
    }
    if (isInProgress) {
      return <Badge className="bg-green-500">In Progress</Badge>
    }
    if (isUpcoming) {
      return <Badge>Upcoming</Badge>
    }
    if (isPast) {
      return <Badge variant="secondary">Completed</Badge>
    }
  }

  return (
    <>
      <Card className={isCanceled ? "opacity-60" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{booking.roomName}</h3>
                {getStatusBadge()}
                {booking.isOwner && (
                  <Badge variant="default" className="text-xs">
                    Your booking
                  </Badge>
                )}
                {!booking.isOwner && booking.isAttendee && (
                  <Badge variant="outline" className="text-xs">
                    You're attending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{booking.siteName}</span>
                </div>
                {booking.attendees.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>
                      {booking.attendees.length + 1} attendee
                      {booking.attendees.length > 0 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleViewOnCalendar}
                className="text-gray-400 hover:text-gray-200"
              >
                <Calendar className="h-4 w-4 mr-1" />
                View on Calendar
              </Button>
              {(booking.isOwner || isAdmin) && isUpcoming && !isCanceled && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsCancelDialogOpen(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Time Display - Room Local and User Local */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Room Local Time */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Room Time ({booking.timezone})</div>
              <div className="flex items-center gap-1 text-sm">
                <Calendar className="h-3 w-3" />
                <span>{startRoomDate}</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Clock className="h-3 w-3" />
                <span>
                  {startRoomTime} - {endRoomTime}
                </span>
              </div>
            </div>

            {/* User Local Time (if different) */}
            {userTimezone !== booking.timezone && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Your Time ({userTimezone})</div>
                <div className="flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3" />
                  <span>{format(startDate, "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(startDate, "h:mm a")} - {format(endDate, "h:mm a")}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && (
            <div className="pt-3 border-t space-y-3">
              {/* Owner Information */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">Booked by</div>
                <div className="text-sm">
                  {booking.owner.name} ({booking.owner.email})
                  {booking.isOwner && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      You
                    </Badge>
                  )}
                </div>
              </div>

              {/* Attendees */}
              {booking.attendees.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Additional Attendees</div>
                  <div className="space-y-1">
                    {booking.attendees.map(attendee => (
                      <div key={attendee.id} className="text-sm">
                        {attendee.name} ({attendee.email})
                        {booking.isAttendee && attendee.email === booking.owner.email && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancellation Info */}
              {isCanceled && booking.canceledAt && (
                <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium">Booking Canceled</div>
                    <div className="text-muted-foreground">
                      Canceled on {format(new Date(booking.canceledAt), "MMM d, yyyy h:mm a")}
                    </div>
                  </div>
                </div>
              )}

              {/* Booking ID */}
              <div className="text-xs text-muted-foreground">Booking ID: {booking.id}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {!booking.isOwner && isAdmin && (
                <>
                  <strong>Admin Action:</strong> You are canceling a booking created by{" "}
                  {booking.owner.name}.
                  <br />
                  <br />
                </>
              )}
              Are you sure you want to cancel this booking? This action cannot be undone.
              {isInProgress && (
                <>
                  <br />
                  <br />
                  <strong>
                    Note: This booking is currently in progress. Only the remaining time will be
                    freed for others.
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCanceling}>Keep Booking</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCanceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCanceling ? "Canceling..." : "Cancel Booking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
