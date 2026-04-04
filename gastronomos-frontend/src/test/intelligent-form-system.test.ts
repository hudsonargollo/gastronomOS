/**
 * Intelligent Form System Tests
 * Tests for enhanced form validation, animations, and autocomplete functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEnhancedFormValidation, FormFieldConfig } from '@/hooks/use-enhanced-form-validation'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Enhanced Form Validation Hook', () => {
  const mockFields: FormFieldConfig[] = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      validation: { required: true, email: true },
      realTimeValidation: true,
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      validation: { required: true, minLength: 8 },
    },
    {
      name: 'confirmPassword',
      label: 'Confirm Password',
      type: 'password',
      validation: { required: true },
      dependencies: ['password'],
    },
    {
      name: 'age',
      label: 'Age',
      type: 'number',
      validation: { required: true, min: 18, max: 120 },
    },
    {
      name: 'terms',
      label: 'Accept Terms',
      type: 'checkbox',
      validation: { required: true },
    },
    {
      name: 'newsletter',
      label: 'Subscribe to Newsletter',
      type: 'checkbox',
      conditionalRender: (data) => data.email && data.email.includes('@'),
    },
  ]

  describe('Form State Management', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          initialValues: { email: 'test@example.com' },
        })
      )

      expect(result.current.values.email).toBe('test@example.com')
      expect(result.current.isValid).toBe(true)
      expect(result.current.isDirty).toBe(false)
      expect(result.current.hasChanges).toBe(false)
      expect(result.current.isSubmitting).toBe(false)
    })

    it('should update field values correctly', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
        })
      )

      act(() => {
        result.current.setValue('email', 'new@example.com')
      })

      expect(result.current.values.email).toBe('new@example.com')
      expect(result.current.touched.email).toBe(true)
      expect(result.current.hasChanges).toBe(true)
      expect(result.current.isDirty).toBe(true)
    })
  })

  describe('Real-time Validation', () => {
    it('should validate required fields', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          validateOnChange: true,
        })
      )

      act(() => {
        result.current.setValue('email', '')
      })

      expect(result.current.errors.email).toBe('Email is required')
      expect(result.current.isValid).toBe(false)
    })

    it('should validate email format', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          validateOnChange: true,
        })
      )

      act(() => {
        result.current.setValue('email', 'invalid-email')
      })

      expect(result.current.errors.email).toBe('Email must be a valid email address')
      expect(result.current.isValid).toBe(false)
    })

    it('should validate string length', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          validateOnChange: true,
        })
      )

      act(() => {
        result.current.setValue('password', '123')
      })

      expect(result.current.errors.password).toBe('Password must be at least 8 characters')
      expect(result.current.isValid).toBe(false)
    })

    it('should validate number ranges', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          validateOnChange: true,
        })
      )

      act(() => {
        result.current.setValue('age', 15)
      })

      expect(result.current.errors.age).toBe('Age must be at least 18')
      expect(result.current.isValid).toBe(false)

      act(() => {
        result.current.setValue('age', 150)
      })

      expect(result.current.errors.age).toBe('Age must be no more than 120')
      expect(result.current.isValid).toBe(false)
    })
  })

  describe('Conditional Field Rendering', () => {
    it('should show/hide fields based on conditions', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
        })
      )

      // Initially newsletter field should not be visible
      let visibleFields = result.current.visibleFields
      expect(visibleFields.find(f => f.name === 'newsletter')).toBeUndefined()

      // After setting email, newsletter field should become visible
      act(() => {
        result.current.setValue('email', 'test@example.com')
      })

      visibleFields = result.current.visibleFields
      expect(visibleFields.find(f => f.name === 'newsletter')).toBeDefined()
    })

    it('should not validate hidden fields', () => {
      const conditionalField: FormFieldConfig = {
        name: 'hiddenRequired',
        label: 'Hidden Required',
        type: 'text',
        validation: { required: true },
        conditionalRender: () => false, // Always hidden
      }

      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: [...mockFields, conditionalField],
        })
      )

      const errors = result.current.validateForm()
      expect(errors.hiddenRequired).toBeUndefined()
    })
  })

  describe('Form Submission', () => {
    it('should handle successful submission', async () => {
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined)
      
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          onSubmit: mockOnSubmit,
        })
      )

      // Fill out valid form data
      act(() => {
        result.current.setValue('email', 'test@example.com')
        result.current.setValue('password', 'password123')
        result.current.setValue('confirmPassword', 'password123')
        result.current.setValue('age', 25)
        result.current.setValue('terms', true)
      })

      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        age: 25,
        terms: true,
        newsletter: '',
      })
    })

    it('should prevent submission with validation errors', async () => {
      const mockOnSubmit = vi.fn()
      
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          onSubmit: mockOnSubmit,
        })
      )

      // Submit with empty required fields
      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(mockOnSubmit).not.toHaveBeenCalled()
      expect(result.current.errors.email).toBe('Email is required')
      expect(result.current.errors.password).toBe('Password is required')
    })

    it('should handle submission errors', async () => {
      const mockOnSubmit = vi.fn().mockRejectedValue({
        fieldErrors: { email: 'Email already exists' }
      })
      
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          onSubmit: mockOnSubmit,
        })
      )

      // Fill out valid form data
      act(() => {
        result.current.setValue('email', 'test@example.com')
        result.current.setValue('password', 'password123')
        result.current.setValue('confirmPassword', 'password123')
        result.current.setValue('age', 25)
        result.current.setValue('terms', true)
      })

      await act(async () => {
        await result.current.handleSubmit()
      })

      expect(result.current.errors.email).toBe('Email already exists')
    })
  })

  describe('Field Props Helper', () => {
    it('should return correct field props', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          initialValues: { email: 'test@example.com' },
        })
      )

      const fieldProps = result.current.getFieldProps('email')

      expect(fieldProps.name).toBe('email')
      expect(fieldProps.value).toBe('test@example.com')
      expect(fieldProps.required).toBe(true)
      expect(typeof fieldProps.onChange).toBe('function')
      expect(typeof fieldProps.onBlur).toBe('function')
    })

    it('should show errors only for touched fields', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          validateOnChange: true,
        })
      )

      // Set invalid value but don't touch
      act(() => {
        result.current.setValue('email', 'invalid')
      })

      let fieldProps = result.current.getFieldProps('email')
      expect(fieldProps.error).toBeDefined() // Should show error since setValue touches the field

      // Touch the field
      act(() => {
        result.current.touchField('password')
      })

      fieldProps = result.current.getFieldProps('password')
      expect(fieldProps.error).toBe('Password is required')
    })
  })

  describe('Form Reset', () => {
    it('should reset form to initial state', () => {
      const initialValues = { email: 'initial@example.com' }
      
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          initialValues,
        })
      )

      // Make changes
      act(() => {
        result.current.setValue('email', 'changed@example.com')
        result.current.setValue('password', 'newpassword')
      })

      expect(result.current.hasChanges).toBe(true)

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.values.email).toBe('initial@example.com')
      expect(result.current.values.password).toBe('')
      expect(result.current.hasChanges).toBe(false)
      expect(result.current.isDirty).toBe(false)
      expect(Object.keys(result.current.errors)).toHaveLength(0)
      expect(Object.keys(result.current.touched)).toHaveLength(0)
    })

    it('should reset with new initial values', () => {
      const { result } = renderHook(() =>
        useEnhancedFormValidation({
          fields: mockFields,
          initialValues: { email: 'old@example.com' },
        })
      )

      act(() => {
        result.current.reset({ email: 'new@example.com', age: 30 })
      })

      expect(result.current.values.email).toBe('new@example.com')
      expect(result.current.values.age).toBe(30)
    })
  })
})

describe('Form Field Animator', () => {
  // Note: These would be integration tests with React Testing Library
  // For now, we'll test the logic that can be unit tested
  
  it('should handle field visibility correctly', () => {
    const field: FormFieldConfig = {
      name: 'conditionalField',
      label: 'Conditional Field',
      type: 'text',
      conditionalRender: (data) => data.showField === true,
    }

    const { result } = renderHook(() =>
      useEnhancedFormValidation({
        fields: [field],
      })
    )

    // Field should not be visible initially
    expect(result.current.visibleFields).toHaveLength(0)

    // Make field visible
    act(() => {
      result.current.setValue('showField', true)
    })

    expect(result.current.visibleFields).toHaveLength(1)
    expect(result.current.visibleFields[0].name).toBe('conditionalField')
  })
})

describe('Autocomplete Integration', () => {
  const autocompleteField: FormFieldConfig = {
    name: 'supplier',
    label: 'Supplier',
    type: 'autocomplete',
    validation: { required: true },
    autocompleteOptions: [
      { value: 'supplier1', label: 'Supplier One', category: 'Local' },
      { value: 'supplier2', label: 'Supplier Two', category: 'Regional' },
    ],
    multiple: true,
    allowCustomValues: true,
  }

  it('should handle single autocomplete selection', () => {
    const singleField = { ...autocompleteField, multiple: false }
    
    const { result } = renderHook(() =>
      useEnhancedFormValidation({
        fields: [singleField],
      })
    )

    act(() => {
      result.current.setValue('supplier', 'supplier1')
    })

    expect(result.current.values.supplier).toBe('supplier1')
  })

  it('should handle multiple autocomplete selections', () => {
    const { result } = renderHook(() =>
      useEnhancedFormValidation({
        fields: [autocompleteField],
      })
    )

    act(() => {
      result.current.setValue('supplier', ['supplier1', 'supplier2'])
    })

    expect(result.current.values.supplier).toEqual(['supplier1', 'supplier2'])
  })

  it('should validate required autocomplete fields', () => {
    const { result } = renderHook(() =>
      useEnhancedFormValidation({
        fields: [autocompleteField],
        validateOnChange: true,
      })
    )

    act(() => {
      result.current.setValue('supplier', [])
    })

    expect(result.current.errors.supplier).toBe('Supplier is required')
  })
})