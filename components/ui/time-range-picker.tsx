"use client"

import { useState, useEffect } from "react"
import { Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimeRangePickerProps {
  startTime: string
  endTime: string
  onStartTimeChange: (time: string) => void
  onEndTimeChange: (time: string) => void
  onClear: () => void
  label?: string
}

// Generate time options in 30-minute intervals
const generateTimeOptions = () => {
  const options = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const display = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      options.push({ value: time, label: display })
    }
  }
  return options
}

const timeOptions = generateTimeOptions()

export function TimeRangePicker({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  onClear,
  label = "Time Range"
}: TimeRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const getDisplayText = () => {
    if (startTime && endTime) {
      const start = timeOptions.find(opt => opt.value === startTime)?.label
      const end = timeOptions.find(opt => opt.value === endTime)?.label
      return `${start} - ${end}`
    }
    if (startTime) {
      const start = timeOptions.find(opt => opt.value === startTime)?.label
      return `From ${start}`
    }
    return "Select time range"
  }

  const isValid = startTime && endTime && startTime < endTime
  const hasSelection = startTime || endTime

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-foreground flex items-center gap-2">
        <Clock className="h-3 w-3" />
        {label}
        <span className="text-muted-foreground">(Optional)</span>
      </Label>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between text-left font-normal bg-background border-input hover:bg-accent ${
              isValid ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span className="text-xs">{getDisplayText()}</span>
            </div>
            {hasSelection && (
              <span
                className="h-4 w-4 p-0 hover:bg-accent cursor-pointer rounded flex items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  onClear()
                }}
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-background border-input" align="start">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Start Time</Label>
                <div className="max-h-32 overflow-y-auto border border-input rounded bg-card">
                  {timeOptions.map((option) => (
                    <button
                      key={`start-${option.value}`}
                      onClick={() => onStartTimeChange(option.value)}
                      className={`w-full text-left px-2 py-1 text-xs hover:bg-accent transition-colors ${
                        startTime === option.value ? 'bg-accent text-foreground' : 'text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">End Time</Label>
                <div className="max-h-32 overflow-y-auto border border-input rounded bg-card">
                  {timeOptions.map((option) => (
                    <button
                      key={`end-${option.value}`}
                      onClick={() => onEndTimeChange(option.value)}
                      disabled={!startTime || option.value <= startTime}
                      className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                        !startTime || option.value <= startTime
                          ? 'text-muted-foreground cursor-not-allowed'
                          : endTime === option.value
                          ? 'bg-accent text-foreground'
                          : 'text-foreground hover:bg-accent'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {startTime && endTime && (
              <div className="text-xs text-muted-foreground bg-card p-2 rounded">
                Selected: {getDisplayText()}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-input">
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                className="text-xs border-input text-muted-foreground hover:bg-accent"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                disabled={!isValid}
                className="text-xs bg-accent hover:bg-accent"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}