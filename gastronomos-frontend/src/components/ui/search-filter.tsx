"use client"

import * as React from "react"
import { SearchIcon, FilterIcon, XIcon } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface FilterOption {
  key: string
  label: string
  type: 'select' | 'text' | 'number' | 'date' | 'boolean'
  options?: { value: string; label: string }[]
  placeholder?: string
  min?: number
  max?: number
}

export interface FilterValue {
  [key: string]: any
}

export interface SearchFilterProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterOption[]
  filterValues?: FilterValue
  onFilterChange?: (filters: FilterValue) => void
  onClearFilters?: () => void
  className?: string
  showFilterCount?: boolean
}

function SearchFilter({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,
  className,
  showFilterCount = true,
}: SearchFilterProps) {
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue)
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  
  // Debounce search input
  const debouncedSearchValue = useDebounce(localSearchValue, 300)

  // Update search when debounced value changes
  React.useEffect(() => {
    if (onSearchChange && debouncedSearchValue !== searchValue) {
      onSearchChange(debouncedSearchValue)
    }
  }, [debouncedSearchValue, onSearchChange, searchValue])

  // Sync local search value with prop
  React.useEffect(() => {
    setLocalSearchValue(searchValue)
  }, [searchValue])

  const activeFilterCount = React.useMemo(() => {
    return Object.values(filterValues).filter(value => 
      value !== undefined && value !== null && value !== ""
    ).length
  }, [filterValues])

  const handleFilterChange = (key: string, value: any) => {
    if (!onFilterChange) return
    
    const newFilters = { ...filterValues }
    if (value === undefined || value === null || value === "") {
      delete newFilters[key]
    } else {
      newFilters[key] = value
    }
    
    onFilterChange(newFilters)
  }

  const handleClearFilters = () => {
    if (onClearFilters) {
      onClearFilters()
    } else if (onFilterChange) {
      onFilterChange({})
    }
  }

  const renderFilterField = (filter: FilterOption) => {
    const value = filterValues[filter.key]

    switch (filter.type) {
      case 'select':
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Select
              value={value || ""}
              onValueChange={(newValue) => handleFilterChange(filter.key, newValue)}
            >
              <SelectTrigger id={filter.key}>
                <SelectValue placeholder={filter.placeholder || `Select ${filter.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )

      case 'text':
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Input
              id={filter.key}
              type="text"
              placeholder={filter.placeholder}
              value={value || ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            />
          </div>
        )

      case 'number':
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Input
              id={filter.key}
              type="number"
              placeholder={filter.placeholder}
              min={filter.min}
              max={filter.max}
              value={value || ""}
              onChange={(e) => {
                const numValue = e.target.value === "" ? undefined : Number(e.target.value)
                handleFilterChange(filter.key, numValue)
              }}
            />
          </div>
        )

      case 'date':
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Input
              id={filter.key}
              type="date"
              value={value || ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            />
          </div>
        )

      case 'boolean':
        return (
          <div key={filter.key} className="space-y-2">
            <Label htmlFor={filter.key}>{filter.label}</Label>
            <Select
              value={value === undefined ? "" : String(value)}
              onValueChange={(newValue) => {
                const boolValue = newValue === "" ? undefined : newValue === "true"
                handleFilterChange(filter.key, boolValue)
              }}
            >
              <SelectTrigger id={filter.key}>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      {/* Search Input */}
      {onSearchChange && (
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={localSearchValue}
            onChange={(e) => setLocalSearchValue(e.target.value)}
            className="pl-8"
          />
          {localSearchValue && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-7 w-7 p-0"
              onClick={() => {
                setLocalSearchValue("")
                onSearchChange("")
              }}
            >
              <XIcon className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      {filters.length > 0 && (
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative">
              <FilterIcon className="mr-2 h-4 w-4" />
              Filters
              {showFilterCount && activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filters</h4>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              
              <Separator />
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filters.map(renderFilterField)}
              </div>
              
              <Separator />
              
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => setIsFilterOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex items-center space-x-1">
          {Object.entries(filterValues)
            .filter(([_, value]) => value !== undefined && value !== null && value !== "")
            .map(([key, value]) => {
              const filter = filters.find(f => f.key === key)
              if (!filter) return null

              let displayValue = String(value)
              if (filter.type === 'select' && filter.options) {
                const option = filter.options.find(opt => opt.value === value)
                displayValue = option?.label || displayValue
              }

              return (
                <Badge
                  key={key}
                  variant="secondary"
                  className="text-xs"
                >
                  {filter.label}: {displayValue}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-3 w-3 p-0 hover:bg-transparent"
                    onClick={() => handleFilterChange(key, undefined)}
                  >
                    <XIcon className="h-2 w-2" />
                  </Button>
                </Badge>
              )
            })}
        </div>
      )}
    </div>
  )
}

export { SearchFilter }