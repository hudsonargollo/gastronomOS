// @ts-nocheck
import { useState, useCallback, useMemo } from 'react'
import { z } from 'zod'

export interface ValidationRule<T = any> {
  required?: boolean | string
  min?: number | string
  max?: number | string
  pattern?: RegExp | string
  custom?: (value: T) => string | null
  email?: boolean | string
  url?: boolean | string
  numeric?: boolean | string
  integer?: boolean | string
  positive?: boolean | string
  minLength?: number | string
  maxLength?: number | string
  oneOf?: T[] | string
  schema?: z.ZodSchema<T>
}

export interface FieldConfig<T = any> {
  name: string
  rules?: ValidationRule<T>
  dependencies?: string[]
  transform?: (value: any) => T
}

export interface FormValidationConfig {
  fields: Record<string, FieldConfig>
  validateOnChange?: boolean
  validateOnBlur?: boolean
  stopOnFirstError?: boolean
}

export interface ValidationError {
  field: string
  message: string
  rule: string
}

export interface FormValidationState {
  values: Record<string, any>
  errors: Record<string, string>
  touched: Record<string, boolean>
  isValid: boolean
  isValidating: boolean
  isDirty: boolean
}

export function useFormValidation(config: FormValidationConfig, initialValues: Record<string, any> = {}) {
  const [state, setState] = useState<FormValidationState>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true,
    isValidating: false,
    isDirty: false,
  })

  const validateField = useCallback((fieldName: string, value: any, allValues: Record<string, any> = state.values): string | null => {
    const fieldConfig = config.fields[fieldName]
    if (!fieldConfig?.rules) return null

    const rules = fieldConfig.rules
    const transformedValue = fieldConfig.transform ? fieldConfig.transform(value) : value

    // Required validation
    if (rules.required) {
      const isEmpty = value === null || value === undefined || value === '' || 
                     (Array.isArray(value) && value.length === 0)
      if (isEmpty) {
        return typeof rules.required === 'string' ? rules.required : `${fieldName} is required`
      }
    }

    // Skip other validations if value is empty and not required
    if (value === null || value === undefined || value === '') {
      return null
    }

    // Schema validation (takes precedence)
    if (rules.schema) {
      try {
        rules.schema.parse(transformedValue)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return error.errors[0]?.message || 'Invalid value'
        }
        return 'Validation error'
      }
    }

    // Email validation
    if (rules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(String(value))) {
        return typeof rules.email === 'string' ? rules.email : 'Invalid email address'
      }
    }

    // URL validation
    if (rules.url) {
      try {
        new URL(String(value))
      } catch {
        return typeof rules.url === 'string' ? rules.url : 'Invalid URL'
      }
    }

    // Numeric validation
    if (rules.numeric) {
      if (isNaN(Number(value))) {
        return typeof rules.numeric === 'string' ? rules.numeric : 'Must be a number'
      }
    }

    // Integer validation
    if (rules.integer) {
      if (!Number.isInteger(Number(value))) {
        return typeof rules.integer === 'string' ? rules.integer : 'Must be an integer'
      }
    }

    // Positive validation
    if (rules.positive) {
      if (Number(value) <= 0) {
        return typeof rules.positive === 'string' ? rules.positive : 'Must be positive'
      }
    }

    // Min/Max validation
    if (rules.min !== undefined) {
      const minValue = Number(rules.min)
      if (Number(value) < minValue) {
        return typeof rules.min === 'string' ? rules.min : `Must be at least ${minValue}`
      }
    }

    if (rules.max !== undefined) {
      const maxValue = Number(rules.max)
      if (Number(value) > maxValue) {
        return typeof rules.max === 'string' ? rules.max : `Must be at most ${maxValue}`
      }
    }

    // Length validation
    if (rules.minLength !== undefined) {
      const minLength = Number(rules.minLength)
      if (String(value).length < minLength) {
        return typeof rules.minLength === 'string' ? rules.minLength : `Must be at least ${minLength} characters`
      }
    }

    if (rules.maxLength !== undefined) {
      const maxLength = Number(rules.maxLength)
      if (String(value).length > maxLength) {
        return typeof rules.maxLength === 'string' ? rules.maxLength : `Must be at most ${maxLength} characters`
      }
    }

    // Pattern validation
    if (rules.pattern) {
      const pattern = rules.pattern instanceof RegExp ? rules.pattern : new RegExp(rules.pattern)
      if (!pattern.test(String(value))) {
        return typeof rules.pattern === 'string' ? rules.pattern : 'Invalid format'
      }
    }

    // OneOf validation
    if (rules.oneOf) {
      const validValues = Array.isArray(rules.oneOf) ? rules.oneOf : []
      if (!validValues.includes(value)) {
        return typeof rules.oneOf === 'string' ? rules.oneOf : `Must be one of: ${validValues.join(', ')}`
      }
    }

    // Custom validation
    if (rules.custom) {
      const customError = rules.custom(transformedValue)
      if (customError) {
        return customError
      }
    }

    return null
  }, [config.fields, state.values])

  const validateForm = useCallback((values: Record<string, any> = state.values): Record<string, string> => {
    const errors: Record<string, string> = {}

    for (const fieldName of Object.keys(config.fields)) {
      const error = validateField(fieldName, values[fieldName], values)
      if (error) {
        errors[fieldName] = error
        if (config.stopOnFirstError) break
      }
    }

    return errors
  }, [config.fields, config.stopOnFirstError, validateField, state.values])

  const setValue = useCallback((fieldName: string, value: any, shouldValidate = config.validateOnChange) => {
    setState(prevState => {
      const newValues = { ...prevState.values, [fieldName]: value }
      const newErrors = { ...prevState.errors }
      
      if (shouldValidate) {
        const fieldError = validateField(fieldName, value, newValues)
        if (fieldError) {
          newErrors[fieldName] = fieldError
        } else {
          delete newErrors[fieldName]
        }

        // Validate dependent fields
        const fieldConfig = config.fields[fieldName]
        if (fieldConfig?.dependencies) {
          for (const depField of fieldConfig.dependencies) {
            const depError = validateField(depField, newValues[depField], newValues)
            if (depError) {
              newErrors[depField] = depError
            } else {
              delete newErrors[depField]
            }
          }
        }
      }

      return {
        ...prevState,
        values: newValues,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
        isDirty: true,
      }
    })
  }, [config.validateOnChange, config.fields, validateField])

  const setValues = useCallback((values: Record<string, any>, shouldValidate = false) => {
    setState(prevState => {
      const newErrors = shouldValidate ? validateForm(values) : prevState.errors
      
      return {
        ...prevState,
        values,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
        isDirty: true,
      }
    })
  }, [validateForm])

  const setTouched = useCallback((fieldName: string, touched = true, shouldValidate = config.validateOnBlur) => {
    setState(prevState => {
      const newTouched = { ...prevState.touched, [fieldName]: touched }
      const newErrors = { ...prevState.errors }
      
      if (shouldValidate && touched) {
        const fieldError = validateField(fieldName, prevState.values[fieldName], prevState.values)
        if (fieldError) {
          newErrors[fieldName] = fieldError
        } else {
          delete newErrors[fieldName]
        }
      }

      return {
        ...prevState,
        touched: newTouched,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
      }
    })
  }, [config.validateOnBlur, validateField])

  const validateAll = useCallback(async (): Promise<boolean> => {
    setState(prevState => ({ ...prevState, isValidating: true }))
    
    const errors = validateForm()
    const isValid = Object.keys(errors).length === 0
    
    setState(prevState => ({
      ...prevState,
      errors,
      isValid,
      isValidating: false,
      touched: Object.keys(config.fields).reduce((acc, field) => ({ ...acc, [field]: true }), {}),
    }))

    return isValid
  }, [validateForm, config.fields])

  const reset = useCallback((newValues: Record<string, any> = initialValues) => {
    setState({
      values: newValues,
      errors: {},
      touched: {},
      isValid: true,
      isValidating: false,
      isDirty: false,
    })
  }, [initialValues])

  const clearErrors = useCallback((fieldNames?: string[]) => {
    setState(prevState => {
      const newErrors = { ...prevState.errors }
      
      if (fieldNames) {
        fieldNames.forEach(field => delete newErrors[field])
      } else {
        Object.keys(newErrors).forEach(field => delete newErrors[field])
      }

      return {
        ...prevState,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
      }
    })
  }, [])

  const getFieldProps = useCallback((fieldName: string) => ({
    value: state.values[fieldName] ?? '',
    onChange: (value: any) => setValue(fieldName, value),
    onBlur: () => setTouched(fieldName, true),
    error: state.touched[fieldName] ? state.errors[fieldName] : undefined,
    touched: state.touched[fieldName] ?? false,
  }), [state.values, state.errors, state.touched, setValue, setTouched])

  const formProps = useMemo(() => ({
    onSubmit: async (e: React.FormEvent) => {
      e.preventDefault()
      return await validateAll()
    },
  }), [validateAll])

  return {
    ...state,
    setValue,
    setValues,
    setTouched,
    validateField,
    validateForm,
    validateAll,
    reset,
    clearErrors,
    getFieldProps,
    formProps,
  }
}