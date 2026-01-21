"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AnimatedCRUDTable } from "@/components/ui/animated-crud-table"
import { EnhancedModalForm } from "@/components/ui/enhanced-modal-form"
import { useProducts, EnhancedCRUDHook } from "@/hooks/use-crud"
import { FormFieldConfig } from "@/hooks/use-enhanced-form-validation"
import { fadeInOut, staggerContainer } from "@/lib/animation-utils"

// Mock product type
interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  status: 'active' | 'inactive' | 'discontinued'
  description?: string
  createdAt: string
  updatedAt: string
}

// Form fields configuration
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
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    placeholder: 'Select category',
    options: [
      { value: 'beverages', label: 'Beverages' },
      { value: 'food', label: 'Food' },
      { value: 'supplies', label: 'Supplies' },
      { value: 'equipment', label: 'Equipment' },
    ],
    validation: {
      required: true,
    },
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
        if (value && value < 0) return 'Price must be positive'
        return null
      }
    },
  },
  {
    name: 'stock',
    label: 'Stock Quantity',
    type: 'number',
    placeholder: '0',
    validation: {
      required: true,
      min: 0,
    },
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'discontinued', label: 'Discontinued' },
    ],
    validation: {
      required: true,
    },
    defaultValue: 'active',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    placeholder: 'Enter product description (optional)',
    validation: {
      maxLength: 500,
    },
  },
]

// Table columns configuration
const productColumns: ColumnDef<Product>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => {
      const category = row.getValue("category") as string
      return (
        <Badge variant="outline" className="capitalize">
          {category}
        </Badge>
      )
    },
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => {
      const price = parseFloat(row.getValue("price"))
      return <div className="font-mono">${price.toFixed(2)}</div>
    },
  },
  {
    accessorKey: "stock",
    header: "Stock",
    cell: ({ row }) => {
      const stock = row.getValue("stock") as number
      return (
        <Badge 
          variant={stock > 10 ? "secondary" : stock > 0 ? "outline" : "destructive"}
        >
          {stock} units
        </Badge>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const variants = {
        active: "secondary",
        inactive: "outline", 
        discontinued: "destructive"
      } as const
      
      return (
        <Badge variant={variants[status as keyof typeof variants]}>
          {status}
        </Badge>
      )
    },
  },
]

export function EnhancedCRUDDemo() {
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [bulkOperationProgress, setBulkOperationProgress] = React.useState<number>()

  // Use the enhanced CRUD hook with proper typing
  const productsHook = useProducts() as any as EnhancedCRUDHook<Product>

  const handleCreateProduct = async (data: Partial<Product>) => {
    try {
      await productsHook.create(data)
    } catch (error) {
      throw error // Let the form handle the error
    }
  }

  const handleEditProduct = async (data: Partial<Product>) => {
    if (!editingProduct) return
    
    try {
      await productsHook.update(editingProduct.id, data)
      setEditingProduct(null)
    } catch (error) {
      throw error // Let the form handle the error
    }
  }

  const handleEditClick = (product: Product) => {
    setEditingProduct(product)
    setIsEditModalOpen(true)
  }

  const handleViewProduct = (product: Product) => {
    // Navigate to product detail view or show read-only modal
    console.log('View product:', product)
  }

  // Simulate bulk operation progress
  React.useEffect(() => {
    if (productsHook.isAnimating) {
      setBulkOperationProgress(0)
      const interval = setInterval(() => {
        setBulkOperationProgress(prev => {
          if (prev === undefined) return 0
          if (prev >= 100) {
            clearInterval(interval)
            setTimeout(() => setBulkOperationProgress(undefined), 1000)
            return 100
          }
          return prev + 10
        })
      }, 200)
      
      return () => clearInterval(interval)
    }
  }, [productsHook.isAnimating])

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="space-y-6 p-6"
    >
      <motion.div variants={fadeInOut}>
        <Card>
          <CardHeader>
            <CardTitle>Enhanced CRUD Operations Demo</CardTitle>
            <CardDescription>
              Demonstrates animated CRUD operations with consistent validation, 
              bulk operations, and enhanced user experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Animation Status */}
              {productsHook.isAnimating && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-blue-800">
                        Processing {productsHook.animationQueue.length} operations
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={productsHook.clearAnimationQueue}
                    >
                      Clear Queue
                    </Button>
                  </div>
                  
                  {productsHook.animationQueue.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {productsHook.animationQueue.slice(0, 3).map((action) => (
                        <div key={action.id} className="text-xs text-blue-600">
                          {action.type} operation on {action.target}
                        </div>
                      ))}
                      {productsHook.animationQueue.length > 3 && (
                        <div className="text-xs text-blue-500">
                          +{productsHook.animationQueue.length - 3} more operations
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Enhanced CRUD Table */}
              <AnimatedCRUDTable<Product, unknown>
                columns={productColumns}
                crudHook={productsHook}
                searchPlaceholder="Search products..."
                addLabel="Add Product"
                emptyMessage="No products found. Create your first product to get started."
                enableBulkOperations={true}
                enableExport={true}
                enableDuplicate={true}
                bulkOperationProgress={bulkOperationProgress}
                onCreateNew={() => setIsCreateModalOpen(true)}
                onEditItem={handleEditClick}
                onView={handleViewProduct}
                className="border rounded-lg"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Product Modal */}
      <EnhancedModalForm<Partial<Product>>
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        title="Create New Product"
        description="Add a new product to your inventory with detailed information."
        fields={productFormFields}
        onSubmit={handleCreateProduct}
        submitLabel="Create Product"
        size="lg"
        showValidationSummary={true}
        enableRealTimeValidation={true}
      />

      {/* Edit Product Modal */}
      <EnhancedModalForm<Partial<Product>>
        open={isEditModalOpen}
        onOpenChange={(open) => {
          setIsEditModalOpen(open)
          if (!open) setEditingProduct(null)
        }}
        title="Edit Product"
        description="Update product information and settings."
        fields={productFormFields}
        initialValues={editingProduct || {}}
        onSubmit={handleEditProduct}
        submitLabel="Update Product"
        size="lg"
        showValidationSummary={true}
        enableRealTimeValidation={true}
      />

      {/* Feature Showcase */}
      <motion.div variants={fadeInOut}>
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Features</CardTitle>
            <CardDescription>
              Key improvements in the enhanced CRUD system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Animated Operations</h4>
                <p className="text-sm text-muted-foreground">
                  Smooth animations for create, update, delete, and bulk operations
                  with visual feedback and progress indicators.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Real-time Validation</h4>
                <p className="text-sm text-muted-foreground">
                  Instant feedback with comprehensive validation rules,
                  error highlighting, and completion tracking.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Bulk Operations</h4>
                <p className="text-sm text-muted-foreground">
                  Select multiple items for bulk delete, update, or export
                  with progress tracking and confirmation dialogs.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Export Functionality</h4>
                <p className="text-sm text-muted-foreground">
                  Export data in multiple formats (JSON, CSV) with support
                  for selected items or full dataset export.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Duplicate Items</h4>
                <p className="text-sm text-muted-foreground">
                  Quickly duplicate existing items with one click,
                  automatically handling ID generation and validation.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Consistent UI</h4>
                <p className="text-sm text-muted-foreground">
                  Unified design system with consistent animations,
                  error handling, and user feedback across all operations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}