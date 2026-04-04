"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useEnhancedFormValidation, FormFieldConfig } from "@/hooks/use-enhanced-form-validation"
import { modalVariants, fadeInOut, listItemVariants } from "@/lib/animation-utils"
import { FormFieldAnimator } from "@/components/ui/form-field-animator"
import { Autocomplete, AutocompleteOption } from "@/components/ui/autocomplete"

interface EnhancedModalFormProps<T extends Record<string, any>> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: FormFieldConfig[]
  initialValues?: Partial<T>
  onSubmit: (values: T) => Promise<void>
  submitLabel?: string
  cancelLabel?: string
  loading?: boolean
  size?: "sm" | "md" | "lg" | "xl"
  showValidationSummary?: boolean
  enableRealTimeValidation?: boolean
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg", 
  lg: "max-w-2xl",
  xl: "max-w-4xl"
}

function EnhancedModalForm<T extends Record<string, any>>({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialValues,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  loading = false,
  size = "md",
  showValidationSummary = true,
  enableRealTimeValidation = true,
}: EnhancedModalFormProps<T>) {
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    hasChanges,
    setValue,
    handleSubmit,
    reset,
    getFieldProps,
    visibleFields,
  } = useEnhancedFormValidation<T>({
    initialValues,
    fields,
    onSubmit: async (formValues) => {
      await onSubmit(formValues)
      onOpenChange(false)
    },
    validateOnChange: enableRealTimeValidation,
    validateOnBlur: true,
  })

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      reset(initialValues)
    }
  }, [open, initialValues, reset])

  // Get validation summary
  const validationSummary = React.useMemo(() => {
    const errorCount = Object.keys(errors).length
    const touchedCount = Object.keys(touched).length
    const totalFields = visibleFields.filter(f => f.validation?.required).length
    
    return {
      errorCount,
      touchedCount,
      totalFields,
      completionRate: totalFields > 0 ? Math.round(((totalFields - errorCount) / totalFields) * 100) : 100
    }
  }, [errors, touched, visibleFields])

  const renderField = (field: FormFieldConfig) => {
    const fieldProps = getFieldProps(field.name)
    const hasError = !!fieldProps.error
    const isRequired = field.validation?.required
    const isVisible = !field.hidden && (!field.conditionalRender || field.conditionalRender(values))

    const fieldContent = () => {
      switch (field.type) {
        case 'textarea':
          return (
            <Textarea
              {...fieldProps}
              onChange={(e) => fieldProps.onChange(e.target.value)}
              className={hasError ? "border-red-500 focus:border-red-500" : ""}
              rows={4}
            />
          )
        
        case 'select':
          return (
            <Select
              value={fieldProps.value}
              onValueChange={fieldProps.onChange}
              disabled={fieldProps.disabled}
            >
              <SelectTrigger className={hasError ? "border-red-500 focus:border-red-500" : ""}>
                <SelectValue placeholder={fieldProps.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )

        case 'autocomplete':
          return (
            <Autocomplete
              options={field.autocompleteOptions || []}
              value={fieldProps.value}
              onValueChange={fieldProps.onChange}
              placeholder={fieldProps.placeholder}
              disabled={fieldProps.disabled}
              multiple={field.multiple}
              allowCustomValues={field.allowCustomValues}
              onSearch={field.onSearch}
              maxDisplayItems={field.maxDisplayItems}
              className={hasError ? "border-red-500" : ""}
            />
          )
        
        case 'checkbox':
          return (
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={fieldProps.value}
                onCheckedChange={fieldProps.onChange}
                disabled={fieldProps.disabled}
              />
              <Label htmlFor={field.name} className="text-sm font-normal">
                {field.label}
              </Label>
            </div>
          )
        
        case 'number':
          return (
            <Input
              {...fieldProps}
              type="number"
              onChange={(e) => fieldProps.onChange(Number(e.target.value) || '')}
              className={hasError ? "border-red-500 focus:border-red-500" : ""}
            />
          )
        
        case 'date':
          return (
            <Input
              {...fieldProps}
              type="date"
              onChange={(e) => fieldProps.onChange(e.target.value)}
              className={hasError ? "border-red-500 focus:border-red-500" : ""}
            />
          )
        
        default:
          return (
            <Input
              {...fieldProps}
              type={field.type || 'text'}
              onChange={(e) => fieldProps.onChange(e.target.value)}
              className={hasError ? "border-red-500 focus:border-red-500" : ""}
            />
          )
      }
    }

    return (
      <FormFieldAnimator
        key={field.name}
        name={field.name}
        label={field.type !== 'checkbox' ? field.label : undefined}
        error={fieldProps.error}
        isValid={!hasError && fieldProps.value !== '' && fieldProps.value !== undefined}
        isRequired={isRequired}
        isVisible={isVisible}
        description={field.description}
        animationDelay={visibleFields.indexOf(field) * 50}
      >
        {fieldContent()}
      </FormFieldAnimator>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col`}>
        <motion.div
          variants={modalVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex flex-col h-full"
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{title}</span>
              {showValidationSummary && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center space-x-2"
                >
                  {isValid ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {validationSummary.errorCount} errors
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {validationSummary.completionRate}% complete
                  </Badge>
                </motion.div>
              )}
            </DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>

          <motion.div 
            className="flex-1 overflow-y-auto py-4"
            variants={fadeInOut}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <motion.div
                variants={{
                  animate: {
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                initial="initial"
                animate="animate"
                className="space-y-4"
              >
                {visibleFields.map(renderField)}
              </motion.div>
            </form>
          </motion.div>

          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <AnimatePresence>
                  {hasChanges && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        Unsaved changes
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <AnimatePresence>
                  {(isSubmitting || loading) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center space-x-2 text-sm text-muted-foreground"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Saving...</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting || loading}
                >
                  {cancelLabel}
                </Button>
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={!isValid || isSubmitting || loading}
                  className="min-w-[80px]"
                >
                  {isSubmitting || loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    submitLabel
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

export { EnhancedModalForm }