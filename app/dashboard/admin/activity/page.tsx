"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Activity,
  CalendarIcon,
  Filter,
  User,
  Building,
  MapPin,
  Clock,
  RefreshCw,
} from "lucide-react"
import { format } from "date-fns"

interface ActivityLogEntry {
  id: string
  actorId: string
  action: string
  entityType: string
  entityId: string
  metadata: any
  createdAt: string
  actor: {
    id: string
    name: string
    email: string
  }
}

const ACTION_COLORS: Record<string, string> = {
  BOOKING_CREATED: "bg-green-100 text-green-800 border border-green-200",
  BOOKING_CANCELED: "bg-red-100 text-red-800 border border-red-200",
  ROOM_CREATED: "bg-blue-100 text-blue-800 border border-blue-200",
  ROOM_UPDATED: "bg-amber-100 text-amber-800 border border-amber-200",
  SITE_CREATED: "bg-purple-100 text-purple-800 border border-purple-200",
  SITE_UPDATED: "bg-indigo-100 text-indigo-800 border border-indigo-200",
}

const ACTION_ICONS: Record<string, any> = {
  BOOKING_CREATED: Clock,
  BOOKING_CANCELED: Clock,
  ROOM_CREATED: Building,
  ROOM_UPDATED: Building,
  SITE_CREATED: MapPin,
  SITE_UPDATED: MapPin,
}

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    entityType: "",
    action: "",
    date: null as Date | null,
  })

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.entityType) params.set("entityType", filters.entityType)
      if (filters.action) params.set("action", filters.action)
      if (filters.date) params.set("date", format(filters.date, "yyyy-MM-dd"))

      const response = await fetch(`/api/activity?${params}`)
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      entityType: "",
      action: "",
      date: null,
    })
  }

  const formatActivityDescription = (activity: ActivityLogEntry) => {
    const { action, entityType, metadata } = activity

    switch (action) {
      case "BOOKING_CREATED":
        return `Created booking for ${metadata.roomName || "room"}`
      case "BOOKING_CANCELED":
        return `Canceled booking for ${metadata.roomName || "room"}`
      case "ROOM_CREATED":
        return `Created room "${metadata.roomName || metadata.name || "Unknown"}"`
      case "ROOM_UPDATED":
        return `Updated room "${metadata.roomName || metadata.name || "Unknown"}"`
      case "SITE_CREATED":
        return `Created site "${metadata.siteName || metadata.name || "Unknown"}"`
      case "SITE_UPDATED":
        return `Updated site "${metadata.siteName || metadata.name || "Unknown"}"`
      default:
        return `${action.toLowerCase().replace("_", " ")} ${entityType}`
    }
  }

  const getActionIcon = (action: string) => {
    const Icon = ACTION_ICONS[action] || Activity
    return Icon
  }

  return (
    <div className="space-y-6">
      <div className="border-b border pb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Activity Log</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Monitor all system activities across sites and rooms
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Filters:</span>
          </div>

          <Select
            value={filters.entityType || "all"}
            onValueChange={value => handleFilterChange("entityType", value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-40 bg-secondary border-input text-foreground">
              <SelectValue placeholder="Entity Type" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-input">
              <SelectItem value="all" className="text-foreground">
                All Types
              </SelectItem>
              <SelectItem value="booking" className="text-foreground">
                Bookings
              </SelectItem>
              <SelectItem value="room" className="text-foreground">
                Rooms
              </SelectItem>
              <SelectItem value="site" className="text-foreground">
                Sites
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.action || "all"}
            onValueChange={value => handleFilterChange("action", value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-40 bg-secondary border-input text-foreground">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-input">
              <SelectItem value="all" className="text-foreground">
                All Actions
              </SelectItem>
              <SelectItem value="BOOKING_CREATED" className="text-foreground">
                Created
              </SelectItem>
              <SelectItem value="BOOKING_CANCELED" className="text-foreground">
                Canceled
              </SelectItem>
              <SelectItem value="ROOM_CREATED" className="text-foreground">
                Room Created
              </SelectItem>
              <SelectItem value="ROOM_UPDATED" className="text-foreground">
                Room Updated
              </SelectItem>
              <SelectItem value="SITE_CREATED" className="text-foreground">
                Site Created
              </SelectItem>
              <SelectItem value="SITE_UPDATED" className="text-foreground">
                Site Updated
              </SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="bg-secondary border-input text-foreground hover:bg-accent"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.date ? format(filters.date, "MMM d, yyyy") : "Date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-secondary border-input">
              <Calendar
                mode="single"
                selected={filters.date || undefined}
                onSelect={date => setFilters(prev => ({ ...prev, date: date || null }))}
                className="bg-secondary text-foreground"
              />
            </PopoverContent>
          </Popover>

          <Button
            onClick={fetchActivities}
            className="bg-secondary hover:bg-accent border border-input text-foreground"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Apply
          </Button>

          {(filters.entityType || filters.action || filters.date) && (
            <Button
              variant="outline"
              onClick={clearFilters}
              className="border-input text-muted-foreground hover:bg-secondary"
            >
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div
        className="bg-card rounded-lg
      "
      >
        {loading ? (
          <div className="p-16 text-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-16 text-center">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No activities found</p>
            <p className="text-sm text-muted-foreground mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {activities.map(activity => {
              const Icon = getActionIcon(activity.action)
              return (
                <div key={activity.id} className="p-4 hover:bg-secondary/50">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          className={`${ACTION_COLORS[activity.action] || "bg-secondary text-foreground"} text-xs`}
                        >
                          {activity.action.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm text-foreground font-medium">
                          {activity.actor?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({activity.actor?.email || "N/A"})
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {formatActivityDescription(activity)}
                      </p>

                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="mt-2 p-2 bg-secondary rounded text-xs">
                          <div className="text-muted-foreground mb-1">Details:</div>
                          <div className="text-muted-foreground space-y-1">
                            {Object.entries(activity.metadata).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">{key}:</span>{" "}
                                <span>
                                  {typeof value === "string" ? value : JSON.stringify(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
