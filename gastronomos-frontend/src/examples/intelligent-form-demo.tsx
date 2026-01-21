"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EnhancedModalForm } from "@/components/ui/enhanced-modal-form"
import { FormFieldConfig, AutocompleteOption } from "@/hooks/use-enhanced-form-validation"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

// Sample data for autocomplete
const supplierOptions: AutocompleteOption[] = [
  {
    value: "supplier-1",
    label: "Fresh Foods Inc.",
    description: "Premium produce supplier",
    category: "Produce",
    metadata: { rating: 4.8, location: "Local" }
  },
  {
    value: "supplier-2", 
    label: "Ocean Catch Co.",
    description: "Fresh seafood and fish",
    category: "Seafood",
    metadata: { rating: 4.6, location: "Coastal" }
  },
  {
    value: "supplier-3",
    label: "Dairy Dreams Ltd.",
    description: "Organic dairy products",
    category: "Dairy",
    metadata: { rating: 4.9, location: "Regional" }
  },
  {
    value: "supplier-4",
    label: "Meat Masters",
    description: "Premium cuts and specialty meats",
    category: "Meat",
    metadata: { rating: 4.7, location: "Local" }
  },
  {
    value: "supplier-5",
    label: "Spice World",
    description: "International spices and seasonings",
    category: "Spices",
    metadata: { rating: 4.5, location: "International" }
  }
]

const productOptions: AutocompleteOption[] = [
  {
    value: "prod-1",
    label: "Organic Tomatoes",
    description: "Fresh organic tomatoes - 1lb",
    category: "Produce"
  },
  {
    value: "prod-2",
    label: "Atlantic Salmon",
    description: "Fresh Atlantic salmon fillet - 1lb",
    category: "Seafood"
  },
  {
    value: "prod-3",
    label: "Whole Milk",
    description: "Organic whole milk - 1 gallon",
    category: "Dairy"
  },
  {
    value: "prod-4",
    label: "Ground Beef",
    description: "85% lean ground beef - 1lb",
    category: "Meat"
  },
  {
    value: "prod-5",
    label: "Black Pepper",
    description: "Freshly ground black pepper - 4oz",
    category: "Spices"
  }
]

const locationOptions: AutocompleteOption[] = [
  {
    value: "loc-1",
    label: "Main Kitchen",
    description: "Primary cooking facility",
    category: "Kitchen"
  },
  {
    value: "loc-2",
    label: "Cold Storage",
    description: "Refrigerated storage area",
    category: "Storage"
  },
  {
    value: "loc-3",
    label: "Dry Goods",
    description: "Non-perishable storage",
    category: "Storage"
  },
  {
    value: "loc-4",
    label: "Bar Area",
    description: "Beverage preparation area",
    category: "Bar"
  }
]

interface FormData {
  orderType: string
  supplier: string[]
  products: string[]
  location: string
  quantity: number
  priority: string
  notes: string
  requiresApproval: boolean
  deliveryDate: string
  budget: number
}

const IntelligentFormDemo: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const [formType, setFormType] = React.useState<'simple' | 'complex' | 'conditional'>('simple')
  const [submittedData, setSubmittedData] = React.useState<FormData | null>(null)

  // Dynamic field configurations based on form type
  const getFormFields = (): FormFieldConfig[] => {
    const baseFields: FormFieldConfig[] = [
      {
        name: 'orderType',
        label: 'Order Type',
        type: 'select',
        validation: { required: true },
        options: [
          { value: 'regular', label: 'Regular Order' },
          { value: 'urgent', label: 'Urgent Order' },
          { value: 'bulk', label: 'Bulk Order' }
        ],
        description: 'Select the type of order you want to create'
      }
    ]

    if (formType === 'simple') {
      return [
        ...baseFields,
        {
          name: 'supplier',
          label: 'Supplier',
          type: 'autocomplete',
          validation: { required: true },
          autocompleteOptions: supplierOptions,
          multiple: false,
          description: 'Search and select a supplier'
        },
        {
          name: 'notes',
          label: 'Notes',
          type: 'textarea',
          placeholder: 'Add any special instructions...',
          description: 'Optional notes for this order'
        }
      ]
    }

    if (formType === 'complex') {
      return [
        ...baseFields,
        {
          name: 'supplier',
          label: 'Suppliers',
          type: 'autocomplete',
          validation: { required: true },
          autocompleteOptions: supplierOptions,
          multiple: true,
          maxDisplayItems: 3,
          allowCustomValues: true,
          description: 'Select multiple suppliers for this order'
        },
        {
          name: 'products',
          label: 'Products',
          type: 'autocomplete',
          validation: { required: true },
          autocompleteOptions: productOptions,
          multiple: true,
          allowCustomValues: true,
          description: 'Search and select products to order'
        },
        {
          name: 'location',
          label: 'Delivery Location',
          type: 'autocomplete',
          validation: { required: true },
          autocompleteOptions: locationOptions,
          description: 'Where should this order be delivered?'
        },
        {
          name: 'quantity',
          label: 'Total Quantity',
          type: 'number',
          validation: { required: true, min: 1, max: 1000 },
          description: 'Total quantity for all products'
        },
        {
          name: 'budget',
          label: 'Budget Limit',
          type: 'number',
          validation: { min: 0 },
          description: 'Maximum budget for this order (optional)'
        },
        {
          name: 'deliveryDate',
          label: 'Delivery Date',
          type: 'date',
          validation: { required: true },
          description: 'When do you need this delivered?'
        },
        {
          name: 'notes',
          label: 'Special Instructions',
          type: 'textarea',
          placeholder: 'Add any special instructions, dietary requirements, etc...',
          description: 'Any additional information for the supplier'
        }
      ]
    }

    // Conditional form
    return [
      ...baseFields,
      {
        name: 'priority',
        label: 'Priority Level',
        type: 'select',
        validation: { required: true },
        options: [
          { value: 'low', label: 'Low Priority' },
          { value: 'medium', label: 'Medium Priority' },
          { value: 'high', label: 'High Priority' },
          { value: 'urgent', label: 'Urgent' }
        ],
        description: 'How urgent is this order?'
      },
      {
        name: 'requiresApproval',
        label: 'Requires Manager Approval',
        type: 'checkbox',
        conditionalRender: (data) => data.priority === 'high' || data.priority === 'urgent',
        description: 'High priority orders may require manager approval'
      },
      {
        name: 'supplier',
        label: 'Supplier',
        type: 'autocomplete',
        validation: { required: true },
        autocompleteOptions: supplierOptions,
        description: 'Select your preferred supplier'
      },
      {
        name: 'budget',
        label: 'Budget Override',
        type: 'number',
        conditionalRender: (data) => data.requiresApproval,
        validation: { min: 0 },
        description: 'Special budget for approved orders'
      },
      {
        name: 'notes',
        label: 'Justification',
        type: 'textarea',
        conditionalRender: (data) => data.priority === 'urgent',
        validation: { 
          required: true,
          minLength: 10
        },
        placeholder: 'Explain why this order is urgent...',
        description: 'Urgent orders require justification'
      }
    ]
  }

  const handleSubmit = async (data: FormData) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setSubmittedData(data)
    toast.success('Order created successfully!')
  }

  const openForm = (type: 'simple' | 'complex' | 'conditional') => {
    setFormType(type)
    setIsFormOpen(true)
    setSubmittedData(null)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-3xl font-bold">Intelligent Form System Demo</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Experience our enhanced form system with real-time validation, dynamic field dependencies, 
          smooth animations, and intelligent autocomplete features.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Simple Form
                <Badge variant="secondary">Basic</Badge>
              </CardTitle>
              <CardDescription>
                Basic form with autocomplete and real-time validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-2 text-muted-foreground">
                  <li>• Single supplier selection</li>
                  <li>• Real-time validation</li>
                  <li>• Smooth field animations</li>
                  <li>• Basic autocomplete</li>
              </ul>
              <Button onClick={() => openForm('simple')} className="w-full">
                Try Simple Form
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Complex Form
                <Badge variant="default">Advanced</Badge>
              </CardTitle>
              <CardDescription>
                Advanced form with multiple selections and custom values
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Multiple supplier selection</li>
                <li>• Product autocomplete</li>
                <li>• Custom value creation</li>
                <li>• Complex validation rules</li>
              </ul>
              <Button onClick={() => openForm('complex')} className="w-full">
                Try Complex Form
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Conditional Form
                <Badge variant="outline">Dynamic</Badge>
              </CardTitle>
              <CardDescription>
                Dynamic form with conditional fields and dependencies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Dynamic field visibility</li>
                <li>• Conditional validation</li>
                <li>• Field dependencies</li>
                <li>• Smart form flow</li>
              </ul>
              <Button onClick={() => openForm('conditional')} className="w-full">
                Try Conditional Form
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Results Display */}
      {submittedData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>Form Submission Result</CardTitle>
              <CardDescription>
                Here's the data that was submitted from the {formType} form
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto">
                {JSON.stringify(submittedData, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Enhanced Modal Form */}
      <EnhancedModalForm<FormData>
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        title={`${formType.charAt(0).toUpperCase() + formType.slice(1)} Order Form`}
        description={`Create a new order using the ${formType} form configuration`}
        fields={getFormFields()}
        onSubmit={handleSubmit}
        submitLabel="Create Order"
        size="lg"
        showValidationSummary={true}
        enableRealTimeValidation={true}
      />
    </div>
  )
}

export { IntelligentFormDemo }