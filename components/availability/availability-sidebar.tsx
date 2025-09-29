"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Search, MapPin, Users, Clock } from "lucide-react"
import { format } from "date-fns"
import { useSites } from "@/hooks/use-sites"
import { TimeRangePicker } from "@/components/ui/time-range-picker"

interface AvailabilitySidebarProps {
  onSearch: (filters: SearchFilters) => void
  isSearching?: boolean
  initialDate?: Date
  initialSite?: string
}

export interface SearchFilters {
  sites: string[]
  capacityMin: number
  date: Date
  timeWindow?: { start: string; end: string }
}

export function AvailabilitySidebar({
  onSearch,
  isSearching,
  initialDate,
  initialSite,
}: AvailabilitySidebarProps) {
  const { sites, loading } = useSites()
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [capacity, setCapacity] = useState(1)
  const [date, setDate] = useState<Date>(() => {
    // Use initial date if provided, otherwise next Monday
    if (initialDate) return initialDate

    const nextMonday = new Date()
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7))
    return nextMonday
  })
  const [timeStart, setTimeStart] = useState("")
  const [timeEnd, setTimeEnd] = useState("")

  // Initialize with sites when they load
  useEffect(() => {
    if (sites.length > 0 && selectedSites.length === 0) {
      let sitesToSelect: string[] = []

      if (initialSite) {
        // If a specific site is provided, only select that one
        // The BookingCard passes site name, so match by name
        const matchingSite = sites.find(s => s.name === initialSite || s.id === initialSite)
        if (matchingSite) {
          // Use site ID for API compatibility
          sitesToSelect = [matchingSite.id]
        } else {
          // Fallback to all sites if the specified site is not found
          sitesToSelect = sites.map(s => s.id)
        }
      } else {
        // Select all sites by default - use IDs for API
        sitesToSelect = sites.map(s => s.id)
      }

      setSelectedSites(sitesToSelect)

      // Auto-search when URL params are present
      if (initialDate || initialSite) {
        // Small delay to ensure state is updated
        setTimeout(() => {
          const filters: SearchFilters = {
            sites: sitesToSelect,
            capacityMin: capacity,
            date: date,
          }
          onSearch(filters)
        }, 100)
      }
    }
  }, [sites, initialSite, initialDate])

  const handleSiteToggle = (siteId: string) => {
    setSelectedSites(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    )
  }

  const handleSearch = () => {
    const filters: SearchFilters = {
      sites: selectedSites,
      capacityMin: capacity,
      date,
    }

    if (timeStart && timeEnd) {
      filters.timeWindow = { start: timeStart, end: timeEnd }
    }

    onSearch(filters)
  }

  return (
    <div className="w-72 h-full bg-card border-r p-6 overflow-y-auto">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold text-card-foreground flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Search Filters
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Find available rooms</p>
        </div>

        {/* Date Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-foreground flex items-center gap-2">
            <CalendarIcon className="h-3 w-3" />
            Date
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal bg-background border-input text-foreground hover:bg-accent hover:text-foreground"
              >
                <CalendarIcon className="mr-2 h-3 w-3 text-muted-foreground" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-background border-input">
              <Calendar
                mode="single"
                selected={date}
                onSelect={d => d && setDate(d)}
                initialFocus
                className="bg-background text-foreground"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Sites Selection */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-foreground flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Office Locations
          </Label>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading sites...</div>
          ) : (
            <div className="space-y-2">
              {sites.map(site => (
                <div key={site.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={site.id}
                    checked={selectedSites.includes(site.id)}
                    onCheckedChange={() => handleSiteToggle(site.id)}
                    className="border-input data-[state=checked]:bg-accent data-[state=checked]:border-input"
                  />
                  <label
                    htmlFor={site.id}
                    className="text-xs text-foreground cursor-pointer select-none hover:text-foreground"
                  >
                    {site.name}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Capacity */}
        <div className="space-y-3">
          <Label className="text-xs font-medium text-foreground flex items-center gap-2">
            <Users className="h-3 w-3" />
            Minimum Capacity
          </Label>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCapacity(Math.max(1, capacity - 1))}
              disabled={capacity <= 1}
              className="h-8 w-8 p-0 bg-background border-input text-foreground hover:bg-accent"
            >
              -
            </Button>
            <div className="flex-1 text-center font-medium text-foreground">{capacity}</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCapacity(capacity + 1)}
              className="h-8 w-8 p-0 bg-background border-input text-foreground hover:bg-accent"
            >
              +
            </Button>
          </div>
        </div>

        {/* Time Window */}
        <TimeRangePicker
          startTime={timeStart}
          endTime={timeEnd}
          onStartTimeChange={setTimeStart}
          onEndTimeChange={setTimeEnd}
          onClear={() => {
            setTimeStart("")
            setTimeEnd("")
          }}
          label="Time Window"
        />

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 transition-colors"
          disabled={isSearching}
        >
          <Search className="mr-2 h-3 w-3" />
          {isSearching ? "Searching..." : "Search Rooms"}
        </Button>
      </div>
    </div>
  )
}
