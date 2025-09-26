"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon, Search } from "lucide-react"
import { format } from "date-fns"
import { useSites } from "@/hooks/use-sites"

interface AvailabilityFiltersProps {
  onSearch: (filters: SearchFilters) => void
}

export interface SearchFilters {
  sites: string[]
  capacityMin: number
  date: Date
  timeWindow?: { start: string; end: string }
}

export function AvailabilityFilters({ onSearch }: AvailabilityFiltersProps) {
  const { sites, loading } = useSites()
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [capacity, setCapacity] = useState(1)
  const [date, setDate] = useState<Date>(new Date())
  const [timeStart, setTimeStart] = useState("")
  const [timeEnd, setTimeEnd] = useState("")
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)

  // Initialize with all sites selected when they load
  useEffect(() => {
    if (sites.length > 0 && selectedSites.length === 0) {
      setSelectedSites(sites.map(s => s.name))
    }
  }, [sites])

  const handleSiteToggle = (siteId: string) => {
    setSelectedSites((prev) =>
      prev.includes(siteId)
        ? prev.filter((id) => id !== siteId)
        : [...prev, siteId]
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
    <div className="space-y-6 rounded border bg-card p-6">
      <div>
        <h2 className="text-lg font-semibold text-card-foreground">Search Filters</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Find available rooms across all office locations
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Sites Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Office Locations</label>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading sites...</div>
          ) : (
            <div className="space-y-2">
              {sites.map((site) => (
                <div key={site.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={site.id}
                    checked={selectedSites.includes(site.name)}
                    onCheckedChange={() => handleSiteToggle(site.name)}
                  />
                  <label
                    htmlFor={site.id}
                    className="text-sm text-foreground cursor-pointer select-none"
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
          <Label htmlFor="capacity">Minimum Capacity</Label>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCapacity(Math.max(1, capacity - 1))}
              disabled={capacity <= 1}
            >
              -
            </Button>
            <div className="w-12 text-center font-medium">{capacity}</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCapacity(capacity + 1)}
            >
              +
            </Button>
          </div>
        </div>

        {/* Date Selection */}
        <div className="space-y-3">
          <Label>Date</Label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    setDate(d)
                    setIsDatePickerOpen(false)
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Time Window */}
        <div className="space-y-3">
          <Label>Time Window (Optional)</Label>
          <div className="flex items-center space-x-2">
            <input
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Start"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="End"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSearch} className="min-w-[120px]">
          <Search className="mr-2 h-4 w-4" />
          Search Rooms
        </Button>
      </div>
    </div>
  )
}