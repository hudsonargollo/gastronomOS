# CRUD System Enhancements and Patterns

The Enhanced CRUD system provides a comprehensive solution for data management operations with animations, consistent validation, bulk operations, and enhanced user experience. This guide covers implementation patterns, best practices, and advanced features.

## Overview

The enhanced CRUD system builds upon traditional Create, Read, Update, Delete operations with:
- **Animated Operations**: Smooth transitions for all data operations
- **Consistent Validation**: Unified validation patterns across all forms
- **Bulk Operations**: Multi-item operations with progress tracking
- **Enhanced UX**: Optimistic updates, error handling, and user feedback
- **Export Functionality**: Data export in multiple formats
- **Duplicate Operations**: Quick item duplication with validation

## Core Components

### Enhanced CRUD Hook

The `useEnhancedCRUD` hook provides comprehensive data management capabilities:

```tsx
import { useEnhancedCRUD } from '@/hooks/use-crud';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'active' | 'inactive' | 'discontinued';
}

function ProductManager() {
  const {
    // Basic CRUD operations
    items,
    loading,
    error,
    create,
    update,
    delete: deleteItem,
    
    // Enhanced operations
    bulkUpdate,
    bulkDelete,
    duplicate,
    export: exportData,
    
    // Animation state
    isAnimating,
    animationQueue,
    clearAnimationQueue,
    
    // Search and filtering
    searchTerm,
    setSearchTerm,
    filteredItems,
    
    // Pagination
    currentPage,
    totalPages,
    setPage,
    
    // Selection
    selectedItems,
    selectItem,
    selectAll,
    clearSelection,
  } = useEnhancedCRUD<Product>({
    endpoint: '/api/products',
    pageSize: 20,
    enableAnimations: true,
    enableOptimisticUpdates: true,
  });

  return (
    <div>
      {/* CRUD interface implementation */}
    </div>
  );
}
```

### Animated CRUD Table

The `AnimatedCRUDTable` component provides a complete data management interface:

```tsx
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';
import { ColumnDef } from '@tanstack/react-table';

const productColumns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("price"));
      return <div className="font-mono">${price.toFixed(2)}</div>;
    },
  },
  // ... more columns
];

function ProductTable() {
  const productsHook = useProducts();

  return (
    <AnimatedCRUDTable<Product>
      columns={productColumns}
      crudHook={productsHook}
      searchPlaceholder="Search products..."
      addLabel="Add Product"
      emptyMessage="No products found. Create your first product to get started."
      enableBulkOperations={true}
      enableExport={true}
      enableDuplicate={true}
      onCreateNew={() => setCreateModalOpen(true)}
      onEditItem={(product) => handleEdit(product)}
      onView={(product) => handleView(product)}
      className="border rounded-lg"
    />
  );
}
```

## Form Integration

### Enhanced Modal Form

The `EnhancedModalForm` component provides comprehensive form functionality:

```tsx
import { EnhancedModalForm } from '@/components/ui/enhanced-modal-form';
import { FormFieldConfig } from '@/hooks/use-enhanced-form-validation';

const productFormFields: FormFieldConfig[] = [
  {
    name: 'name',
    label: 'Product Name',
    type: 'text',
    placeholder: 'Enter product name',
    validation: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    realTimeValidation: true,
    animation: {
      enter: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
    },
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: [
      { value: 'beverages', label: 'Beverages' },
      { value: 'food', label: 'Food' },
      { value: 'supplies', label: 'Supplies' },
    ],
    validation: {
      required: true,
    },
    dependencies: ['type'], // Show only if type is selected
    conditionalRender: (formData) => !!formData.type,
  },
  {
    name: 'price',
    label: 'Price ($)',
    type: 'number',
    placeholder: '0.00',
    validation: {
      required: true,
      min: 0,
      custom: (value) => {
        if (value && value < 0) return 'Price must be positive';
        if (value && value > 10000) return 'Price seems too high';
        return null;
      }
    },
  },
];

function ProductForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const handleSubmit = async (data: Partial<Product>) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
      } else {
        await createProduct(data);
      }
      setIsOpen(false);
    } catch (error) {
      throw error; // Let the form handle the error
    }
  };

  return (
    <EnhancedModalForm<Partial<Product>>
      open={isOpen}
      onOpenChange={setIsOpen}
      title={editingProduct ? 'Edit Product' : 'Create Product'}
      description="Enter product information and settings."
      fields={productFormFields}
      initialValues={editingProduct || {}}
      onSubmit={handleSubmit}
      submitLabel={editingProduct ? 'Update Product' : 'Create Product'}
      size="lg"
      showValidationSummary={true}
      enableRealTimeValidation={true}
      enableAutoSave={true}
      autoSaveInterval={30000}
    />
  );
}
```

## Advanced Patterns

### Optimistic Updates

Implement optimistic updates for better user experience:

```tsx
function useOptimisticCRUD<T extends { id: string }>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [pendingOperations, setPendingOperations] = useState<Map<string, 'create' | 'update' | 'delete'>>(new Map());

  const create = async (data: Omit<T, 'id'>) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticItem = { ...data, id: tempId } as T;
    
    // Optimistic update
    setItems(prev => [...prev, optimisticItem]);
    setPendingOperations(prev => new Map(prev).set(tempId, 'create'));

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const createdItem = await response.json();
      
      // Replace optimistic item with real item
      setItems(prev => prev.map(item => 
        item.id === tempId ? createdItem : item
      ));
      setPendingOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });
      
      return createdItem;
    } catch (error) {
      // Revert optimistic update
      setItems(prev => prev.filter(item => item.id !== tempId));
      setPendingOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(tempId);
        return newMap;
      });
      throw error;
    }
  };

  const update = async (id: string, data: Partial<T>) => {
    const originalItem = items.find(item => item.id === id);
    if (!originalItem) throw new Error('Item not found');

    // Optimistic update
    const updatedItem = { ...originalItem, ...data };
    setItems(prev => prev.map(item => 
      item.id === id ? updatedItem : item
    ));
    setPendingOperations(prev => new Map(prev).set(id, 'update'));

    try {
      const response = await fetch(`${endpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      const serverItem = await response.json();
      
      // Update with server response
      setItems(prev => prev.map(item => 
        item.id === id ? serverItem : item
      ));
      setPendingOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      
      return serverItem;
    } catch (error) {
      // Revert optimistic update
      setItems(prev => prev.map(item => 
        item.id === id ? originalItem : item
      ));
      setPendingOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      throw error;
    }
  };

  return {
    items,
    pendingOperations,
    create,
    update,
    // ... other operations
  };
}
```

### Bulk Operations

Implement efficient bulk operations with progress tracking:

```tsx
function useBulkOperations<T extends { id: string }>() {
  const [bulkProgress, setBulkProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    operation: string;
  } | null>(null);

  const bulkUpdate = async (
    items: T[],
    updateFn: (item: T) => Partial<T>,
    options: {
      batchSize?: number;
      onProgress?: (progress: { completed: number; total: number }) => void;
    } = {}
  ) => {
    const { batchSize = 10, onProgress } = options;
    const total = items.length;
    let completed = 0;
    let failed = 0;

    setBulkProgress({ total, completed, failed, operation: 'update' });

    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (item) => {
        try {
          const updateData = updateFn(item);
          const result = await updateItem(item.id, updateData);
          completed++;
          setBulkProgress(prev => prev ? { ...prev, completed } : null);
          onProgress?.({ completed, total });
          return { success: true, item: result };
        } catch (error) {
          failed++;
          setBulkProgress(prev => prev ? { ...prev, failed } : null);
          return { success: false, item, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the server
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setBulkProgress(null);
    return results;
  };

  const bulkDelete = async (
    itemIds: string[],
    options: {
      batchSize?: number;
      onProgress?: (progress: { completed: number; total: number }) => void;
    } = {}
  ) => {
    const { batchSize = 10, onProgress } = options;
    const total = itemIds.length;
    let completed = 0;
    let failed = 0;

    setBulkProgress({ total, completed, failed, operation: 'delete' });

    const batches = [];
    for (let i = 0; i < itemIds.length; i += batchSize) {
      batches.push(itemIds.slice(i, i + batchSize));
    }

    const results = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (id) => {
        try {
          await deleteItem(id);
          completed++;
          setBulkProgress(prev => prev ? { ...prev, completed } : null);
          onProgress?.({ completed, total });
          return { success: true, id };
        } catch (error) {
          failed++;
          setBulkProgress(prev => prev ? { ...prev, failed } : null);
          return { success: false, id, error };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setBulkProgress(null);
    return results;
  };

  return {
    bulkProgress,
    bulkUpdate,
    bulkDelete,
  };
}
```

### Data Export

Implement comprehensive data export functionality:

```tsx
function useDataExport<T>() {
  const exportToCSV = (data: T[], filename: string, columns?: string[]) => {
    if (data.length === 0) return;

    const headers = columns || Object.keys(data[0] as any);
    const csvContent = [
      headers.join(','),
      ...data.map(item => 
        headers.map(header => {
          const value = (item as any)[header];
          // Escape commas and quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ].join('\n');

    downloadFile(csvContent, `${filename}.csv`, 'text/csv');
  };

  const exportToJSON = (data: T[], filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2);
    downloadFile(jsonContent, `${filename}.json`, 'application/json');
  };

  const exportToPDF = async (data: T[], filename: string, options: {
    title?: string;
    columns?: { key: string; title: string; width?: number }[];
  } = {}) => {
    // Implementation would use a PDF library like jsPDF
    // This is a simplified example
    const { title = 'Data Export', columns } = options;
    
    // Create PDF content
    const pdfContent = createPDFContent(data, title, columns);
    downloadFile(pdfContent, `${filename}.pdf`, 'application/pdf');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    exportToCSV,
    exportToJSON,
    exportToPDF,
  };
}
```

## Validation Patterns

### Comprehensive Validation

Implement comprehensive validation with real-time feedback:

```tsx
interface ValidationRule<T = any> {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: T, formData?: any) => string | null;
  asyncValidation?: (value: T, formData?: any) => Promise<string | null>;
}

interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

function useFormValidation<T extends Record<string, any>>(
  fields: Record<keyof T, ValidationRule>,
  options: {
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
    debounceMs?: number;
  } = {}
) {
  const [values, setValues] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState<Record<string, boolean>>({});

  const validateField = async (
    fieldName: keyof T,
    value: any,
    allValues: Partial<T> = values
  ): Promise<string | null> => {
    const rule = fields[fieldName];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      return 'This field is required';
    }

    // Skip other validations if field is empty and not required
    if (!value && !rule.required) return null;

    // String length validation
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        return `Minimum length is ${rule.minLength} characters`;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return `Maximum length is ${rule.maxLength} characters`;
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return `Minimum value is ${rule.min}`;
      }
      if (rule.max !== undefined && value > rule.max) {
        return `Maximum value is ${rule.max}`;
      }
    }

    // Pattern validation
    if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
      return 'Invalid format';
    }

    // Custom validation
    if (rule.custom) {
      const customError = rule.custom(value, allValues);
      if (customError) return customError;
    }

    // Async validation
    if (rule.asyncValidation) {
      try {
        const asyncError = await rule.asyncValidation(value, allValues);
        if (asyncError) return asyncError;
      } catch (error) {
        return 'Validation failed';
      }
    }

    return null;
  };

  const validateForm = async (valuesToValidate: Partial<T> = values): Promise<ValidationResult> => {
    const newErrors: Record<string, string> = {};
    const validationPromises = Object.keys(fields).map(async (fieldName) => {
      const error = await validateField(fieldName as keyof T, valuesToValidate[fieldName as keyof T], valuesToValidate);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    await Promise.all(validationPromises);

    setErrors(newErrors);
    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
      warnings,
    };
  };

  const setValue = (fieldName: keyof T, value: any) => {
    const newValues = { ...values, [fieldName]: value };
    setValues(newValues);

    if (options.validateOnChange) {
      debouncedValidateField(fieldName, value, newValues);
    }
  };

  const setTouched = (fieldName: keyof T, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [fieldName]: isTouched }));

    if (options.validateOnBlur && isTouched) {
      validateField(fieldName, values[fieldName], values).then(error => {
        setErrors(prev => ({ ...prev, [fieldName]: error || '' }));
      });
    }
  };

  const debouncedValidateField = useMemo(
    () => debounce(async (fieldName: keyof T, value: any, allValues: Partial<T>) => {
      setIsValidating(prev => ({ ...prev, [fieldName]: true }));
      const error = await validateField(fieldName, value, allValues);
      setErrors(prev => ({ ...prev, [fieldName]: error || '' }));
      setIsValidating(prev => ({ ...prev, [fieldName]: false }));
    }, options.debounceMs || 300),
    [fields, options.debounceMs]
  );

  return {
    values,
    errors,
    warnings,
    touched,
    isValidating,
    setValue,
    setTouched,
    validateForm,
    validateField,
    isValid: Object.keys(errors).length === 0,
    isDirty: Object.keys(values).length > 0,
  };
}
```

## Animation Integration

### CRUD Operation Animations

Implement smooth animations for all CRUD operations:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

const listItemVariants = {
  initial: { opacity: 0, x: -20, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 20, scale: 0.95 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

function AnimatedCRUDList<T extends { id: string }>({ 
  items, 
  renderItem,
  onEdit,
  onDelete 
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onEdit: (item: T) => void;
  onDelete: (item: T) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-2"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.id}
            variants={listItemVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout
            className="p-4 border rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {renderItem(item)}
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(item)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onDelete(item)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
```

### Form Field Animations

Implement animated form fields with validation feedback:

```tsx
import { FormFieldAnimator } from '@/components/ui/form-field-animator';

function AnimatedFormField({
  name,
  label,
  value,
  onChange,
  error,
  isValidating,
  type = 'text',
  ...props
}: {
  name: string;
  label: string;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  isValidating?: boolean;
  type?: string;
}) {
  return (
    <FormFieldAnimator
      hasError={!!error}
      isValidating={isValidating}
      className="space-y-2"
    >
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? 'border-red-500' : ''}
        {...props}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-red-500"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {isValidating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-gray-500"
        >
          Validating...
        </motion.div>
      )}
    </FormFieldAnimator>
  );
}
```

## Error Handling

### Comprehensive Error Handling

Implement robust error handling for all CRUD operations:

```tsx
interface CRUDError {
  type: 'network' | 'validation' | 'server' | 'client';
  message: string;
  details?: any;
  recoverable: boolean;
  retryable: boolean;
}

function useCRUDErrorHandling() {
  const [errors, setErrors] = useState<Record<string, CRUDError>>({});

  const handleError = (operation: string, error: any): CRUDError => {
    let crudError: CRUDError;

    if (error.name === 'NetworkError' || !navigator.onLine) {
      crudError = {
        type: 'network',
        message: 'Network connection failed. Please check your internet connection.',
        details: error,
        recoverable: true,
        retryable: true,
      };
    } else if (error.status >= 400 && error.status < 500) {
      crudError = {
        type: 'validation',
        message: error.message || 'Invalid data provided.',
        details: error.details,
        recoverable: true,
        retryable: false,
      };
    } else if (error.status >= 500) {
      crudError = {
        type: 'server',
        message: 'Server error occurred. Please try again later.',
        details: error,
        recoverable: true,
        retryable: true,
      };
    } else {
      crudError = {
        type: 'client',
        message: 'An unexpected error occurred.',
        details: error,
        recoverable: false,
        retryable: false,
      };
    }

    setErrors(prev => ({ ...prev, [operation]: crudError }));
    return crudError;
  };

  const clearError = (operation: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[operation];
      return newErrors;
    });
  };

  const retryOperation = async (operation: string, retryFn: () => Promise<any>) => {
    clearError(operation);
    try {
      return await retryFn();
    } catch (error) {
      handleError(operation, error);
      throw error;
    }
  };

  return {
    errors,
    handleError,
    clearError,
    retryOperation,
  };
}
```

## Testing Patterns

### Unit Testing CRUD Operations

```tsx
import { renderHook, act } from '@testing-library/react';
import { useEnhancedCRUD } from '@/hooks/use-crud';

// Mock fetch
global.fetch = jest.fn();

describe('useEnhancedCRUD', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('should create item successfully', async () => {
    const mockItem = { id: '1', name: 'Test Item' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockItem,
    });

    const { result } = renderHook(() => useEnhancedCRUD({
      endpoint: '/api/items',
    }));

    await act(async () => {
      const created = await result.current.create({ name: 'Test Item' });
      expect(created).toEqual(mockItem);
    });

    expect(fetch).toHaveBeenCalledWith('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Item' }),
    });
  });

  it('should handle create error', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useEnhancedCRUD({
      endpoint: '/api/items',
    }));

    await act(async () => {
      try {
        await result.current.create({ name: 'Test Item' });
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should perform bulk operations', async () => {
    const mockItems = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ];

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems[0],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockItems[1],
      });

    const { result } = renderHook(() => useEnhancedCRUD({
      endpoint: '/api/items',
    }));

    await act(async () => {
      const results = await result.current.bulkUpdate(
        mockItems,
        (item) => ({ ...item, updated: true })
      );
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
    });
  });
});
```

### Integration Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnimatedCRUDTable } from '@/components/ui/animated-crud-table';

const mockData = [
  { id: '1', name: 'Item 1', category: 'A' },
  { id: '2', name: 'Item 2', category: 'B' },
];

const mockColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'category', header: 'Category' },
];

describe('AnimatedCRUDTable Integration', () => {
  const mockCRUDHook = {
    items: mockData,
    loading: false,
    error: null,
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    selectedItems: [],
    selectItem: jest.fn(),
    selectAll: jest.fn(),
    clearSelection: jest.fn(),
  };

  it('should render table with data', () => {
    render(
      <AnimatedCRUDTable
        columns={mockColumns}
        crudHook={mockCRUDHook}
      />
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should handle item selection', async () => {
    render(
      <AnimatedCRUDTable
        columns={mockColumns}
        crudHook={mockCRUDHook}
        enableBulkOperations={true}
      />
    );

    const checkbox = screen.getAllByRole('checkbox')[1]; // First item checkbox
    fireEvent.click(checkbox);

    expect(mockCRUDHook.selectItem).toHaveBeenCalledWith('1');
  });

  it('should handle bulk delete', async () => {
    const mockCRUDHookWithSelection = {
      ...mockCRUDHook,
      selectedItems: ['1', '2'],
      bulkDelete: jest.fn().mockResolvedValue([]),
    };

    render(
      <AnimatedCRUDTable
        columns={mockColumns}
        crudHook={mockCRUDHookWithSelection}
        enableBulkOperations={true}
      />
    );

    const bulkDeleteButton = screen.getByText('Delete Selected');
    fireEvent.click(bulkDeleteButton);

    // Confirm deletion
    const confirmButton = screen.getByText('Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockCRUDHookWithSelection.bulkDelete).toHaveBeenCalledWith(['1', '2']);
    });
  });
});
```

## Best Practices

### 1. Data Management

- **Immutable Updates**: Always create new objects when updating state
- **Optimistic Updates**: Update UI immediately, sync with server later
- **Error Recovery**: Provide clear error messages and recovery options
- **Data Validation**: Validate data on both client and server sides

### 2. User Experience

- **Loading States**: Show loading indicators for all operations
- **Progress Feedback**: Display progress for bulk operations
- **Confirmation Dialogs**: Require confirmation for destructive operations
- **Keyboard Shortcuts**: Support common keyboard shortcuts (Ctrl+S, Delete, etc.)

### 3. Performance

- **Pagination**: Implement pagination for large datasets
- **Virtual Scrolling**: Use virtual scrolling for very large lists
- **Debounced Search**: Debounce search input to reduce API calls
- **Caching**: Cache frequently accessed data

### 4. Accessibility

- **Keyboard Navigation**: Support full keyboard navigation
- **Screen Readers**: Provide proper ARIA labels and descriptions
- **Focus Management**: Manage focus appropriately during operations
- **Color Contrast**: Ensure sufficient color contrast for all elements

### 5. Error Handling

- **Graceful Degradation**: Handle errors gracefully without breaking the UI
- **Retry Mechanisms**: Provide retry options for failed operations
- **Offline Support**: Handle offline scenarios appropriately
- **Error Logging**: Log errors for debugging and monitoring

## Conclusion

The Enhanced CRUD system provides a comprehensive foundation for data management operations in the Gastronomos application. By following these patterns and best practices, you can create consistent, performant, and user-friendly data management interfaces.

Key benefits:
- **Consistent Experience**: Unified patterns across all CRUD operations
- **Enhanced Performance**: Optimistic updates and efficient bulk operations
- **Better User Feedback**: Clear loading states, progress indicators, and error messages
- **Improved Accessibility**: Full keyboard support and screen reader compatibility
- **Robust Error Handling**: Comprehensive error handling with recovery options

For more examples and advanced patterns, refer to the CRUD demo components and the enhanced form system in the codebase.