"use client"

import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { CalendarIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  format?: string
  showTime?: boolean
  clearable?: boolean
  minDate?: Date
  maxDate?: Date
}

function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  format: dateFormat = "PPP",
  showTime = false,
  clearable = true,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [timeValue, setTimeValue] = React.useState("")

  // Initialize time value when date changes
  React.useEffect(() => {
    if (value && showTime) {
      setTimeValue(format(value, "HH:mm"))
    }
  }, [value, showTime])

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange?.(undefined)
      return
    }

    let finalDate = selectedDate

    // If showing time and we have a time value, combine them
    if (showTime && timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number)
      if (!isNaN(hours) && !isNaN(minutes)) {
        finalDate = new Date(selectedDate)
        finalDate.setHours(hours, minutes, 0, 0)
      }
    }

    onChange?.(finalDate)
    
    if (!showTime) {
      setIsOpen(false)
    }
  }

  const handleTimeChange = (newTimeValue: string) => {
    setTimeValue(newTimeValue)
    
    if (value) {
      const [hours, minutes] = newTimeValue.split(':').map(Number)
      if (!isNaN(hours) && !isNaN(minutes)) {
        const newDate = new Date(value)
        newDate.setHours(hours, minutes, 0, 0)
        onChange?.(newDate)
      }
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(undefined)
    setTimeValue("")
  }

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const displayFormat = showTime ? `${dateFormat} 'at' HH:mm` : dateFormat

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(value, displayFormat)
          ) : (
            <span>{placeholder}</span>
          )}
          {clearable && value && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-4 w-4 p-0 hover:bg-transparent"
              onClick={handleClear}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleDateSelect}
          disabled={isDateDisabled}
          initialFocus
        />
        
        {showTime && (
          <div className="border-t p-3">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Time:</label>
              <Input
                type="time"
                value={timeValue}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
        )}
        
        <div className="border-t p-3 flex justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export interface DateRangePickerProps {
  value?: { from: Date | undefined; to: Date | undefined }
  onChange?: (range: { from: Date | undefined; to: Date | undefined }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  format?: string
  clearable?: boolean
  minDate?: Date
  maxDate?: Date
}

function DateRangePicker({
  value,
  onChange,
  placeholder = "Pick a date range",
  disabled = false,
  className,
  format: dateFormat = "PPP",
  clearable = true,
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const handleSelect = (range: any) => {
    if (range) {
      onChange?.(range);
    } else {
      onChange?.({ from: undefined, to: undefined });
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.({ from: undefined, to: undefined })
  }

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  const formatRange = () => {
    if (!value?.from) return placeholder
    
    if (value.from && !value.to) {
      return format(value.from, dateFormat)
    }
    
    if (value.from && value.to) {
      return `${format(value.from, dateFormat)} - ${format(value.to, dateFormat)}`
    }
    
    return placeholder
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value?.from && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formatRange()}
          {clearable && value?.from && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-4 w-4 p-0 hover:bg-transparent"
              onClick={handleClear}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={handleSelect}
          disabled={isDateDisabled}
          numberOfMonths={2}
          initialFocus
        />
        <div className="border-t p-3 flex justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DateRangePicker }