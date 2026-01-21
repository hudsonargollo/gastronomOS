"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ChevronDown, Search, X, Loader2 } from "lucide-react"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { transitions } from "@/lib/animation-utils"

export interface AutocompleteOption {
  value: string
  label: string
  description?: string
  category?: string
  disabled?: boolean
  metadata?: Record<string, any>
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string | string[]
  onValueChange: (value: string | string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  multiple?: boolean
  disabled?: boolean
  loading?: boolean
  allowCustomValues?: boolean
  onSearch?: (query: string) => void
  className?: string
  maxDisplayItems?: number
  renderOption?: (option: AutocompleteOption) => React.ReactNode
  renderValue?: (option: AutocompleteOption) => React.ReactNode
}

const listVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      staggerChildren: 0.05
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
}

const Autocomplete: React.FC<AutocompleteProps> = ({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search options...",
  emptyMessage = "No options found",
  multiple = false,
  disabled = false,
  loading = false,
  allowCustomValues = false,
  onSearch,
  className,
  maxDisplayItems = 5,
  renderOption,
  renderValue
}) => {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [customValue, setCustomValue] = React.useState("")

  // Convert value to array for consistent handling
  const selectedValues = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  // Get selected options
  const selectedOptions = React.useMemo(() => {
    return options.filter(option => selectedValues.includes(option.value))
  }, [options, selectedValues])

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options

    return options.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.category?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [options, searchQuery])

  // Group options by category
  const groupedOptions = React.useMemo(() => {
    const groups: Record<string, AutocompleteOption[]> = {}
    
    filteredOptions.forEach(option => {
      const category = option.category || "Other"
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(option)
    })

    return groups
  }, [filteredOptions])

  // Handle option selection
  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue]
      onValueChange(newValues)
    } else {
      onValueChange(optionValue)
      setOpen(false)
    }
  }

  // Handle custom value addition
  const handleAddCustomValue = () => {
    if (!customValue.trim() || !allowCustomValues) return

    const newOption: AutocompleteOption = {
      value: customValue,
      label: customValue,
      category: "Custom"
    }

    // Add to options if not exists
    if (!options.find(opt => opt.value === customValue)) {
      options.push(newOption)
    }

    handleSelect(customValue)
    setCustomValue("")
  }

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  // Remove selected value (for multiple mode)
  const removeValue = (valueToRemove: string) => {
    if (multiple) {
      const newValues = selectedValues.filter(v => v !== valueToRemove)
      onValueChange(newValues)
    }
  }

  // Render display value
  const renderDisplayValue = () => {
    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>
    }

    if (multiple) {
      const displayOptions = selectedOptions.slice(0, maxDisplayItems)
      const remainingCount = selectedOptions.length - maxDisplayItems

      return (
        <div className="flex flex-wrap gap-1">
          <AnimatePresence>
            {displayOptions.map((option) => (
              <motion.div
                key={option.value}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={transitions.fast}
              >
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  {renderValue ? renderValue(option) : option.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-3 w-3 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeValue(option.value)
                    }}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {remainingCount > 0 && (
            <Badge variant="outline" className="text-xs">
              +{remainingCount} more
            </Badge>
          )}
        </div>
      )
    }

    const option = selectedOptions[0]
    return renderValue ? renderValue(option) : option.label
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-[40px] h-auto",
            !selectedValues.length && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <div className="flex-1 text-left overflow-hidden">
            {renderDisplayValue()}
          </div>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchQuery}
              onValueChange={handleSearch}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <CommandList className="max-h-[300px]">
            <AnimatePresence>
              {loading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-6"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </motion.div>
              ) : Object.keys(groupedOptions).length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <CommandEmpty>{emptyMessage}</CommandEmpty>
                  
                  {allowCustomValues && searchQuery && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        onClick={() => {
                          setCustomValue(searchQuery)
                          handleAddCustomValue()
                        }}
                      >
                        Add "{searchQuery}"
                      </Button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                >
                  {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
                    <CommandGroup key={category} heading={category !== "Other" ? category : undefined}>
                      {categoryOptions.map((option) => (
                        <motion.div key={option.value} variants={itemVariants}>
                          <CommandItem
                            value={option.value}
                            onSelect={() => handleSelect(option.value)}
                            disabled={option.disabled}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="flex-1">
                                {renderOption ? renderOption(option) : (
                                  <div>
                                    <div className="font-medium">{option.label}</div>
                                    {option.description && (
                                      <div className="text-sm text-muted-foreground">
                                        {option.description}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <AnimatePresence>
                              {selectedValues.includes(option.value) && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0 }}
                                  transition={transitions.fast}
                                >
                                  <Check className="h-4 w-4" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CommandItem>
                        </motion.div>
                      ))}
                    </CommandGroup>
                  ))}
                  
                  {allowCustomValues && searchQuery && !filteredOptions.find(opt => opt.value === searchQuery) && (
                    <div className="p-2 border-t">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        onClick={() => {
                          setCustomValue(searchQuery)
                          handleAddCustomValue()
                        }}
                      >
                        Add "{searchQuery}"
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Autocomplete }