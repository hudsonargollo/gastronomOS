"use client"

import * as React from "react"
import { useForm, Controller, FieldValues, Path, PathValue } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

export type FieldType = 
  | 'text' 
  | 'email' 
  | 'password' 
  | 'number' 
  | 'textarea' 
  | 'select' 
  | 'checkbox' 
  | 'switch' 
  | 'date' 
  | 'datetime-local'
  | 'file'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface FormField {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  description?: string
  required?: boolean
  disabled?: boolean
  options?: SelectOption[] // For select fields
  accept?: string // For file fields
  min?: number // For number fields
  max?: number // For number fields
  step?: number // For number fields
  rows?: number // For textarea fields
  className?: string
  validation?: z.ZodSchema<any>
}

export interface ModalFormProps<T extends FieldValues> {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: T) => Promise<void>
  title: string
  description?: string
  initialData?: Partial<T>
  fields: FormField[]
  schema: z.ZodSchema<T>
  submitLabel?: string
  cancelLabel?: string
  loading?: boolean
  className?: string
}

function ModalForm<T extends FieldValues>({
  isOpen,
  onClose,
  onSubmit,
  title,
  description,
  initialData,
  fields,
  schema,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  loading: externalLoading = false,
  className,
}: ModalFormProps<T>) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
  } = useForm<T>({
    // resolver: zodResolver(schema) as any,
    defaultValues: initialData as any,
    mode: "onChange",
  })

  // Reset form when modal opens/closes or initialData changes
  React.useEffect(() => {
    if (isOpen) {
      reset(initialData as T)
    }
  }, [isOpen, initialData, reset])

  const handleFormSubmit = async (data: T) => {
    if (isSubmitting || externalLoading) return

    setIsSubmitting(true)
    try {
      await onSubmit(data)
      toast.success("Changes saved successfully")
      onClose()
      reset()
    } catch (error) {
      console.error("Form submission error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save changes")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting || externalLoading) return
    onClose()
    reset()
  }

  const renderField = (field: FormField) => {
    const error = errors[field.name as Path<T>]
    const fieldId = `field-${field.name}`

    return (
      <div key={field.name} className={cn("space-y-2", field.className)}>
        <Label htmlFor={fieldId} className={cn(field.required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
          {field.label}
        </Label>
        
        <Controller
          name={field.name as Path<T>}
          control={control}
          render={({ field: controllerField }) => {
            switch (field.type) {
              case 'textarea':
                return (
                  <Textarea
                    id={fieldId}
                    placeholder={field.placeholder}
                    disabled={field.disabled || isSubmitting || externalLoading}
                    rows={field.rows || 3}
                    {...controllerField}
                    className={cn(error && "border-red-500")}
                  />
                )

              case 'select':
                return (
                  <Select
                    value={controllerField.value || ""}
                    onValueChange={controllerField.onChange}
                    disabled={field.disabled || isSubmitting || externalLoading}
                  >
                    <SelectTrigger id={fieldId} className={cn(error && "border-red-500")}>
                      <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem 
                          key={option.value} 
                          value={option.value}
                          disabled={option.disabled}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )

              case 'checkbox':
                return (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={fieldId}
                      checked={controllerField.value || false}
                      onCheckedChange={controllerField.onChange}
                      disabled={field.disabled || isSubmitting || externalLoading}
                    />
                    <Label htmlFor={fieldId} className="text-sm font-normal">
                      {field.description || field.label}
                    </Label>
                  </div>
                )

              case 'switch':
                return (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={fieldId}
                      checked={controllerField.value || false}
                      onCheckedChange={controllerField.onChange}
                      disabled={field.disabled || isSubmitting || externalLoading}
                    />
                    <Label htmlFor={fieldId} className="text-sm font-normal">
                      {field.description || field.label}
                    </Label>
                  </div>
                )

              case 'date':
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id={fieldId}
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !controllerField.value && "text-muted-foreground",
                          error && "border-red-500"
                        )}
                        disabled={field.disabled || isSubmitting || externalLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {controllerField.value ? (
                          format(new Date(controllerField.value), "PPP")
                        ) : (
                          <span>{field.placeholder || "Pick a date"}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={controllerField.value ? new Date(controllerField.value) : undefined}
                        onSelect={(date) => controllerField.onChange(date?.toISOString())}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )

              case 'file':
                return (
                  <Input
                    id={fieldId}
                    type="file"
                    accept={field.accept}
                    disabled={field.disabled || isSubmitting || externalLoading}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      controllerField.onChange(file)
                    }}
                    className={cn(error && "border-red-500")}
                  />
                )

              case 'number':
                return (
                  <Input
                    id={fieldId}
                    type="number"
                    placeholder={field.placeholder}
                    disabled={field.disabled || isSubmitting || externalLoading}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    {...controllerField}
                    onChange={(e) => {
                      const value = e.target.value === '' ? undefined : Number(e.target.value)
                      controllerField.onChange(value)
                    }}
                    className={cn(error && "border-red-500")}
                  />
                )

              default:
                return (
                  <Input
                    id={fieldId}
                    type={field.type}
                    placeholder={field.placeholder}
                    disabled={field.disabled || isSubmitting || externalLoading}
                    {...controllerField}
                    className={cn(error && "border-red-500")}
                  />
                )
            }
          }}
        />

        {field.description && field.type !== 'checkbox' && field.type !== 'switch' && (
          <p className="text-sm text-muted-foreground">{field.description}</p>
        )}

        {error && (
          <p className="text-sm text-red-500">{error.message as string}</p>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("max-w-2xl max-h-[90vh] overflow-y-auto", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid gap-6">
            {fields.map(renderField)}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || externalLoading}
            >
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isSubmitting || externalLoading || !isDirty}
            >
              {(isSubmitting || externalLoading) && (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              )}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { ModalForm }