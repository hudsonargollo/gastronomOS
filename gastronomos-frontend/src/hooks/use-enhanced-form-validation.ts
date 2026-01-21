import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';

// Import AutocompleteOption type
export interface AutocompleteOption {
  value: string;
  label: string;
  description?: string;
  category?: string;
  disabled?: boolean;
  metadata?: Record<string, any>;
}

// Validation rule types
export type ValidationRule<T = any> = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  custom?: (value: T) => string | null;
  dependencies?: string[];
};

// Field configuration
export interface FormFieldConfig<T = any> {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date' | 'autocomplete';
  placeholder?: string;
  defaultValue?: T;
  validation?: ValidationRule<T>;
  options?: { value: string; label: string }[];
  autocompleteOptions?: AutocompleteOption[];
  disabled?: boolean;
  hidden?: boolean;
  dependencies?: string[];
  conditionalRender?: (formData: Record<string, any>) => boolean;
  realTimeValidation?: boolean;
  description?: string;
  allowCustomValues?: boolean;
  onSearch?: (query: string) => void;
  multiple?: boolean;
  maxDisplayItems?: number;
}

// Form state interface
export interface FormState<T = Record<string, any>> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
  hasChanges: boolean;
}

// Form validation hook
export interface UseEnhancedFormValidationOptions<T = Record<string, any>> {
  initialValues?: Partial<T>;
  fields: FormFieldConfig[];
  onSubmit?: (values: T) => Promise<void> | void;
  onValidationChange?: (isValid: boolean) => void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  resetOnSubmit?: boolean;
}

export function useEnhancedFormValidation<T extends Record<string, any>>({
  initialValues = {},
  fields,
  onSubmit,
  onValidationChange,
  validateOnChange = true,
  validateOnBlur = true,
  resetOnSubmit = false,
}: UseEnhancedFormValidationOptions<T>) {
  // Initialize form state
  const [formState, setFormState] = useState<FormState<T>>(() => {
    const values = fields.reduce((acc, field) => {
      (acc as any)[field.name] = initialValues[field.name] ?? field.defaultValue ?? '';
      return acc;
    }, {} as T);

    return {
      values,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false,
      hasChanges: false,
    };
  });

  // Field configurations map for quick lookup
  const fieldConfigMap = useMemo(() => {
    return fields.reduce((acc, field) => {
      acc[field.name] = field;
      return acc;
    }, {} as Record<string, FormFieldConfig>);
  }, [fields]);

  // Validation functions
  const validateField = useCallback((name: string, value: any): string | null => {
    const field = fieldConfigMap[name];
    if (!field?.validation) return null;

    const { validation } = field;

    // Required validation
    if (validation.required) {
      if (!value || 
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0)) {
        return `${field.label} is required`;
      }
    }

    // Skip other validations if value is empty and not required
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return null;
    }

    // String length validations
    if (typeof value === 'string') {
      if (validation.minLength && value.length < validation.minLength) {
        return `${field.label} must be at least ${validation.minLength} characters`;
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        return `${field.label} must be no more than ${validation.maxLength} characters`;
      }
    }

    // Number validations
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value)))) {
      const numValue = Number(value);
      if (validation.min !== undefined && numValue < validation.min) {
        return `${field.label} must be at least ${validation.min}`;
      }
      if (validation.max !== undefined && numValue > validation.max) {
        return `${field.label} must be no more than ${validation.max}`;
      }
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'string' && !validation.pattern.test(value)) {
      return `${field.label} format is invalid`;
    }

    // Email validation
    if (validation.email && typeof value === 'string') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return `${field.label} must be a valid email address`;
      }
    }

    // URL validation
    if (validation.url && typeof value === 'string') {
      try {
        new URL(value);
      } catch {
        return `${field.label} must be a valid URL`;
      }
    }

    // Custom validation
    if (validation.custom) {
      const customError = validation.custom(value);
      if (customError) {
        return customError;
      }
    }

    return null;
  }, [fieldConfigMap]);

  // Validate all fields
  const validateForm = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};

    fields.forEach((field) => {
      // Skip validation for hidden or conditionally hidden fields
      if (field.hidden || (field.conditionalRender && !field.conditionalRender(formState.values))) {
        return;
      }

      const error = validateField(field.name, formState.values[field.name]);
      if (error) {
        errors[field.name] = error;
      }
    });

    return errors;
  }, [fields, formState.values, validateField]);

  // Update form state
  const updateFormState = useCallback((updates: Partial<FormState<T>>) => {
    setFormState(prev => {
      const newState = { ...prev, ...updates };
      
      // Calculate derived state
      const hasErrors = Object.keys(newState.errors).length > 0;
      newState.isValid = !hasErrors;
      
      // Check if form has changes from initial values
      const hasChanges = fields.some(field => {
        const currentValue = newState.values[field.name];
        const initialValue = initialValues[field.name] ?? field.defaultValue ?? '';
        return currentValue !== initialValue;
      });
      newState.hasChanges = hasChanges;
      newState.isDirty = hasChanges;

      return newState;
    });
  }, [fields, initialValues]);

  // Set field value
  const setValue = useCallback((name: string, value: any) => {
    setFormState(prev => {
      const newValues = { ...prev.values, [name]: value };
      const newTouched = { ...prev.touched, [name]: true };
      let newErrors = { ...prev.errors };

      // Real-time validation
      const field = fieldConfigMap[name];
      if (validateOnChange && field?.realTimeValidation !== false) {
        const error = validateField(name, value);
        
        if (error) {
          newErrors[name] = error;
        } else {
          delete newErrors[name];
        }
      }

      // Calculate derived state
      const hasErrors = Object.keys(newErrors).length > 0;
      const isValid = !hasErrors;
      
      // Check if form has changes from initial values
      const hasChanges = fields.some(field => {
        const currentValue = newValues[field.name];
        const initialValue = initialValues[field.name] ?? field.defaultValue ?? '';
        return currentValue !== initialValue;
      });

      return {
        ...prev,
        values: newValues,
        touched: newTouched,
        errors: newErrors,
        isValid,
        hasChanges,
        isDirty: hasChanges,
      };
    });
  }, [fieldConfigMap, validateOnChange, validateField, fields, initialValues]);

  // Set field error
  const setFieldError = useCallback((name: string, error: string | null) => {
    const newErrors = { ...formState.errors };
    
    if (error) {
      newErrors[name] = error;
    } else {
      delete newErrors[name];
    }

    updateFormState({ errors: newErrors });
  }, [formState.errors, updateFormState]);

  // Set multiple errors (useful for server-side validation)
  const setErrors = useCallback((errors: Record<string, string>) => {
    updateFormState({ errors: { ...formState.errors, ...errors } });
  }, [formState.errors, updateFormState]);

  // Clear field error
  const clearFieldError = useCallback((name: string) => {
    setFieldError(name, null);
  }, [setFieldError]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    updateFormState({ errors: {} });
  }, [updateFormState]);

  // Touch field
  const touchField = useCallback((name: string) => {
    updateFormState({
      touched: { ...formState.touched, [name]: true },
    });

    // Validate on blur if enabled
    if (validateOnBlur) {
      const error = validateField(name, formState.values[name]);
      setFieldError(name, error);
    }
  }, [formState.touched, formState.values, validateOnBlur, validateField, setFieldError, updateFormState]);

  // Reset form
  const reset = useCallback((newInitialValues?: Partial<T>) => {
    const valuesToUse = newInitialValues || initialValues;
    const values = fields.reduce((acc, field) => {
      (acc as any)[field.name] = valuesToUse[field.name] ?? field.defaultValue ?? '';
      return acc;
    }, {} as T);

    setFormState({
      values,
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: true,
      isDirty: false,
      hasChanges: false,
    });
  }, [fields, initialValues]);

  // Submit form
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate all fields
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      updateFormState({ 
        errors,
        touched: fields.reduce((acc, field) => {
          acc[field.name] = true;
          return acc;
        }, {} as Record<string, boolean>)
      });
      
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    if (!onSubmit) return;

    updateFormState({ isSubmitting: true });

    try {
      await onSubmit(formState.values);
      
      if (resetOnSubmit) {
        reset();
      }
      
      toast.success('Form submitted successfully');
    } catch (error) {
      // Handle server-side validation errors
      if (error && typeof error === 'object' && 'fieldErrors' in error) {
        const fieldErrors = (error as any).fieldErrors as Record<string, string>;
        setErrors(fieldErrors);
      } else {
        toast.error('Failed to submit form');
      }
    } finally {
      updateFormState({ isSubmitting: false });
    }
  }, [validateForm, onSubmit, formState.values, resetOnSubmit, reset, fields, updateFormState, setErrors]);

  // Get visible fields (considering conditional rendering)
  const visibleFields = useMemo(() => {
    return fields.filter(field => {
      if (field.hidden) return false;
      if (field.conditionalRender) {
        return field.conditionalRender(formState.values);
      }
      return true;
    });
  }, [fields, formState.values]);

  // Get field props helper
  const getFieldProps = useCallback((name: string) => {
    const field = fieldConfigMap[name];
    const value = formState.values[name] ?? '';
    const error = formState.errors[name];
    const touched = formState.touched[name];

    return {
      name,
      value,
      error: touched ? error : undefined,
      onChange: (value: any) => setValue(name, value),
      onBlur: () => touchField(name),
      disabled: field?.disabled || formState.isSubmitting,
      required: field?.validation?.required,
      placeholder: field?.placeholder,
    };
  }, [fieldConfigMap, formState, setValue, touchField]);

  // Effect to notify validation changes
  useEffect(() => {
    onValidationChange?.(formState.isValid);
  }, [formState.isValid, onValidationChange]);

  return {
    // State
    values: formState.values,
    errors: formState.errors,
    touched: formState.touched,
    isSubmitting: formState.isSubmitting,
    isValid: formState.isValid,
    isDirty: formState.isDirty,
    hasChanges: formState.hasChanges,
    
    // Field management
    setValue,
    setFieldError,
    setErrors,
    clearFieldError,
    clearErrors,
    touchField,
    getFieldProps,
    
    // Form actions
    handleSubmit,
    reset,
    validateForm,
    
    // Computed
    visibleFields,
  };
}